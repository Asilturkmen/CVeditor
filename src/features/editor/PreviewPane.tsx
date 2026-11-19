import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minus, Plus, TriangleAlert } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { FloatingNotice } from '@/components/ui/Notice'
import { toast } from '@/components/ui/toast'
import { FloatingPill, PillDivider } from '@/components/ui/Toolbar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame, PAGE_HEIGHT_PX, PAGE_WIDTH_PX, type CvFrameHandle, type CvFrameTarget } from '@/render/CvFrame'
import type { AddedItemSuggestion, SuggestionMap } from '@/render/CvMarkup'
import type { PaginateResult } from '@/render/paginate'
import { useCanvas, type FitMode } from './canvas'
import { oversizedLabels } from './oversizedLabels'

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5]
/** Ctrl+tekerlek / iki parmakla yakınlaştırmanın sınırları (düğmeler ZOOM_STEPS'te durur). */
const WHEEL_MIN = 0.25
const WHEEL_MAX = 2

/** Sayfanın üstünde, yanlarında ve hapla arasında bırakılan boşluk (px). */
const GAP = 32
/** Telefonda yanlarda daha dar pay: dar ekranda her piksel sayfaya. */
const GAP_PHONE = 16
const FIT_MIN = 0.2
/** Sığdır büyütmenin üst sınırı = en büyük yakınlaştırma adımı (2560x1440'ta ~%115 olur, 4K'da %150'de durur). */
const FIT_MAX = ZOOM_STEPS.at(-1)!

/**
 * Sığdırma ölçeği. "Sayfaya sığdır": bir A4 sayfanın tamamı görünen alana hem enine hem boyuna
 * sığar (min). "Genişliğe sığdır": yalnız enine; sayfa uzunluğunca kaydırılır. Büyük ekranda %100'ün
 * üstüne çıkabilir (koca alanda minik sayfa kötü durur). Yuvarlama gereksiz kaydırma çubuğu açmasın
 * diye 1px pay ve aşağı yuvarlama.
 */
function fitScale(box: { width: number; height: number }, mode: FitMode, pad: { top: number; bottom: number; x: number }): number {
  if (box.width <= 0 || box.height <= 0) return 0
  const byWidth = (box.width - 2 * pad.x) / PAGE_WIDTH_PX
  const byHeight = (box.height - pad.top - pad.bottom - 1) / (PAGE_HEIGHT_PX + 1)
  const scale = mode === 'width' ? byWidth : Math.min(byWidth, byHeight)
  return Math.min(FIT_MAX, Math.max(FIT_MIN, Math.floor(scale * 1000) / 1000))
}

/** Öğenin iç ölçüsü; pencere, bölücü, ray ya da uyarılar değişince güncellenir. */
function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setSize((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight ? prev : { width: el.clientWidth, height: el.clientHeight },
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/** Bekleyen önerilerden önizleme işaretleri. */
function useSuggestionMap(): SuggestionMap | undefined {
  const suggestions = useEditorUi((s) => s.suggestions)
  return useMemo(() => {
    if (suggestions.length === 0) return undefined
    const map: SuggestionMap = { fields: new Map(), added: new Map(), removed: new Map() }
    for (const s of suggestions) {
      if (s.kind === 'field') map.fields.set(`${s.target}:${s.field}`, s)
      else if (s.kind === 'removeItem') map.removed!.set(s.itemId, s.id)
      else {
        const list: AddedItemSuggestion[] = map.added!.get(s.sectionId) ?? []
        list.push({ id: s.id, afterItemId: s.afterItemId, item: s.item })
        map.added!.set(s.sectionId, list)
      }
    }
    return map
  }, [suggestions])
}

/** Önizleme belgesindeki sayfaların üst kenarı (ölçeksiz, iframe içi px). */
function pageTops(scroller: HTMLElement | null): number[] {
  const doc = scroller?.querySelector('iframe')?.contentDocument
  if (!doc) return []
  return Array.from(doc.querySelectorAll<HTMLElement>('#cv-pages > .page')).map((p) => p.getBoundingClientRect().top)
}

/**
 * Bildirimler editörde tuvalin alt ortasında, hapın 12px üstünde dursun (panelin ve hapın üstüne
 * binmesin). Toaster bu iki değişkeni okur; editörden çıkınca varsayılana döner.
 */
function useToastAnchor(canvasRef: RefObject<HTMLElement | null>, pillRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    const pill = pillRef.current
    if (!canvas) return
    const root = document.documentElement
    const place = () => {
      const c = canvas.getBoundingClientRect()
      const p = pill?.getBoundingClientRect()
      root.style.setProperty('--toast-x', `${Math.round(c.left + c.width / 2)}px`)
      root.style.setProperty('--toast-bottom', `${Math.round(window.innerHeight - (p && p.height > 0 ? p.top : c.bottom) + 12)}px`)
      root.style.setProperty('--toast-max', `${Math.max(240, Math.round(c.width - 32))}px`)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(canvas)
    if (pill) observer.observe(pill)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      root.style.removeProperty('--toast-x')
      root.style.removeProperty('--toast-bottom')
      root.style.removeProperty('--toast-max')
    }
  }, [canvasRef, pillRef])
}

