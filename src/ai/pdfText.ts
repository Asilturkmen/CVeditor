/**
 * PDF'in metin katmanını tarayıcıda okur (pdfjs-dist). Dosya hiçbir yere
 * gönderilmez. İçe aktarma ve CV İnceleme bunu kullanır. pdfjs büyük olduğu
 * için yalnız gerektiğinde yüklenir.
 *
 * Satırlar konumdan kurulur (pdfjs'in parçaları değil): aynı yükseklikteki
 * parçalar birleşir, aradaki geniş boşluk "   " olur (unvan ... tarih).
 * İki sütunlu sayfada (Canva) sütunlar ayrı okunur, ad satırının bulunduğu
 * sütun önce gelir. Girintili satırlar (madde işareti metin olarak
 * basılmamış listeler) "• " ile işaretlenir.
 */

export interface PdfTextLine {
  text: string
  page: number
  /** Sayfanın solundan (pt) */
  x: number
  /** Sayfanın üstünden (pt) */
  y: number
  /** Yazı boyutu (pt); ad satırı tahmini için */
  size?: number
}

export interface PdfText {
  pageCount: number
  /** Okuma sırasıyla satırlar */
  lines: PdfTextLine[]
  /** Satırların "\n" ile birleşimi */
  text: string
  /** Sayfa genişliği (pt), ilk sayfadan */
  pageWidth: number
}

export type PdfTextErrorCode = 'not_pdf' | 'encrypted' | 'no_text' | 'unreadable' | 'too_long'

/** Okunacak en büyük PDF (içe aktarma ve CV İnceleme) */
export const MAX_PDF_BYTES = 20 * 1024 * 1024
/** Bir CV için makul üst sınır; daha uzun belge okunmaz (tarayıcı uzun süre meşgul kalmasın). */
export const MAX_PDF_PAGES = 30

export class PdfTextError extends Error {
  readonly code: PdfTextErrorCode
  constructor(message: string, code: PdfTextErrorCode) {
    super(message)
    this.code = code
  }
}

/** pdfjs'ten bağımsız metin parçası (test edilebilsin diye) */
export interface RawTextItem {
  str: string
  /** Sol kenar (pt) */
  x: number
  /** Üstten taban çizgisi (pt) */
  y: number
  width: number
  size: number
  hasEOL?: boolean
}

interface Segment {
  text: string
  x: number
  xEnd: number
  y: number
  size: number
  /** Akış sırası (aynı satırdaki parçaları akış sırasıyla birleştirmek için) */
  order: number
}

const BULLET_START = /^[•▪◦●■□➢►‣⁃∙◆◇✓✔→*-]/

/** Akıştaki parçalardan bölütler: aynı satırda ve yakın parçalar tek bölüt. */
function segmentsOf(items: RawTextItem[]): Segment[] {
  const out: Segment[] = []
  let cur: Segment | null = null
  let order = 0
  for (const item of items) {
    const str = item.str.replace(/[]/g, '•')
    if (!str.trim()) {
      if (item.hasEOL) cur = null
      continue
    }
    const size = item.size || 10
    if (cur) {
      const sameLine = Math.abs(item.y - cur.y) < Math.max(size, cur.size) * 0.5
      const gap = item.x - cur.xEnd
      if (sameLine && gap > -size * 0.5 && gap < size * 1.6) {
        const space = gap > size * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(str)
        cur.text += (space ? ' ' : '') + str
        cur.xEnd = Math.max(cur.xEnd, item.x + item.width)
        cur.size = Math.max(cur.size, size)
        if (item.hasEOL) cur = null
        continue
      }
    }
    cur = { text: str, x: item.x, xEnd: item.x + item.width, y: item.y, size, order: order++ }
    out.push(cur)
    if (item.hasEOL) cur = null
  }
  for (const s of out) s.text = s.text.replace(/\s+/g, ' ').trim()
  return out.filter((s) => s.text)
}

const sameRow = (a: Segment, b: Segment) => Math.abs(a.y - b.y) < Math.max(a.size, b.size) * 0.5

