import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Cv } from '@/cv/schema'
import type { SuggestionMap } from './CvMarkup'
import { FONTS } from './fonts'
import { paginate, type PaginateResult } from './paginate'
import { createRenderGate } from './renderGate'
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
  /** Kısa süre parlayacak kayıtlar (öneri kabulünden sonra); nonce her istekte artar */
  flash?: { ids: string[]; nonce: number } | null
  /** Değişince eski görünüm yenisinin üstünde solar (şablon/sütun geçişi) */
  crossfadeKey?: string
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
    flash = null,
    crossfadeKey,
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
  const [gate] = useState(createRenderGate)
  const callbacks = useRef({ onResult, onTargetClick })
  callbacks.current = { onResult, onTargetClick }
  // Vurgu ve parlama yeniden çizim gerektirmez; her çizimden sonra da yeniden uygulanır.
  const marks = useRef({ focusedItemId, flash, flashDone: 0 })
  marks.current.focusedItemId = focusedItemId
  marks.current.flash = flash
  const lastCrossfadeKey = useRef(crossfadeKey)

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

  const draw = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.getElementById('cv-source')) return
    const token = gate.begin()
    if (crossfadeKey !== lastCrossfadeKey.current) {
      lastCrossfadeKey.current = crossfadeKey
      snapshotForCrossfade(doc)
    }
    doc.documentElement.lang = cv.language
    doc.body.classList.toggle('interactive', interactive)
    const styles = cvStyles(cv)
    const styleEl = doc.getElementById('cv-styles')!
    if (styleEl.textContent !== styles) styleEl.textContent = styles
    doc.getElementById('cv-host')!.textContent = firstPageOnly
      ? // Yalnız ilk sayfa görünür: iframe bir sayfa yüksekliğinde, gerisi taşar. Sayfaları gizlemek
        // ölçümü bozardı (gizli sayfada her şey 0 yükseklik).
        'html,body{overflow:hidden}#cv-pages{gap:0}.overflow-warning{outline:none}'
      : '#cv-pages{--sheet-gap:24px;--sheet-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 24px rgba(0,0,0,.08)}' +
        // Kesikli "uzun kayıt" çerçevesi yalnız düzenlenebilir önizlemede (küçük resimde, telefonda değil).
        (interactive ? '' : '.overflow-warning{outline:none}')

    // Yazı tipleri ölçümden önce yüklenmeli; yoksa satır kırılımı sonradan değişir.
    const family = FONTS[cv.template.font].stack.split(',')[0]
    const sample = 'Aa ğüşıöçĞÜŞİÖÇ'
    await Promise.all(
      ['400', '500', '600', '700', 'italic 400'].map((w) => doc.fonts.load(`${w} 12px ${family}`, sample).catch(() => [])),
    )
    if (!gate.isCurrent(token)) return

    doc.getElementById('cv-source')!.innerHTML = renderCvSource(cv, { suggestions, placeholders, emptyHint })
    const result = paginate(doc, { previousPageCount: pageCountRef.current })
    pageCountRef.current = result.pageCount
    // CV'deki bağlantılar klavye sırasına girmez (PDF al'dan sonra fazladan durak olmasın).
    doc.querySelectorAll('#cv-pages a').forEach((a) => a.setAttribute('tabindex', '-1'))
    applyMarks(doc, marks.current)
    fadeOutGhost(doc)
    const pagesEl = doc.getElementById('cv-pages')!
    setContentHeight(firstPageOnly ? PAGE_HEIGHT_PX : pagesEl.scrollHeight)
    gate.complete(token)
    callbacks.current.onResult?.(result)
  }, [cv, suggestions, interactive, placeholders, emptyHint, firstPageOnly, crossfadeKey, gate])

  const render = useCallback(() => gate.track(draw()), [draw, gate])

  // Odak değişince yalnız sınıf güncellenir (yeniden çizim yok). Parlama çizimden sonra
  // uygulanır: kabul CV'yi de değiştirdiğinden eski DOM'a eklenen sınıf hemen kaybolurdu.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (ready && doc) applyMarks(doc, marks.current, false)
  }, [ready, focusedItemId])

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
        // Yazı tipleri yüklenirken daha yeni bir çizim başladıysa bu çizim yarıda kalmıştır:
        // eski görünüm basılmasın diye en son çizim bitene kadar beklenir.
        await gate.settled()
        // Geçiş kopyası baskıya girmesin (CSS'te de @media print ile gizli).
        doc.getElementById(GHOST_ID)?.remove()
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
    [render, interactive, gate],
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
            title={title ?? 'CV'}
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