/** Alt ortadaki hap: sayfa ‹ 1 / 2 › · yakınlaştırma − % + · Sığdır menüsü. */
function CanvasPill({
  current,
  fitMode,
  phone,
  onPages,
}: {
  current: number
  fitMode: FitMode
  phone: boolean
  /** Sayfa göstergesine tıklayınca (masaüstünde sayfa küçük resimleri) */
  onPages?: () => void
}) {
  const zoom = useEditorUi((s) => s.zoom)
  const setZoom = useEditorUi((s) => s.setZoom)
  const pageCount = useEditorUi((s) => s.pageCount)
  const page = useCanvas((s) => Math.min(s.currentPage, pageCount))
  const goToPage = useCanvas((s) => s.goToPage)
  const setFitMode = useCanvas((s) => s.setFitMode)
  const step = (dir: 1 | -1) => {
    const next =
      dir === 1 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001)
    if (next) setZoom(next)
  }
  const fit = (mode: FitMode) => {
    setFitMode(mode)
    setZoom('fit')
  }
  const fitValue = zoom === 'fit' ? fitMode : zoom === 1 ? 'actual' : ''
  const multi = pageCount > 1
  const indicator = (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {multi && <TriangleAlert aria-hidden className="size-3.5 text-warn" />}
      {multi ? m.canvas_page_of({ page, count: pageCount }) : m.page_count({ count: pageCount })}
    </span>
  )
  const indicatorLabel = multi ? m.canvas_page_label({ page, count: pageCount }) : m.page_count({ count: pageCount })
  return (
    <FloatingPill aria-label={m.canvas_pill_label()} className="phone:h-13">
      <div role="group" aria-label={m.canvas_pages_label()} className="flex items-center gap-0.5">
        {multi && (
          <IconButton
            label={m.canvas_page_prev()}
            icon={<ChevronLeft />}
            tooltipSide="top"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          />
        )}
        {onPages ? (
          <Tooltip content={multi ? m.pages_hint() : m.canvas_pages_show()} side="top">
            <button
              type="button"
              aria-label={`${indicatorLabel}. ${m.canvas_pages_show()}`}
              onClick={onPages}
              className="press h-7 rounded-full px-2 text-body text-fg transition-colors hover:bg-fill-3 active:bg-fill-1"
            >
              {indicator}
            </button>
          </Tooltip>
        ) : (
          <span aria-label={indicatorLabel} role="status" className="px-2 text-body text-fg">
            {indicator}
          </span>
        )}
        {multi && (
          <IconButton
            label={m.canvas_page_next()}
            icon={<ChevronRight />}
            tooltipSide="top"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
          />
        )}
      </div>
      <PillDivider />
      {/* Telefonda −/+ hap dar ekrana sığsın diye Sığdır menüsünde (özellik kalkmaz, yer değiştirir). */}
      <div role="group" aria-label={m.ai2_zoom_label()} className="flex items-center gap-0.5">
        {!phone && (
          <IconButton
            label={m.zoom_out()}
            icon={<Minus />}
            tooltipSide="top"
            disabled={current <= ZOOM_STEPS[0] + 0.001}
            onClick={() => step(-1)}
          />
        )}
        <Tooltip content={m.ai2_zoom_reset()} side="top">
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="press h-7 w-12 rounded-full text-center text-body text-fg tabular-nums transition-colors hover:bg-fill-3 active:bg-fill-1 phone:h-11 phone:w-16"
          >
            {Math.round(current * 100)}%
          </button>
        </Tooltip>
        {!phone && (
          <IconButton
            label={m.zoom_in()}
            icon={<Plus />}
            tooltipSide="top"
            disabled={current >= ZOOM_STEPS.at(-1)! - 0.001}
            onClick={() => step(1)}
          />
        )}
      </div>
      <PillDivider />
      <Menu>
        <MenuTrigger asChild>
          {phone ? (
            <IconButton label={m.zoom_fit()} icon={<Maximize2 />} tooltip={false} />
          ) : (
            <Button variant="ghost" className="rounded-full pr-2 data-[state=open]:bg-fill-2">
              {m.zoom_fit()}
              <ChevronDown aria-hidden className="size-3.5! text-fg" />
            </Button>
          )}
        </MenuTrigger>
        <MenuContent side="top" align="end">
          <MenuRadioGroup
            value={fitValue}
            onValueChange={(value) => {
              if (value === 'page' || value === 'width') fit(value)
              else if (value === 'actual') setZoom(1)
            }}
          >
            <MenuRadioItem value="page" shortcut={phone ? undefined : 'Ctrl+0'}>
              {m.zoom_fit_page()}
            </MenuRadioItem>
            <MenuRadioItem value="width">{m.zoom_fit_width()}</MenuRadioItem>
            <MenuRadioItem value="actual">{m.zoom_actual()}</MenuRadioItem>
          </MenuRadioGroup>
          {phone && (
            <>
              <MenuSeparator />
              <MenuItem disabled={current >= ZOOM_STEPS.at(-1)! - 0.001} onSelect={() => step(1)}>
                {m.zoom_in()}
              </MenuItem>
              <MenuItem disabled={current <= ZOOM_STEPS[0] + 0.001} onSelect={() => step(-1)}>
                {m.zoom_out()}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
    </FloatingPill>
  )
}

export const PreviewPane = forwardRef<
  CvFrameHandle,
  {
    cv: Cv
    readOnly?: boolean
    /** Salt okunur (telefon) görünümde tuvalin üstünde yüzen not */
    notice?: string
    /** Tuvalin üstünde yüzen ek uyarılar (iki sekme çakışması) */
    notices?: ReactNode
  }
>(function PreviewPane({ cv, readOnly = false, notice, notices }, ref) {
  const zoom = useEditorUi((s) => s.zoom)
  const setZoom = useEditorUi((s) => s.setZoom)
  const tab = useEditorUi((s) => s.tab)
  const focusedItemId = useEditorUi((s) => s.focusedItemId)
  const focusItem = useEditorUi((s) => s.focusItem)
  const setTab = useEditorUi((s) => s.setTab)
  const setPagination = useEditorUi((s) => s.setPagination)
  const setRail = useEditorUi((s) => s.setRail)
  const pageCount = useEditorUi((s) => s.pageCount)
  const oversized = useEditorUi((s) => s.oversized)
  const clipped = useEditorUi((s) => s.clipped)
  const reveal = useEditorUi((s) => s.reveal)
  const flash = useEditorUi((s) => s.flash)
  const storedFit = useCanvas((s) => s.fitMode)
  const setFitMode = useCanvas((s) => s.setFitMode)
  const pageRequest = useCanvas((s) => s.pageRequest)
  const setCurrentPage = useCanvas((s) => s.setCurrentPage)
  const markDrawn = useCanvas((s) => s.markDrawn)
  const drawn = useCanvas((s) => s.drawn)
  // Telefonda (salt okunur) varsayılan genişliğe sığdır; masaüstünde sayfaya.
  const fitMode: FitMode = storedFit ?? (readOnly ? 'width' : 'page')

  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const box = useElementSize(scrollRef)
  const noticeBox = useElementSize(noticeRef)
  const pillBox = useElementSize(pillRef)
  const [pillOffset, setPillOffset] = useState(0)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const pill = pillRef.current
    if (canvas && pill) setPillOffset(Math.max(0, canvas.clientHeight - pill.offsetTop))
  }, [box.height, pillBox.height])

  const padX = box.width > 0 && box.width < 600 ? GAP_PHONE : GAP
  // Üstte: uyarı varsa onun altı (12 + yükseklik + 16), yoksa 32. Altta: hapın üstünde 32.
  const padTop = noticeBox.height > 0 ? Math.max(GAP, 12 + noticeBox.height + 16) : GAP
  const padBottom = pillOffset > 0 ? pillOffset + GAP : GAP
  const fitted = fitScale(box, fitMode, { top: padTop, bottom: padBottom, x: padX })
  const scale = zoom === 'fit' ? fitted : zoom
  const scaleRef = useRef(scale)
  const suggestionMap = useSuggestionMap()
  const drawFailed = useRef(false)

  useToastAnchor(canvasRef, pillRef)

  const onResult = useCallback(
    (r: PaginateResult) => {
      drawFailed.current = false
      setPagination({ pageCount: r.pageCount, oversized: r.oversized, clipped: r.clipped })
      markDrawn()
    },
    [setPagination, markDrawn],
  )

  // Kendiliğinden yapılan çizim hata verdi: bir kez söylenir (her tuşta değil), sonraki başarılı çizim sıfırlar.
  const onDrawError = useCallback((error: unknown) => {
    console.error(error)
    if (drawFailed.current) return
    drawFailed.current = true
    toast({ message: m.preview_draw_failed(), tone: 'error' })
  }, [])

  const onTargetClick = useCallback(
    (target: CvFrameTarget) => {
      setTab('content')
      if (target.personal) focusItem('personal', true)
      else if (target.itemId) focusItem(target.itemId, true)
    },
    [focusItem, setTab],
  )

  // Öneri listesinden seçilen öneriyi önizlemede görünür yap.
  useEffect(() => {
    if (!reveal) return
    const scroller = scrollRef.current
    const iframe = scroller?.querySelector('iframe')
    const el = iframe?.contentDocument?.querySelector<HTMLElement>(`[data-sg-id="${CSS.escape(reveal.id)}"]`)
    if (!scroller || !iframe || !el) return
    const s = iframe.getBoundingClientRect().width / PAGE_WIDTH_PX
    const top = iframe.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const elTop = top + el.getBoundingClientRect().top * s
    const elHeight = el.getBoundingClientRect().height * s
    const target = elTop - Math.max(24, (scroller.clientHeight - elHeight) / 2)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' })
  }, [reveal])

  // Raydan ya da haptan sayfaya git: sayfanın üst kenarı tuvalin üst boşluğuna gelir.
  useEffect(() => {
    if (!pageRequest) return
    const scroller = scrollRef.current
    const tops = pageTops(scroller)
    const top = tops[pageRequest.page - 1]
    if (!scroller || top === undefined) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setCurrentPage(pageRequest.page)
    scroller.scrollTo({ top: Math.max(0, top * scaleRef.current), behavior: reduce ? 'auto' : 'smooth' })
  }, [pageRequest, setCurrentPage])

  // Görünen sayfa: tuvalin ortasından geçen sayfa (kaydırınca, ölçek ya da sayfa sayısı değişince).
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    let frame = 0
    const read = () => {
      frame = 0
      const tops = pageTops(scroller)
      if (tops.length === 0) return
      const middle = (scroller.scrollTop + scroller.clientHeight / 2 - padTop) / scaleRef.current
      let page = 1
      tops.forEach((top, i) => {
        if (top <= middle) page = i + 1
      })
      setCurrentPage(page)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    read()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [padTop, scale, pageCount, setCurrentPage])

  // Ctrl+tekerlek (dokunmatik yüzeyde iki parmak) yakınlaştırır; imlecin altındaki nokta yerinde kalır.
  const anchor = useRef<{ y: number; content: number } | null>(null)
  useLayoutEffect(() => {
    const prev = scaleRef.current
    scaleRef.current = scale
    const scroller = scrollRef.current
    const a = anchor.current
    anchor.current = null
    if (!scroller || !a || prev === scale || scale <= 0) return
    scroller.scrollTop = Math.max(0, a.content * scale + padTop - a.y)
  }, [scale, padTop])
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const zoomAt = (clientY: number, deltaY: number) => {
      const current = scaleRef.current
      if (current <= 0) return
      const next = Math.round(Math.min(WHEEL_MAX, Math.max(WHEEL_MIN, current * Math.exp(-deltaY * 0.002))) * 1000) / 1000
      if (next === current) return
      const y = clientY - scroller.getBoundingClientRect().top
      anchor.current = { y, content: (scroller.scrollTop + y - padTop) / current }
      setZoom(next)
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomAt(e.clientY, e.deltaY)
    }
    // İmleç sayfanın üstündeyken olay iframe'in belgesine gider: orada da dinlenir.
    const frameDoc = scroller.querySelector('iframe')?.contentDocument
    const onFrameWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const iframe = scroller.querySelector('iframe')
      if (!iframe) return
      zoomAt(iframe.getBoundingClientRect().top + e.clientY * scaleRef.current, e.deltaY)
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    frameDoc?.addEventListener('wheel', onFrameWheel, { passive: false })
    return () => {
      scroller.removeEventListener('wheel', onWheel)
      frameDoc?.removeEventListener('wheel', onFrameWheel)
    }
    // drawn: iframe belgesi ilk çizimle hazır olur (dinleyici ona da bağlanır).
  }, [padTop, setZoom, drawn])

  // Ctrl+0: sayfaya sığdır (yalnız düzenlenebilir önizlemede; telefonda klavye yok).
  useEffect(() => {
    if (readOnly) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key !== '0') return
      e.preventDefault()
      setFitMode('page')
      setZoom('fit')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readOnly, setFitMode, setZoom])

  const warnings = oversizedLabels(cv, oversized)

  return (
    <div ref={canvasRef} data-canvas className="relative h-full min-h-0 overflow-hidden bg-canvas">
      {/* Kaydırma çubuğu yeri iki yanda da ayrılır: çubuk açılıp kapanınca sayfa kaymaz, ortada kalır. */}
      <div ref={scrollRef} data-preview-scroll className="absolute inset-0 overflow-auto [scrollbar-gutter:stable_both-edges]">
        <div style={{ padding: `${padTop}px ${padX}px ${padBottom}px`, minWidth: '100%', width: 'max-content' }}>
          <CvFrame
            ref={ref}
            cv={cv}
            // Sığdır kipinde ölçek burada hesaplanır (alanın hem eni hem boyu); elle seçilen yakınlaştırmayı
            // pencere/bölücü/ray değişimi ezmez, "Sığdır"a basılana kadar kalır.
            scale={scale}
            interactive={!readOnly}
            placeholders
            emptyHint={m.preview_empty_hint()}
            // Fotoğraf açık ama yüklenmemişse fotoğraf yerinde kesikli kutu (yalnız ekranda; PDF fotoğrafsız).
            photoHint={readOnly ? undefined : m.preview_photo_hint()}
            suggestions={suggestionMap}
            // Vurgu yalnız İçerik sekmesinde ve odak paneldeyken (önizleme = PDF).
            focusedItemId={!readOnly && tab === 'content' ? focusedItemId : null}
            flash={readOnly ? null : flash}
            crossfadeKey={`${cv.templateId}:${cv.template.columns}`}
            onResult={onResult}
            onError={onDrawError}
            onTargetClick={readOnly ? undefined : onTargetClick}
            title={m.preview_title()}
          />
        </div>
      </div>

      {/* Tuvalin üst ortasında yüzen uyarılar; sayfa (sığdırınca) bunların altından başlar. */}
      <div
        ref={noticeRef}
        className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-2 px-4 empty:hidden [&>*]:pointer-events-auto"
      >
        {notices}
        {readOnly && notice && (
          <FloatingNotice tone="info" className="max-w-[min(100%,560px)]">
            {notice}
          </FloatingNotice>
        )}
        {readOnly
          ? (warnings.length > 0 || clipped) && (
              <FloatingNotice tone="warn" role="alert" className="max-w-[min(100%,560px)] animate-rise-in">
                {warnings.length > 0 && m.ai2_oversized_mobile({ count: warnings.length, names: warnings.map((w) => w.label).join(', ') })}
                {clipped && <span className="block text-danger">{m.clipped_body()}</span>}
              </FloatingNotice>
            )
          : (warnings.length > 0 || clipped) && (
              <FloatingNotice
                tone={warnings.length > 0 ? 'warn' : 'danger'}
                role="alert"
                className="max-w-[min(100%,600px)] animate-rise-in"
              >
                {warnings.length > 0 && (
                  <>
                    <span className="font-semibold">{m.oversized_title({ count: warnings.length })}</span>{' '}
                    {m.oversized_body()}{' '}
                    {warnings.map((w, i) => (
                      <span key={`${w.id}-${i}`}>
                        {i > 0 && ', '}
                        <button
                          type="button"
                          className="rounded-xs font-medium text-accent hover:underline"
                          onClick={() => w.id && onTargetClick({ itemId: w.id, sectionId: null, personal: false })}
                        >
                          {w.label}
                        </button>
                      </span>
                    ))}
                  </>
                )}
                {clipped && <span className={cn(warnings.length > 0 && 'mt-1 block', 'text-danger')}>{m.clipped_body()}</span>}
              </FloatingNotice>
            )}
      </div>

      <div ref={pillRef} data-canvas-pill className="absolute bottom-4 left-1/2 z-20 w-max max-w-[calc(100%-16px)] -translate-x-1/2 whitespace-nowrap phone:bottom-3">
        <CanvasPill current={scale} fitMode={fitMode} phone={readOnly} onPages={readOnly ? undefined : () => setRail('pages')} />
      </div>
    </div>
  )
})