/**
 * İki sütun arasındaki boşluk: hiçbir bölütün kesmediği dikey bir çizgi.
 * Yalnız başlık bandı (sütunların üstündeki satırlar) kesebilir. Unvan/tarih
 * gibi aynı satırda duran sol-sağ parçalar sütun sayılmaz.
 */
function findGutter(segs: Segment[], width: number): { x: number; top: number } | null {
  if (segs.length < 8) return null
  let best: { x: number; top: number; score: number } | null = null
  for (let x = width * 0.2; x <= width * 0.8; x += 2) {
    const left = segs.filter((s) => s.xEnd <= x)
    const right = segs.filter((s) => s.x >= x)
    const crossing = segs.filter((s) => s.x < x && s.xEnd > x)
    if (left.length < 3 || right.length < 3) continue
    const top = Math.min(...left.map((s) => s.y), ...right.map((s) => s.y))
    if (crossing.some((s) => s.y >= top)) continue
    const words = (list: Segment[]) => list.filter((s) => s.text.split(' ').length >= 2).length
    if (words(left) < 3 || words(right) < 3) continue
    const aligned = right.filter((r) => left.some((l) => sameRow(l, r))).length
    if (aligned / right.length > 0.5) continue
    const score = Math.min(left.length, right.length)
    if (!best || score > best.score) best = { x, top, score }
  }
  return best && { x: best.x, top: best.top }
}

/**
 * Aynı satırdaki bölütleri birleştirir (geniş boşluk "   " olur). Sütun
 * içinde yukarıdan aşağı sıralanır; sütun bulunamadıysa akış sırası korunur
 * (yükseklikle sıralamak ayrılamamış sütunları satır satır karıştırırdı).
 */
function rowsOf(segs: Segment[], byPosition: boolean): Segment[] {
  const sorted = byPosition ? [...segs].sort((a, b) => a.y - b.y || a.x - b.x) : segs
  const rows: Segment[][] = []
  for (const s of sorted) {
    const row = rows[rows.length - 1]
    if (row && sameRow(row[0], s)) row.push(s)
    else rows.push([s])
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x)
    return {
      ...row[0],
      text: row.map((s) => s.text).join('   '),
      xEnd: Math.max(...row.map((s) => s.xEnd)),
      size: Math.max(...row.map((s) => s.size)),
    }
  })
}

/** Girintili satırlar madde olarak işaretlenir (yalnız sola yaslı bir tabana göre). */
function markIndents(rows: Segment[]): string[] {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(Math.round(r.x), (counts.get(Math.round(r.x)) ?? 0) + 1)
  const isBase = (x: number) => [...counts].some(([bx, n]) => n >= 3 && Math.abs(bx - x) <= 1)
  let base: Segment | null = null
  return rows.map((r) => {
    const indent = base ? r.x - base.x : 0
    const near = base ? r.y - base.y < Math.max(r.size, base.size) * 8 : false
    if (base && near && indent >= 4 && indent <= 30 && isBase(base.x) && !BULLET_START.test(r.text)) {
      return `• ${r.text}`
    }
    base = r
    return r.text
  })
}

/** Bir sayfanın parçalarından okuma sırasıyla satırlar. */
export function buildPageLines(items: RawTextItem[], page: number, width: number): PdfTextLine[] {
  const segs = segmentsOf(items)
  const gutter = findGutter(segs, width)
  let blocks: Segment[][]
  const byPosition = !!gutter
  if (gutter) {
    const header = segs.filter((s) => s.y < gutter.top && s.x < gutter.x && s.xEnd > gutter.x)
    const left = segs.filter((s) => !header.includes(s) && s.xEnd <= gutter.x)
    const right = segs.filter((s) => !header.includes(s) && s.x >= gutter.x)
    // Ad (en büyük yazı) hangi sütundaysa o önce; eşitse soldaki
    const biggest = (list: Segment[]) => Math.max(0, ...list.map((s) => s.size))
    const columns = biggest(right) > biggest(left) + 0.5 ? [right, left] : [left, right]
    blocks = [header, ...columns]
  } else blocks = [segs]
  const lines: PdfTextLine[] = []
  for (const block of blocks) {
    const rows = rowsOf(block, byPosition)
    const texts = markIndents(rows)
    rows.forEach((r, i) => lines.push({ text: texts[i], page, x: r.x, y: r.y, size: r.size }))
  }
  return lines
}

