import { expect, type Page } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { preview } from './helpers.ts'

/**
 * Önizlemedeki sayfa sayısı bir süre değişmeyene kadar bekler (sayfalama
 * oturdu). Sayım belgenin kendi DOM'unda yapılır: Playwright konumlayıcıları
 * gölge DOM'u da deler ve şablon geçişinin kopyasındaki (#cv-ghost) sayfaları
 * da sayardı.
 */
export async function settledPageCount(page: Page): Promise<number> {
  const root = preview(page).locator('html')
  await expect(preview(page).locator('.page').first()).toBeVisible({ timeout: 15_000 })
  const read = () => root.evaluate((html) => html.ownerDocument.querySelectorAll('#cv-pages > .page').length)
  let last = -1
  await expect
    .poll(
      async () => {
        const now = await read()
        const stable = now > 0 && now === last
        last = now
        return stable
      },
      { intervals: [300] },
    )
    .toBe(true)
  return last
}

/**
 * Önizleme iframe'indeki belgeyi ayrı bir sekmede Chromium'un PDF motoruyla
 * basar (sunucu yok). "PDF al" iframe'in kendisini yazdırdığı için belge
 * olduğu gibi kopyalanır; kimlikli öğelerin açık gölge kökleri de (ör.
 * şablon geçişindeki #cv-ghost) yeniden takılır — outerHTML bunları atlar.
 */
export async function renderPreviewPdf(page: Page): Promise<Buffer> {
  const { html, shadows } = await preview(page)
    .locator('html')
    .evaluate((el) => ({
      html: el.outerHTML,
      shadows: Array.from(el.querySelectorAll('[id]'))
        .filter((n) => n.shadowRoot)
        .map((n) => ({ id: n.id, html: n.shadowRoot!.innerHTML })),
    }))
  const printer = await page.context().newPage()
  try {
    // Aynı köken: /fonts/... gibi göreli yazı tipi adresleri çözülsün.
    await printer.goto('/fonts/README.txt')
    await printer.setContent(html, { waitUntil: 'load' })
    await printer.evaluate(async (list) => {
      for (const { id, html } of list) {
        const host = document.getElementById(id)
        if (host && !host.shadowRoot) host.attachShadow({ mode: 'open' }).innerHTML = html
      }
      void document.body.offsetHeight
      await document.fonts.ready
    }, shadows)
    await printer.emulateMedia({ media: 'print' })
    return await printer.pdf({ preferCSSPageSize: true, printBackground: true })
  } finally {
    await printer.close()
  }
}

export interface PdfItem {
  str: string
  x: number
  y: number
  width: number
  /** Yazı boyu (pt): metin dönüşümünün ölçeği */
  size: number
}

export interface PdfPage {
  width: number
  height: number
  /** İçerik akışı sırasıyla (ATS ayrıştırıcılarının çoğu bu sırayı okur) */
  items: PdfItem[]
}

/** PDF'teki metni sayfa sayfa, içerik akışı sırasıyla çıkarır (pdf.js). */
export async function pdfText(pdf: Buffer): Promise<PdfPage[]> {
  const task = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  })
  const pages: PdfPage[] = []
  try {
    const doc = await task.promise
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n)
      const [, , width, height] = p.view
      const content = await p.getTextContent()
      const items: PdfItem[] = []
      for (const item of content.items) {
        if (!('str' in item) || item.str === '') continue
        const [a, b] = item.transform as number[]
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, size: Math.hypot(a, b) || item.height || 10 })
      }
      pages.push({ width, height, items })
    }
  } finally {
    await task.destroy()
  }
  return pages
}

/**
 * Parçaları geometriye göre birleştirir: aynı satırda bitişik parçalar
 * (ör. yazı tipi alt kümesi değişince bölünen "Geli" + "ş" + "tirici")
 * boşluksuz, satır değişince ya da arada boşluk varsa boşlukla.
 *
 * Eşikler yazı boyuna oranlıdır: dev boyda (Manşet'in 70 pt adı) harf aralığı ve
 * kerning yüzünden bitişik parçalar arasında birkaç pt'lik açıklık olur; sabit 1 pt
 * eşik orada kelimenin içine boşluk koyardı ("Ay ş e"). Kelime boşluğu ~0.25em.
 */
