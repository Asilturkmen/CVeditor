import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Route } from 'playwright-core'
import type { Cv } from '@/cv/schema'
import type { DrawInput, DrawResult } from '@/render/drawDocument'
import { fontLoadQueries } from '@/render/fonts'
import type { OversizedBlock } from '@/render/paginate'
import { pageDrawScript } from '@/render/pageScript'
import { cvFonts, cvStyles, documentShell, renderCvSource } from '@/render/renderCv'
import { getTemplate } from '@/render/templates'

/**
 * CV → PDF. Önizlemeyle aynı yol (önizleme = PDF):
 *   documentShell → enjekte edilen çizim betiği (drawDocument + paginate) → window.__cvDraw → page.pdf
 *
 * Sayfa hiçbir zaman dış ağa çıkmaz: bütün istekler yönlendirme kuralından geçer. Yalnız uydurma
 * bir iç kökün (RENDER_ORIGIN) belgesi, çizim betiği ve kendi yazı tipi dosyalarımız karşılanır;
 * gerisi kesilir. Belgenin kendi CSP'si de betiği ve yazı tiplerini yalnız bu kökle sınırlar.
 */

/** `.invalid` hiçbir zaman çözümlenmez (RFC 2606): yönlendirme kaçsa bile ağa gidemez. */
export const RENDER_ORIGIN = 'http://render.cveditor.invalid'
const DRAW_SCRIPT_PATH = '/draw.js'
const FONT_FILE = /^\/fonts\/([a-z0-9-]+\.woff2)$/

const DOCUMENT_CSP = [
  "default-src 'none'",
  `script-src ${RENDER_ORIGIN}${DRAW_SCRIPT_PATH}`,
  "style-src 'unsafe-inline'",
  `font-src ${RENDER_ORIGIN}/fonts/`,
  'img-src data:',
].join('; ')

export interface RenderInput extends DrawInput {
  /** PDF üst verisindeki başlık */
  title: string
}

export interface RenderOptions {
  fontsDir: string
  signal?: AbortSignal
  /** Bir sayfadan uzun kayıt varsa yine de bas (kullanıcı onayladı) */
  allowSplit: boolean
  /** Görülen her istek (test ve günlük için): karşılanan mı, kesilen mi */
  onRequest?: (url: string, allowed: boolean) => void
}

export type RenderOutcome =
  | { kind: 'pdf'; pdf: Buffer; result: DrawResult }
  | { kind: 'oversized'; oversized: OversizedBlock[]; result: DrawResult }

/** CV'den çizim girdisi: zengin metin burada süzülür (configureSanitizer önceden çağrılmış olmalı). */
export function cvRenderInput(cv: Cv): RenderInput {
  const template = getTemplate(cv.templateId)
  return {
    lang: cv.language,
    styles: cvStyles(cv),
    html: renderCvSource(cv),
    fontQueries: Object.values(cvFonts(template, cv.template)).flatMap(fontLoadQueries),
    // Sunucuda ağ yok; yine de takılan bir yazı tipi çizimi bekletmesin.
    fontTimeoutMs: 10_000,
    title: cv.personal.fullName.trim() || cv.name,
  }
}

const fontCache = new Map<string, Promise<Buffer>>()

function fontFile(fontsDir: string, name: string): Promise<Buffer> {
  const key = join(fontsDir, name)
  let cached = fontCache.get(key)
  if (!cached) {
    cached = readFile(key)
    cached.catch(() => fontCache.delete(key))
    fontCache.set(key, cached)
  }
  return cached
}

let drawScript: string | null = null

/** İç kökte karşılanacak istek mi? (yalnız belge, çizim betiği, yazı tipi) */
export function allowedRenderPath(url: string): 'document' | 'script' | { font: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.origin !== RENDER_ORIGIN || parsed.search) return null
  if (parsed.pathname === '/') return 'document'
  if (parsed.pathname === DRAW_SCRIPT_PATH) return 'script'
  const font = FONT_FILE.exec(parsed.pathname)
  return font ? { font: font[1] } : null
}

export async function renderPdf(browser: Browser, input: RenderInput, options: RenderOptions): Promise<RenderOutcome> {
  const { title, ...draw } = input
  const shell = documentShell({ lang: input.lang, fontBase: `${RENDER_ORIGIN}/fonts/`, title })
  const context = await browser.newContext({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    acceptDownloads: false,
    locale: input.lang === 'tr' ? 'tr-TR' : 'en-US',
  })
  const abort = () => void context.close().catch(() => {})
  options.signal?.addEventListener('abort', abort, { once: true })
  // Önizleme = PDF: yazı tipi dosyası bulunamazsa yedek yazı tipiyle basılmaz, hata verilir.
  const missingFonts: string[] = []
  try {
    await context.route('**/*', async (route: Route) => {
      const url = route.request().url()
      const allowed = allowedRenderPath(url)
      options.onRequest?.(url, allowed !== null)
      if (allowed === 'document') {
        return route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          headers: { 'Content-Security-Policy': DOCUMENT_CSP },
          body: shell,
        })
      }
      if (allowed === 'script') {
        drawScript ??= pageDrawScript()
        return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: drawScript })
      }
      if (allowed) {
        const body = await fontFile(options.fontsDir, allowed.font).catch(() => null)
        if (body) return route.fulfill({ status: 200, contentType: 'font/woff2', body })
        missingFonts.push(allowed.font)
        return route.fulfill({ status: 404, body: '' })
      }
      return route.abort('blockedbyclient')
    })
    const page = await context.newPage()
    await page.goto(`${RENDER_ORIGIN}/`, { waitUntil: 'load' })
    await page.addScriptTag({ url: `${RENDER_ORIGIN}${DRAW_SCRIPT_PATH}` })
    const result = await page.evaluate(
      (i) => (window as unknown as { __cvDraw: (input: DrawInput) => Promise<DrawResult | null> }).__cvDraw(i),
      draw,
    )
    if (!result) throw new Error('CV çizilemedi')
    if (result.fontsTimedOut) throw new Error('Yazı tipleri yüklenemedi')
    if (missingFonts.length > 0) throw new Error(`Yazı tipi dosyası yok: ${missingFonts.join(', ')} (${options.fontsDir})`)
    if (result.oversized.length > 0 && !options.allowSplit) return { kind: 'oversized', oversized: result.oversized, result }
    await page.emulateMedia({ media: 'print' })
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, tagged: true })
    return { kind: 'pdf', pdf, result }
  } finally {
    options.signal?.removeEventListener('abort', abort)
    await context.close().catch(() => {})
  }
}