/** İlk sayfadaki en büyük yazılı satır (genellikle ad) */
export function largestLine(lines: PdfTextLine[]): string | null {
  const first = lines.filter((l) => l.page === 1 && l.size)
  if (first.length === 0) return null
  const max = Math.max(...first.map((l) => l.size!))
  const second = Math.max(0, ...first.filter((l) => l.size! < max).map((l) => l.size!))
  // Belirgin biçimde büyük değilse tahmin yapma
  if (second === 0 || max < second * 1.25) return null
  return first.find((l) => l.size === max)!.text
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export interface ExtractOptions {
  /** Her sayfadan önce denetlenir; iptal edilirse okuma durur ve iptal nedeni fırlatılır. */
  signal?: AbortSignal
  /** Varsayılan MAX_PDF_PAGES; aşılırsa 'too_long' */
  maxPages?: number
}

export async function extractPdfText(data: ArrayBuffer, options: ExtractOptions = {}): Promise<PdfText> {
  const { signal, maxPages = MAX_PDF_PAGES } = options
  signal?.throwIfAborted()
  const bytes = new Uint8Array(data)
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new PdfTextError('Bu dosya bir PDF değil.', 'not_pdf')
  }
  const pdfjs = await loadPdfjs()
  signal?.throwIfAborted()
  const task = pdfjs.getDocument({ data: bytes })
  const onAbort = () => void task.destroy()
  signal?.addEventListener('abort', onAbort, { once: true })
  let doc
  try {
    doc = await task.promise
  } catch (error) {
    signal?.removeEventListener('abort', onAbort)
    signal?.throwIfAborted()
    const name = (error as { name?: string }).name
    if (name === 'PasswordException') throw new PdfTextError('PDF parolalı; parolasız bir kopyasını dene.', 'encrypted')
    throw new PdfTextError('PDF okunamadı.', 'unreadable')
  }
  if (doc.numPages > maxPages) {
    signal?.removeEventListener('abort', onAbort)
    await task.destroy()
    throw new PdfTextError(`PDF ${maxPages} sayfadan uzun.`, 'too_long')
  }

  const lines: PdfTextLine[] = []
  let pageWidth = 595
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      signal?.throwIfAborted()
      const page = await doc.getPage(p)
      const viewport = page.getViewport({ scale: 1 })
      if (p === 1) pageWidth = viewport.width
      const content = await page.getTextContent()
      const items: RawTextItem[] = []
      for (const raw of content.items) {
        if (!('str' in raw)) continue
        items.push({
          str: raw.str,
          x: raw.transform[4],
          y: viewport.height - raw.transform[5],
          width: raw.width,
          size: Math.hypot(raw.transform[0], raw.transform[1]) || raw.height,
          hasEOL: raw.hasEOL,
        })
      }
      lines.push(...buildPageLines(items, p, viewport.width))
    }
  } catch {
    // İptal, okuma hatası sayılmaz: çağıran iptal nedenini alır.
    signal?.throwIfAborted()
    throw new PdfTextError('PDF okunamadı.', 'unreadable')
  } finally {
    signal?.removeEventListener('abort', onAbort)
    await task.destroy()
  }
  const pageCount = doc.numPages

  const text = lines.map((l) => l.text).join('\n')
  if (text.replace(/[\s•]/g, '').length < 20) {
    throw new PdfTextError(
      'Bu PDF\'te seçilebilir metin yok; büyük olasılıkla görsel olarak kaydedilmiş. Metin olarak dışa aktarılmış bir PDF dene.',
      'no_text',
    )
  }
  return { pageCount, lines, text, pageWidth }
}
