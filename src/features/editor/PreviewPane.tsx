import { AlertTriangle, Minus, MonitorSmartphone, Plus } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame, PAGE_HEIGHT_PX, PAGE_WIDTH_PX, type CvFrameHandle, type CvFrameTarget } from '@/render/CvFrame'
import type { AddedItemSuggestion, SuggestionMap } from '@/render/CvMarkup'
import type { PaginateResult } from '@/render/paginate'
import { oversizedLabels } from './oversizedLabels'

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5]

/** Sayfanın üstünde/altında (ve yanlarında en az) bırakılan boşluk: py-8 = 2rem (kök 14px) = 28px. */
const FIT_GAP = 28
const FIT_MIN = 0.2
/** Sığdır büyütmenin üst sınırı = en büyük yakınlaştırma adımı (2560x1440'ta ~%115 olur, 4K'da %150'de durur). */
const FIT_MAX = ZOOM_STEPS.at(-1)!

/**
 * "Sığdır" ölçeği: bir A4 sayfanın tamamı önizleme alanına hem enine hem boyuna
 * sığar; üstte ve altta FIT_GAP kadar nefes payı kalır. Kural min(enine, boyuna):
 * büyük ekranda %100'ün üstüne çıkabilir (koca alanda minik sayfa kötü durur),
 * ama sayfa hiçbir zaman alandan taşmaz. Yuvarlama ve sayfa yüksekliğinin tam
 * piksele yuvarlanması gereksiz kaydırma çubuğu açmasın diye 1px pay ve aşağı yuvarlama.
 * `byWidthOnly`: yalnız enine sığdır (telefonu yatay tutunca sayfa minicik kalmasın).
 */
function pageFitScale(width: number, height: number, byWidthOnly = false): number {
  if (width <= 0 || height <= 0) return 0
  // Telefonda yanlarda daha dar pay (16px): dar ekranda her piksel sayfaya.
  const gapX = width < 600 ? 16 : FIT_GAP
  const byWidth = (width - 2 * gapX) / PAGE_WIDTH_PX
  const byHeight = (height - 2 * FIT_GAP - 1) / (PAGE_HEIGHT_PX + 1)
  const scale = byWidthOnly ? byWidth : Math.min(byWidth, byHeight)
  return Math.min(FIT_MAX, Math.max(FIT_MIN, Math.floor(scale * 1000) / 1000))
}

