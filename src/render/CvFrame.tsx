import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Cv } from '@/cv/schema'
import type { SuggestionMap } from './CvMarkup'
import { FONTS } from './fonts'
import { paginate, type PaginateResult } from './paginate'
import { cvStyles, documentShell, renderCvSource } from './renderCv'

/** A4 genişliği CSS pikseli olarak (210mm @ 96dpi) */
export const PAGE_WIDTH_PX = 793.7
export const PAGE_HEIGHT_PX = 1122.5

export interface CvFrameTarget {
  itemId: string | null
  sectionId: string | null
  personal: boolean
}

export interface CvFrameHandle {
  print: (title: string) => Promise<void>
}

interface Props {
  cv: Cv
  suggestions?: SuggestionMap
  /** Sayfa ölçeği; "fit" kapsayıcı genişliğine sığdırır */
  scale: number | 'fit'
  /** Yalnız ilk sayfa (küçük resimler için) */
  firstPageOnly?: boolean
  interactive?: boolean
  placeholders?: boolean
  emptyHint?: string
  focusedItemId?: string | null
  onResult?: (result: PaginateResult) => void
  onTargetClick?: (target: CvFrameTarget) => void
  onScaleChange?: (scale: number) => void
  className?: string
  title?: string
  /** "fit" ölçeğinde kenarlarda bırakılacak toplam boşluk (px) */
  fitPadding?: number
  /** "fit" ölçeğinin üst sınırı (editörde sayfa gerçek boyutundan büyümesin) */
  maxFitScale?: number
}

/**
 * CV'yi izole bir iframe'de çizer. Şablon CSS'i site stilinden etkilenmez;
 * yazdırma da bu iframe'den yapılır (önizleme = PDF).
 */
export const CvFrame = forwardRef<CvFrameHandle, Props>(function CvFrame(
  {
    cv,
    suggestions,
    scale,
    firstPageOnly = false,
    interactive = false,
    placeholders = false,
    emptyHint,
    focusedItemId = null,
    onResult,
    onTargetClick,
    onScaleChange,
    className,
    title,
    fitPadding = 48,
    maxFitScale = 4,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Her yüklemede artar; iframe yeniden bağlanırsa içerik yeniden çizilir.
  const [loadCount, setLoadCount] = useState(0)
  const ready = loadCount > 0
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT_PX)
  const [containerWidth, setContainerWidth] = useState(0)
  const pageCountRef = useRef(0)
  const renderToken = useRef(0)
  const callbacks = useRef({ onResult, onTargetClick })
  callbacks.current = { onResult, onTargetClick }

  // İskelet bir kez yazılır; içerik sonradan değişir (titreme olmasın diye).
  const srcDoc = useMemo(() => documentShell({ lang: cv.language, title }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || scale !== 'fit') return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [scale])

  const effectiveScale =
    scale === 'fit'
      ? containerWidth > 0
        ? Math.min(maxFitScale, Math.max(0.1, (containerWidth - fitPadding) / PAGE_WIDTH_PX))
        : 0
      : scale

  useEffect(() => {
    if (effectiveScale > 0) onScaleChange?.(effectiveScale)
  }, [effectiveScale, onScaleChange])

  const render = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.getElementById('cv-source')) return
    const token = ++renderToken.current
    doc.documentElement.lang = cv.language
    doc.body.classList.toggle('interactive', interactive)
    const styles = cvStyles(cv)
    const styleEl = doc.getElementById('cv-styles')!
    if (styleEl.textContent !== styles) styleEl.textContent = styles
    doc.getElementById('cv-host')!.textContent = firstPageOnly
      ? // Yalnız ilk sayfa görünür: iframe bir sayfa yüksekliğinde, gerisi taşar. Sayfaları gizlemek
        // ölçümü bozardı (gizli sayfada her şey 0 yükseklik).
        'html,body{overflow:hidden}#cv-pages{gap:0}'
      : '#cv-pages{--sheet-gap:24px;--sheet-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 24px rgba(0,0,0,.08)}'

    // Yazı tipleri ölçümden önce yüklenmeli; yoksa satır kırılımı sonradan değişir.
    const family = FONTS[cv.template.font].stack.split(',')[0]
    const sample = 'Aa ğüşıöçĞÜŞİÖÇ'
    await Promise.all(
      ['400', '600', '700', 'italic 400'].map((w) => doc.fonts.load(`${w} 12px ${family}`, sample).catch(() => [])),
    )
    if (token !== renderToken.current) return

    doc.getElementById('cv-source')!.innerHTML = renderCvSource(cv, { suggestions, placeholders, emptyHint })
    const result = paginate(doc, { previousPageCount: pageCountRef.current })
    pageCountRef.current = result.pageCount
    if (focusedItemId) {
      doc
        .querySelectorAll(`[data-item-id="${CSS.escape(focusedItemId)}"]`)
        .forEach((el) => el.classList.add('is-focused'))
    }
    const pagesEl = doc.getElementById('cv-pages')!
    setContentHeight(firstPageOnly ? PAGE_HEIGHT_PX : pagesEl.scrollHeight)
    callbacks.current.onResult?.(result)
  }, [cv, suggestions, interactive, placeholders, emptyHint, focusedItemId, firstPageOnly])

  useEffect(() => {
    if (!ready) return
    const frame = requestAnimationFrame(() => void render())
    return () => cancelAnimationFrame(frame)
  }, [ready, loadCount, render])

  // Tıklanan kaydı editöre bildir.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!ready || !doc || !interactive) return
    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element).closest?.('[data-item-id], [data-target="personal"], [data-section-id]')
      if (el instanceof HTMLAnchorElement || (event.target as Element).closest?.('a')) event.preventDefault()
      if (!el) return
      const h = el as HTMLElement
      callbacks.current.onTargetClick?.({
        itemId: h.dataset.itemId ?? null,
        sectionId: h.dataset.sectionId ?? null,
        personal: h.dataset.target === 'personal',
      })
    }
    doc.addEventListener('click', onClick)
    return () => doc.removeEventListener('click', onClick)
  }, [ready, loadCount, interactive])

  useImperativeHandle(
    ref,
    () => ({
      async print(printTitle: string) {
        const win = iframeRef.current?.contentWindow
        const doc = iframeRef.current?.contentDocument
        if (!win || !doc) return
        await render()
        const previousTitle = document.title
        doc.title = printTitle
        document.title = printTitle
        doc.body.classList.remove('interactive')
        try {
          win.focus()
          win.print()
        } finally {
          document.title = previousTitle
          doc.body.classList.toggle('interactive', interactive)
        }
      },
    }),
    [render, interactive],
  )

  return (
    <div ref={containerRef} className={className}>
      {effectiveScale > 0 && (
        <div
          style={{
            width: PAGE_WIDTH_PX * effectiveScale,
            height: contentHeight * effectiveScale,
            margin: '0 auto',
            position: 'relative',
          }}
        >
          <iframe
            ref={iframeRef}
            title={title ?? 'CV önizleme'}
            srcDoc={srcDoc}
            onLoad={() => setLoadCount((n) => n + 1)}
            // Betik çalışmaz (içerik yalnız dışarıdan yazılır); yazdırmak için allow-modals.
            sandbox="allow-same-origin allow-modals"
            tabIndex={interactive ? 0 : -1}
            style={{
              width: PAGE_WIDTH_PX,
              height: contentHeight,
              border: 0,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              inset: 0,
              background: 'transparent',
              colorScheme: 'light',
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          />
        </div>
      )}
    </div>
  )
})