/** Kayıt vurgusu (.is-focused) ve kabul sonrası kısa parlama (.sg-flash). */
function applyMarks(
  doc: Document,
  marks: { focusedItemId: string | null; flash: { ids: string[]; nonce: number } | null; flashDone: number },
  withFlash = true,
) {
  doc.querySelectorAll('.is-focused').forEach((el) => el.classList.remove('is-focused'))
  if (marks.focusedItemId) {
    doc.querySelectorAll(`[data-item-id="${CSS.escape(marks.focusedItemId)}"]`).forEach((el) => el.classList.add('is-focused'))
  }
  const flash = marks.flash
  if (!withFlash || !flash || flash.nonce === marks.flashDone) return
  const found = flash.ids.flatMap((id) =>
    Array.from(doc.querySelectorAll(id === 'personal' ? '[data-target="personal"].cv-header' : `[data-item-id="${CSS.escape(id)}"]`)),
  )
  // Kabul edilen değişiklik henüz çizilmediyse bir sonraki çizimde denenir.
  if (found.length === 0) return
  marks.flashDone = flash.nonce
  for (const el of found) {
    el.classList.remove('sg-flash')
    void (el as HTMLElement).offsetWidth
    el.classList.add('sg-flash')
  }
}

const GHOST_ID = 'cv-ghost'
const FADE_MS = 220

/**
 * Şablon geçişi: eski sayfaların kopyası, eski stilleriyle birlikte bir gölge
 * kökte (shadow DOM) yeni düzenin üstüne konur ve solarak kaybolur. Yeni
 * şablonun CSS'i kopyayı etkilemez; yazı tipleri belgeden gelir.
 */
function snapshotForCrossfade(doc: Document) {
  doc.getElementById(GHOST_ID)?.remove()
  const pages = doc.getElementById('cv-pages')
  if (!pages || !pages.firstElementChild) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const css = (doc.getElementById('cv-styles')?.textContent ?? '') + (doc.getElementById('cv-host')?.textContent ?? '')
  const host = doc.createElement('div')
  host.id = GHOST_ID
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  host.style.cssText = `position:absolute;inset:0 0 auto 0;z-index:10;pointer-events:none;opacity:1;transition:opacity ${FADE_MS}ms cubic-bezier(0.2,0.7,0.2,1)`
  const root = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  // :root değişkenleri ve body yazı ayarları gölge kökte :host üzerinden okunur; sayfa giriş animasyonu kopyada istenmez.
  style.textContent = `${css.replace(/:root/g, ':host')}
:host{display:block;color:var(--ink);font-family:var(--font);font-size:var(--fs);line-height:var(--lh);-webkit-font-smoothing:antialiased;font-kerning:normal;overflow-wrap:break-word}
.page-enter{animation:none}`
  root.append(style, pages.cloneNode(true))
  doc.body.append(host)
}

/**
 * Kopyayı soldurup kaldırır. Zamanlayıcılar üst pencereden kurulur: iframe betiksiz
 * sandbox olduğundan onun penceresindeki setTimeout/requestAnimationFrame hiç çalışmaz
 * ve kopya belgede kalırdı (yazdırınca fazladan boş sayfa).
 */
function fadeOutGhost(doc: Document) {
  const ghost = doc.getElementById(GHOST_ID)
  if (!ghost) return
  const started = Number(ghost.dataset.fadeStart)
  if (started) {
    // Önceki çizimden kalmış ve süresi geçmiş kopya: hemen kaldır.
    if (performance.now() - started > FADE_MS + 40) ghost.remove()
    return
  }
  ghost.dataset.fadeStart = String(performance.now())
  // Başlangıç opaklığı işlensin ki geçiş çalışsın.
  void ghost.offsetWidth
  ghost.style.opacity = '0'
  window.setTimeout(() => ghost.remove(), FADE_MS + 40)
}
