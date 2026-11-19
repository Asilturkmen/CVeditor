import { TriangleAlert } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Cv } from '@/cv/schema'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from '@/render/CvFrame'
import { shadowCopyOfPages } from '@/render/printMirror'
import { previewDocument, useCanvas } from '../canvas'

/** Sayfa küçük resminin genişliği (px); yükseklik A4 oranından. */
const THUMB_WIDTH = 152
const THUMB_SCALE = THUMB_WIDTH / PAGE_WIDTH_PX

/**
 * Bir sayfanın küçük resmi: canlı önizlemenin son çiziminin gölge kökte kopyası (yeniden sayfalama
 * yok; tuvaldekinin aynısı). Yalnız o sayfa görünür; vurgu ve parlama işaretleri temizlenir.
 */
function PageCopy({ index, drawn }: { index: number; drawn: number }) {
  const hostRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const host = hostRef.current
    const doc = previewDocument()
    if (!host || !doc) return
    const only = `#cv-pages>.page:not(:nth-child(${index + 1})){display:none}`
    if (!shadowCopyOfPages(doc, host, `#cv-pages{display:block;padding:0;gap:0}.page{box-shadow:none}${only}`)) return
    host.shadowRoot!.querySelectorAll('.is-focused, .sg-flash').forEach((el) => el.classList.remove('is-focused', 'sg-flash'))
  }, [index, drawn])
  return (
    <div
      ref={hostRef}
      aria-hidden
      inert
      style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left' }}
    />
  )
}

/** Sayfalar: her sayfanın küçük resmi ve numarası; tıklayınca tuval o sayfaya kayar. */
export function PagesRail({ cv }: { cv: Cv }) {
  const pageCount = useEditorUi((s) => s.pageCount)
  const oversized = useEditorUi((s) => s.oversized)
  const drawn = useCanvas((s) => s.drawn)
  const current = useCanvas((s) => s.currentPage)
  const goToPage = useCanvas((s) => s.goToPage)
  // Uzun kaydın bulunduğu sayfalar (önizlemede kesikli çerçeveli kayıtlar); her çizimden sonra okunur.
  const warnPages = useMemo(() => {
    void drawn
    void oversized
    const doc = previewDocument()
    const pages = doc ? Array.from(doc.querySelectorAll('#cv-pages > .page')) : []
    const found = new Set<number>()
    pages.forEach((page, i) => {
      if (page.querySelector('.overflow-warning')) found.add(i + 1)
    })
    return found
  }, [drawn, oversized])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1 pb-6">
      <p className="pb-3 text-callout text-fg-2">{m.page_count({ count: pageCount })}</p>
      <ol aria-label={m.rail_pages()} className="flex flex-col items-center gap-5">
        {Array.from({ length: pageCount }, (_, i) => {
          const page = i + 1
          const active = page === current
          const warn = warnPages.has(page)
          return (
            <li key={`${cv.id}-${page}`}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={warn ? `${m.rail_page_label({ page })}. ${m.rail_page_oversized()}` : m.rail_page_label({ page })}
                onClick={() => goToPage(page)}
                className="group flex flex-col items-center gap-2 rounded-md outline-offset-4"
              >
                <span
                  style={{ width: THUMB_WIDTH, height: Math.round(PAGE_HEIGHT_PX * THUMB_SCALE) }}
                  className={cn(
                    'block overflow-hidden rounded-xs bg-paper shadow-thumb transition-[box-shadow,translate] duration-150 ease-out',
                    active
                      ? 'ring-3 ring-accent ring-offset-3 ring-offset-window'
                      : 'group-hover:-translate-y-px group-hover:shadow-2 motion-reduce:group-hover:translate-y-0',
                  )}
                >
                  <PageCopy index={i} drawn={drawn} />
                </span>
                <span className="inline-flex items-center gap-1 text-callout text-fg tabular-nums">
                  {warn && <TriangleAlert aria-hidden className="size-3.5 text-warn" />}
                  {page}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
