/**
 * "ATS'nin gördüğü metin" (kendi CV'n için): sayfalanmış önizlemeden, PDF'e
 * basılınca okunacağı biçimde metin.
 *
 * Sunucu olmadan tarayıcıda PDF üretilemiyor (yazdır penceresi dosyayı bize
 * vermez); bu yüzden PDF'in kendisi değil, onu basan DOM okunur. Bu yaklaşım
 * baskıya en yakın olanıdır çünkü:
 * - Önizleme = PDF: aynı iframe, aynı CSS ve aynı sayfa bölünmesi basılır.
 * - Chromium PDF'e metni boyama sırasıyla, yani DOM sırasıyla yazar (ATS
 *   kuralı: `order`, `position:absolute`, `*-reverse` yok). ATS'lerin çoğu da
 *   bu akış sırasını okur (e2e/ats.spec.ts aynı sırayı PDF metninden denetler).
 * - Basılan şey yazılan değil görünen metindir: `text-transform` (Türkçe
 *   büyük İ dahil) uygulanır, görünmeyen ya da baskıda gizli öğe (yer tutucu)
 *   atlanır.
 * - Satırlar, yüklenen PDF'te olduğu gibi (src/ai/pdfText.ts) konumdan kurulur:
 *   aynı satırdaki parçalar birleşir, aradaki geniş boşluk "   " olur
 *   (unvan ... tarih); madde başları "• " ile işaretlenir.
 *
 * Yalnız düzen (layout) bilgisi okunur; bu yüzden jsdom'da boş döner.
 */

export interface ReadingLine {
  text: string
  /** 1'den başlar */
  page: number
}

export interface ReadingText {
  pageCount: number
  /** Okuma sırasıyla satırlar */
  lines: ReadingLine[]
}

/** Aynı satırdaki geniş boşluk (unvan ... tarih); satır kurulurken "   " olur. Metinde sekme kalmaz (boşluklar tekleştirilir). */
const GAP = '\t'

function isMarked(view: Window, li: Element): boolean {
  const style = view.getComputedStyle(li)
  return style.display.includes('list-item') && style.listStyleType !== 'none'
}

interface Row {
  parts: string[]
  top: number
  bottom: number
  right: number
  size: number
  col: Element | null
}

function transform(text: string, mode: string, lang: string): string {
  const locale = lang || undefined
  if (mode === 'uppercase') return text.toLocaleUpperCase(locale)
  if (mode === 'lowercase') return text.toLocaleLowerCase(locale)
  if (mode === 'capitalize') return text.replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toLocaleUpperCase(locale))
  return text
}

/** İki dikdörtgen aynı satırda mı: dikey örtüşme, kısa olanın yarısından fazla. */
function sameRow(row: Row, rect: DOMRect): boolean {
  const overlap = Math.min(row.bottom, rect.bottom) - Math.max(row.top, rect.top)
  return overlap > Math.min(row.bottom - row.top, rect.height) * 0.5
}

export function readingText(doc: Document): ReadingText {
  const view = doc.defaultView
  const lang = doc.documentElement.lang
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('#cv-pages > .page'))
  const lines: ReadingLine[] = []
  const seenLi = new Set<Element>()

  pages.forEach((pageEl, index) => {
    const page = index + 1
    let row: Row | null = null
    const flush = () => {
      // Parçalardaki boşluklar zaten tekli; GAP sütun gibi geniş boşluğu işaretler.
      const text = row?.parts.join('').replace(/ +/g, ' ').replace(/ ?\t ?/g, '   ').trim()
      if (text) lines.push({ text, page })
      row = null
    }
    const walker = doc.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const el = node.parentElement
      if (!el || !view || el.closest('.ph')) continue
      const style = view.getComputedStyle(el)
      if (style.visibility !== 'visible') continue
      const range = doc.createRange()
      range.selectNodeContents(node)
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
      if (!rects.length) continue
      const raw = transform(node.data.replace(/\s+/g, ' '), style.textTransform, el.closest('[lang]')?.getAttribute('lang') ?? lang)
      const first = rects[0]
      const last = rects[rects.length - 1]
      const size = parseFloat(style.fontSize) || 12
      const col = el.closest('.col')
      const current = row as Row | null
      if (current && current.col === col && sameRow(current, first)) {
        // Aynı satır: bitişikse olduğu gibi, geniş boşluk varsa (unvan ... tarih) "   " ile.
        const gap = first.left - current.right
        current.parts.push(gap > Math.max(size, current.size) * 1.2 ? `${GAP}${raw}` : raw)
        current.top = last.top
        current.bottom = last.bottom
        current.right = last.right
        current.size = size
        continue
      }
      if (!raw.trim()) continue
      flush()
      // Madde işareti (::marker) metin olarak basılır; iletişim listesi gibi işaretsiz listeler değil.
      const li = el.closest('li')
      const marked = li && !seenLi.has(li) && isMarked(view, li)
      if (li) seenLi.add(li)
      const bullet = marked ? '• ' : ''
      row = { parts: [bullet, raw], top: last.top, bottom: last.bottom, right: last.right, size, col }
    }
    flush()
  })
  return { pageCount: pages.length, lines }
}