/** Kaydırma kabının iç ölçüsü; pencere, bölücü, sağ panel ya da uyarı bandı değişince güncellenir. */
function useBoxSize(ref: RefObject<HTMLElement | null>) {
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

/** Önizlemenin altında ince çubuk: sayfanın üstüne binmez. Yüzdeye tıklamak %100'e döndürür. */
function ZoomBar({ fitScale }: { fitScale: number }) {
  const zoom = useEditorUi((s) => s.zoom)
  const setZoom = useEditorUi((s) => s.setZoom)
  const current = zoom === 'fit' ? fitScale : zoom
  const step = (dir: 1 | -1) => {
    const next =
      dir === 1 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001)
    if (next) setZoom(next)
  }
  return (
    <div className="flex h-10 shrink-0 items-center justify-end border-t border-line bg-canvas px-3">
      <div role="group" aria-label={m.ai2_zoom_label()} className="flex items-center gap-0.5">
        <Tooltip content={m.zoom_out()}>
          <Button size="icon-sm" variant="ghost" aria-label={m.zoom_out()} disabled={current <= ZOOM_STEPS[0] + 0.001} onClick={() => step(-1)}>
            <Minus />
          </Button>
        </Tooltip>
        <Tooltip content={m.ai2_zoom_reset()}>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="h-7 w-12 rounded-md text-center text-xs font-medium text-muted tabular-nums transition-colors hover:bg-surface-2 hover:text-text"
          >
            {Math.round(current * 100)}%
          </button>
        </Tooltip>
        <Tooltip content={m.zoom_in()}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={m.zoom_in()}
            disabled={current >= ZOOM_STEPS.at(-1)! - 0.001}
            onClick={() => step(1)}
          >
            <Plus />
          </Button>
        </Tooltip>
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          onClick={() => setZoom('fit')}
          aria-pressed={zoom === 'fit'}
          className={cn(
            'h-7 rounded-md px-2 text-xs font-medium transition-colors',
            zoom === 'fit' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
          )}
        >
          {m.zoom_fit()}
        </button>
      </div>
    </div>
  )
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

export const PreviewPane = forwardRef<
  CvFrameHandle,
  {
    cv: Cv
    readOnly?: boolean
    /** Salt okunur (telefon) görünümde uyarıyla aynı kutuda gösterilen not */
    notice?: string
  }
>(function PreviewPane({ cv, readOnly = false, notice }, ref) {
  const zoom = useEditorUi((s) => s.zoom)
  const tab = useEditorUi((s) => s.tab)
  const focusedItemId = useEditorUi((s) => s.focusedItemId)
  const focusItem = useEditorUi((s) => s.focusItem)
  const setTab = useEditorUi((s) => s.setTab)
  const setPagination = useEditorUi((s) => s.setPagination)
  const oversized = useEditorUi((s) => s.oversized)
  const clipped = useEditorUi((s) => s.clipped)
  const reveal = useEditorUi((s) => s.reveal)
  const flash = useEditorUi((s) => s.flash)
  const scrollRef = useRef<HTMLDivElement>(null)
  const box = useBoxSize(scrollRef)
  // Telefonda (salt okunur) dikey tutuşta sayfa bütün görünür; yatay tutuşta enine sığar, kaydırılır.
  const fitScale = pageFitScale(box.width, box.height, readOnly && box.width > box.height)
  const suggestionMap = useSuggestionMap()

  const onResult = useCallback(
    (r: PaginateResult) => setPagination({ pageCount: r.pageCount, oversized: r.oversized, clipped: r.clipped }),
    [setPagination],
  )

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
    const scale = iframe.getBoundingClientRect().width / PAGE_WIDTH_PX
    const top = iframe.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const elTop = top + el.getBoundingClientRect().top * scale
    const elHeight = el.getBoundingClientRect().height * scale
    const target = elTop - Math.max(24, (scroller.clientHeight - elHeight) / 2)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' })
  }, [reveal])

  const warnings = oversizedLabels(cv, oversized)
  const hasWarning = warnings.length > 0 || clipped

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-canvas">
      {readOnly
        ? (notice || hasWarning) && (
            // Telefonda tek, sıkı kutu: düzenleme notu + (varsa) uzun kayıt uyarısı. Tıklanacak bir şey yok.
            <div
              role={hasWarning ? 'alert' : undefined}
              className={cn(
                'flex flex-col gap-1.5 border-b px-4 py-2.5 text-[13px]',
                hasWarning ? 'border-warn/25 bg-warn-soft' : 'border-line bg-surface',
              )}
            >
              {notice && (
                <p className="flex items-start gap-2.5 text-muted">
                  <MonitorSmartphone className="mt-0.5 size-4 shrink-0" />
                  {notice}
                </p>
              )}
              {warnings.length > 0 && (
                <p className="flex items-start gap-2.5 text-text">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                  {m.ai2_oversized_mobile({ count: warnings.length, names: warnings.map((w) => w.label).join(', ') })}
                </p>
              )}
              {clipped && <p className="pl-6.5 text-danger">{m.clipped_body()}</p>}
            </div>
          )
        : hasWarning && (
            <div
              role="alert"
              className="flex items-start gap-3 border-b border-warn/25 bg-warn-soft px-5 py-2.5 text-[13px] animate-rise-in"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
              <div className="flex-1">
                <p className="font-semibold text-text">{m.oversized_title({ count: warnings.length })}</p>
                <p className="text-muted">
                  {m.oversized_body()}{' '}
                  {warnings.map((w, i) => (
                    <span key={`${w.id}-${i}`}>
                      {i > 0 && ', '}
                      <button
                        type="button"
                        className="font-medium text-text underline underline-offset-2 hover:text-accent"
                        onClick={() => w.id && onTargetClick({ itemId: w.id, sectionId: null, personal: false })}
                      >
                        {w.label}
                      </button>
                    </span>
                  ))}
                  {clipped && <span className="block text-danger">{m.clipped_body()}</span>}
                </p>
              </div>
            </div>
          )}
      {/* Kaydırma çubuğu yeri iki yanda da ayrılır: çubuk açılıp kapanınca sayfa kaymaz, ortada kalır. */}
      <div ref={scrollRef} data-preview-scroll className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable_both-edges]">
        <CvFrame
          ref={ref}
          cv={cv}
          // Sığdır modunda ölçek burada hesaplanır (alanın hem eni hem boyu); elle seçilen yakınlaştırmayı
          // pencere/bölücü değişimi ezmez, "Sığdır"a basılana kadar kalır.
          scale={zoom === 'fit' ? fitScale : zoom}
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
          onTargetClick={readOnly ? undefined : onTargetClick}
          className="py-8"
          title={m.preview_title()}
        />
      </div>
      {!readOnly && <ZoomBar fitScale={fitScale} />}
    </div>
  )
})