export const JOIN_GAP_EM = 0.12

export function joinItems(items: PdfItem[]): string {
  let out = ''
  let prev: PdfItem | null = null
  for (const item of items) {
    if (prev) {
      const size = Math.max(prev.size, item.size)
      const sameLine = Math.abs(item.y - prev.y) < Math.max(1.5, size * 0.3)
      const gap = item.x - (prev.x + prev.width)
      const limit = Math.max(1, size * JOIN_GAP_EM)
      if (!sameLine || gap > limit || gap < -limit) out += ' '
    }
    out += item.str
    prev = item
  }
  return normalize(out)
}

/** Bütün sayfaların metni, içerik akışı sırasıyla. */
export function flowText(pages: PdfPage[]): string {
  return normalize(pages.map((p) => joinItems(p.items)).join(' '))
}

/**
 * Bir sütunun metni yukarıdan aşağıya (y azalan; aynı satırda x artan)
 * okuma sırasıyla; sayfalar sırayla eklenir.
 */
export function ySortedText(pages: PdfPage[], inColumn: (item: PdfItem, page: PdfPage) => boolean): string {
  return normalize(
    pages
      .map((page) => {
        const items = page.items.filter((i) => inColumn(i, page))
        items.sort((a, b) => (Math.abs(a.y - b.y) > 1.5 ? b.y - a.y : a.x - b.x))
        return joinItems(items)
      })
      .join(' '),
  )
}

export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Boşluksuz biçim: harf aralığı yüzünden araya giren boşluklardan bağımsız karşılaştırma için. */
export const squash = (text: string) => text.replace(/\s+/g, '')

/** `needles` metinde verilen sırayla geçmiyorsa ilk sorunu döndürür. */
export function orderProblem(haystack: string, needles: string[]): string | null {
  let from = 0
  for (const needle of needles) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) {
      const anywhere = haystack.indexOf(needle)
      return anywhere === -1
        ? `bulunamadı: "${needle}"`
        : `sıra bozuk: "${needle}" ancak konum ${anywhere}'de, beklenen ${from} sonrası`
    }
    from = at + needle.length
  }
  return null
}

/** Ham PDF'teki yazı tiplerinin özeti (Skia nesne akışı kullanmaz; sözlükler düz metin). */
export function fontReport(pdf: Buffer) {
  const raw = pdf.toString('latin1')
  const objects = new Map<string, string>()
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(m[1], m[2])
  const fonts = [...objects.values()].filter((body) => /\/Type\s*\/Font\b/.test(body))
  const subtypes = fonts.map((body) => /\/Subtype\s*\/(\w+)/.exec(body)?.[1] ?? '?')
  const descriptorOf = (body: string) => /\/FontDescriptor\s+(\d+) 0 R/.exec(body)?.[1]
  // Gerçek (yeniden kullanılabilir) yazı tipi programı gömülü olması gereken yazı tipleri:
  // Type0'ın alt CID yazı tipi, TrueType, Type1. Type3'te glifler zaten PDF içinde çizimdir.
  const needsProgram = fonts.filter((body) => /\/Subtype\s*\/(CIDFontType[02]|TrueType|Type1|MMType1)\b/.test(body))
  const notEmbedded = needsProgram.filter((body) => {
    const d = descriptorOf(body)
    return !d || !/\/FontFile[23]?\b/.test(objects.get(d) ?? '')
  })
  const textFonts = fonts.filter((body) => /\/Subtype\s*\/(Type0|Type3|TrueType|Type1)\b/.test(body))
  return {
    subtypes,
    type3: subtypes.filter((s) => s === 'Type3').length,
    fontFiles: (raw.match(/\/FontFile[23]\b/g) ?? []).length,
    notEmbedded: notEmbedded.length,
    withoutToUnicode: textFonts.filter((body) => !/\/ToUnicode\b/.test(body)).length,
  }
}
