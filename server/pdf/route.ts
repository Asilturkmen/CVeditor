import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { migrateCv } from '@/cv/migrate'
import { isSafePhoto } from '@/cv/photo'
import type { AnyItem, Cv } from '@/cv/schema'
import { itemLabel } from '@/features/editor/labels'
import type { OversizedBlock } from '@/render/paginate'
import type { ServerConfig } from '../config'
import { clientIp, RateLimiter, tooMany } from '../rateLimit'
import { originGuard } from '../security'
import type { SharedBrowser } from './browser'
import { contentDisposition, pdfFileName } from './filename'
import { pdfBaseName } from '@/cv/fileName'
import { BusyError, JobQueue, JobTimeoutError } from './queue'
import { cvRenderInput, renderPdf, type RenderOptions } from './render'

export interface PdfRouteDeps {
  config: ServerConfig
  browser: SharedBrowser
  /** Testler için: her çizimin gördüğü istekler */
  onRequest?: RenderOptions['onRequest']
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** 409 yanıtındaki kayıtlar: kimlikler (istemci kendi dilinde adlandırır) + kısa ad */
export function oversizedItems(cv: Cv, oversized: OversizedBlock[]) {
  return oversized.map((o) => {
    const section = cv.sections.find((s) => s.id === o.sectionId)
    const item = section ? (section.items as AnyItem[]).find((i) => i.id === o.itemId) : undefined
    return { sectionId: o.sectionId, itemId: o.itemId, label: section && item ? itemLabel(section.type, item) || null : null }
  })
}

/**
 * POST /api/pdf — gövde: CV JSON (yerel kayıttaki biçim; eski şema sürümü göçle yükseltilir).
 *   200 application/pdf (Content-Disposition: <CV adı>.pdf)
 *   400 invalid_json | invalid_cv | invalid_photo · 403 başka köken · 413 gövde büyük
 *   409 oversized { items } — bir sayfadan uzun kayıt var; kullanıcı onaylarsa `?allowSplit=1`
 *   429 IP sınırı · 503 sıra dolu · 504 süre doldu · 500 çizim hatası
 */
export function pdfRoutes({ config, browser, onRequest }: PdfRouteDeps) {
  const app = new Hono()
  const queue = new JobQueue(config.pdf.concurrency, config.pdf.queueLimit)
  const limiter = new RateLimiter(config.pdf.ratePerMinute, 60_000)

  app.post(
    '/',
    originGuard(config.publicOrigin, false),
    async (c, next) => {
      const retry = limiter.hit(clientIp(c, config.trustProxy))
      return retry === null ? next() : tooMany(c, retry)
    },
    bodyLimit({ maxSize: config.pdf.maxBodyBytes, onError: (c) => c.json({ error: 'too_large' }, 413) }),
    async (c) => {
      let raw: unknown
      try {
        raw = await c.req.json()
      } catch {
        return c.json({ error: 'invalid_json' }, 400)
      }
      // Fotoğraf yalnız güvenli data: adresi olabilir (göç güvensizini sessizce atardı; burada açıkça reddedilir).
      if (isRecord(raw) && isRecord(raw.personal) && raw.personal.photo != null && !isSafePhoto(raw.personal.photo)) {
        return c.json({ error: 'invalid_photo' }, 400)
      }
      let cv: Cv
      try {
        cv = migrateCv(raw)
      } catch {
        return c.json({ error: 'invalid_cv' }, 400)
      }
      const allowSplit = c.req.query('allowSplit') === '1'
      const started = Date.now()
      try {
        const input = cvRenderInput(cv)
        const outcome = await queue.run(
          async (signal) => renderPdf(await browser.get(), input, { fontsDir: config.fontsDir, allowSplit, signal, onRequest }),
          config.pdf.timeoutMs,
        )
        if (outcome.kind === 'oversized') return c.json({ error: 'oversized', items: oversizedItems(cv, outcome.oversized) }, 409)
        console.info(`[pdf] ${outcome.result.pageCount} sayfa, ${outcome.pdf.length} bayt, ${Date.now() - started} ms`)
        return c.body(new Uint8Array(outcome.pdf), 200, {
          'Content-Type': 'application/pdf',
          // Yazdır penceresiyle aynı ad: "Ad_Soyad_CV_tr.pdf"
          'Content-Disposition': contentDisposition(pdfFileName(pdfBaseName(cv))),
          'Content-Length': String(outcome.pdf.length),
          'X-CV-Pages': String(outcome.result.pageCount),
          'Cache-Control': 'no-store',
        })
      } catch (error) {
        if (error instanceof BusyError) {
          c.header('Retry-After', '5')
          return c.json({ error: 'busy' }, 503)
        }
        if (error instanceof JobTimeoutError) return c.json({ error: 'timeout' }, 504)
        // CV içeriği günlüğe yazılmaz; yalnız hata.
        console.error('[pdf] çizim hatası:', error instanceof Error ? error.message : error)
        return c.json({ error: 'render_failed' }, 500)
      }
    },
  )

  return app
}
