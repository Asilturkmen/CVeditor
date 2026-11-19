import { toast, useToasts } from '@/components/ui/toast'
import type { Cv } from '@/cv/schema'
import { m } from '@/paraglide/messages'
import type { OversizedBlock } from '@/render/paginate'

/**
 * "PDF al": sunucu varsa (`GET /api/health` → `{ ok: true, pdf: true }`) CV verisi `POST /api/pdf`'e
 * gider ve dönen PDF indirilir (önizlemeyle aynı çizim paketi, aynı yazı tipleri; sunucu Chromium'u).
 * Sunucu yoksa (yerel `npm run dev`, statik barındırma) ya da PDF'i üretemezse önizlemenin yazdır
 * penceresi açılır.
 *
 * Bir sayfadan uzun kayıt: sunucu kullanıcı onayı olmadan basmaz (409). Onay penceresi açıldıktan
 * sonra `allowSplit: true` ile yeniden çağrılır.
 */

export type PdfExportOutcome =
  | { kind: 'downloaded' }
  | { kind: 'printed' }
  /** Sunucu bir sayfadan uzun kayıt buldu: onay penceresi bu kayıtlarla açılmalı */
  | { kind: 'oversized'; oversized: OversizedBlock[] }
  | { kind: 'failed' }

export interface PdfExportOptions {
  /** Kullanıcı uzun kayıtların bölünmesini onayladı */
  allowSplit: boolean
  /** Yedek yol: önizlemenin yazdır penceresi (CvFrame.print) */
  print: () => Promise<void>
}

const HEALTH_TIMEOUT_MS = 2500
const PDF_TIMEOUT_MS = 60_000
/** Sunucu bulunamadıysa bu süre sonra yeniden sorulur (sunucu sonradan açılmış olabilir) */
const RECHECK_MS = 30_000

let health: { at: number; available: Promise<boolean> } | null = null

async function fetchWithTimeout(input: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkServer(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout('/api/health', { cache: 'no-store', headers: { Accept: 'application/json' } }, HEALTH_TIMEOUT_MS)
    // Sunucusuz geliştirme sunucusu bilinmeyen yollara index.html döndürebilir: JSON ve alan şart.
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false
    const body = (await response.json()) as { ok?: unknown; pdf?: unknown }
    return body.ok === true && body.pdf === true
  } catch {
    return false
  }
}

/** PDF sunucusu var mı? Sonuç saklanır; yoksa bir süre sonra yeniden sorulur. */
export function pdfServerAvailable(now = Date.now()): Promise<boolean> {
  if (!health || now - health.at > RECHECK_MS) {
    const available = checkServer()
    health = { at: now, available }
    void available.then((ok) => {
      // Sunucu bulunduysa sonuç oturum boyunca geçerli; bulunamadıysa RECHECK_MS sonra yeniden.
      if (ok && health?.available === available) health = { at: Number.POSITIVE_INFINITY, available }
    })
  }
  return health.available
}

/** Testler için */
export function resetPdfServerCache() {
  health = null
}

/** Content-Disposition'dan dosya adı (önce RFC 5987 `filename*`, sonra `filename`) */
export function dispositionFileName(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      // bozuk kodlama: düz ada düş
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header)
  return plain ? plain[1].trim() : null
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

type ServerResult = { kind: 'downloaded' } | { kind: 'oversized'; oversized: OversizedBlock[] } | { kind: 'error' }

async function downloadFromServer(cv: Cv, allowSplit: boolean): Promise<ServerResult> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      `/api/pdf${allowSplit ? '?allowSplit=1' : ''}`,
      { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cv) },
      PDF_TIMEOUT_MS,
    )
  } catch {
    return { kind: 'error' }
  }
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as { items?: { sectionId: string | null; itemId: string | null }[] } | null
    const oversized = (body?.items ?? []).map((i) => ({ sectionId: i.sectionId ?? null, itemId: i.itemId ?? null }))
    return { kind: 'oversized', oversized }
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) return { kind: 'error' }
  const blob = await response.blob().catch(() => null)
  if (!blob) return { kind: 'error' }
  saveBlob(blob, dispositionFileName(response.headers.get('content-disposition')) ?? 'CV.pdf')
  return { kind: 'downloaded' }
}

async function printFallback(print: () => Promise<void>): Promise<PdfExportOutcome> {
  try {
    await print()
    return { kind: 'printed' }
  } catch {
    toast({ message: m.pdf_failed(), tone: 'error' })
    return { kind: 'failed' }
  }
}

let busy = false

export async function exportPdf(cv: Cv, options: PdfExportOptions): Promise<PdfExportOutcome> {
  if (busy) return { kind: 'failed' }
  busy = true
  try {
    if (!(await pdfServerAvailable())) return await printFallback(options.print)
    const progress = toast({ message: m.pdf_generating(), duration: Number.POSITIVE_INFINITY })
    let result: ServerResult
    try {
      result = await downloadFromServer(cv, options.allowSplit)
    } finally {
      useToasts.getState().dismiss(progress)
    }
    if (result.kind === 'error') {
      toast({ message: m.pdf_server_fallback() })
      return await printFallback(options.print)
    }
    return result
  } finally {
    busy = false
  }
}
