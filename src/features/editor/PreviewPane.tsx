import { AlertTriangle, Minus, Plus } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnyItem, Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame, type CvFrameHandle, type CvFrameTarget } from '@/render/CvFrame'
import type { SuggestionMap } from '@/render/CvMarkup'
import type { PaginateResult } from '@/render/paginate'
import { itemLabel } from './labels'

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5]

export function oversizedLabels(cv: Cv, oversized: { itemId: string | null; sectionId: string | null }[]) {
  return oversized.map((o) => {
    const section = cv.sections.find((s) => s.id === o.sectionId)
    const item = section ? (section.items as AnyItem[]).find((i) => i.id === o.itemId) : undefined
    return { id: o.itemId, label: section && item ? itemLabel(section.type, item) || m.editor_untitled() : m.editor_untitled() }
  })
}

function ZoomControl({ fitScale }: { fitScale: number }) {
  const zoom = useEditorUi((s) => s.zoom)
  const setZoom = useEditorUi((s) => s.setZoom)
  const current = zoom === 'fit' ? fitScale : zoom
  const step = (dir: 1 | -1) => {
    const next =
      dir === 1 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001)
    if (next) setZoom(next)
  }
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm">
      <Tooltip content={m.zoom_out()}>
        <Button size="icon-sm" variant="ghost" aria-label={m.zoom_out()} onClick={() => step(-1)}>
          <Minus />
        </Button>
      </Tooltip>
      <span className="w-11 text-center text-xs font-medium text-muted tabular-nums">{Math.round(current * 100)}%</span>
      <Tooltip content={m.zoom_in()}>
        <Button size="icon-sm" variant="ghost" aria-label={m.zoom_in()} onClick={() => step(1)}>
          <Plus />
        </Button>
      </Tooltip>
      <span className="mx-0.5 h-4 w-px bg-line" />
      <button
        type="button"
        onClick={() => setZoom('fit')}
        className={cn(
          'h-7 rounded-md px-2 text-xs font-medium transition-colors',
          zoom === 'fit' ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        )}
      >
        {m.zoom_fit()}
      </button>
      <button
        type="button"
        onClick={() => setZoom(1)}
        className={cn(
          'h-7 rounded-md px-2 text-xs font-medium transition-colors',
          zoom === 1 ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        )}
      >
        100%
      </button>
    </div>
  )
}

export const PreviewPane = forwardRef<CvFrameHandle, { cv: Cv; readOnly?: boolean }>(function PreviewPane(
  { cv, readOnly = false },
  ref,
) {
  const zoom = useEditorUi((s) => s.zoom)
  const focusedItemId = useEditorUi((s) => s.focusedItemId)
  const focusItem = useEditorUi((s) => s.focusItem)
  const setTab = useEditorUi((s) => s.setTab)
  const suggestions = useEditorUi((s) => s.suggestions)
  const setPagination = useEditorUi((s) => s.setPagination)
  const oversized = useEditorUi((s) => s.oversized)
  const clipped = useEditorUi((s) => s.clipped)
  const [fitScale, setFitScale] = useState(1)
  const [fading, setFading] = useState(false)
  const previousTemplate = useRef(cv.templateId + cv.template.columns)

  // Şablon/sütun değişince kısa geçiş: CV yeni düzene "akar".
  useEffect(() => {
    const key = cv.templateId + cv.template.columns
    if (key === previousTemplate.current) return
    previousTemplate.current = key
    setFading(true)
    const timer = setTimeout(() => setFading(false), 160)
    return () => clearTimeout(timer)
  }, [cv.templateId, cv.template.columns])

  const suggestionMap = useMemo<SuggestionMap | undefined>(() => {
    if (suggestions.length === 0) return undefined
    return new Map(suggestions.map((s) => [`${s.target}:${s.field}`, s]))
  }, [suggestions])

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

  const warnings = oversizedLabels(cv, oversized)

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-canvas">
      {(warnings.length > 0 || clipped) && (
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
      <div className="min-h-0 flex-1 overflow-auto">
        <CvFrame
          ref={ref}
          cv={cv}
          scale={zoom}
          interactive={!readOnly}
          placeholders
          suggestions={suggestionMap}
          focusedItemId={focusedItemId}
          onResult={onResult}
          onTargetClick={readOnly ? undefined : onTargetClick}
          onScaleChange={zoom === 'fit' ? setFitScale : undefined}
          className={cn('py-6 transition-opacity duration-150 ease-out', fading ? 'opacity-0' : 'opacity-100')}
          title={m.preview_title()}
        />
      </div>
      {!readOnly && (
        <div className="pointer-events-none absolute right-4 bottom-4 [&>*]:pointer-events-auto">
          <ZoomControl fitScale={fitScale} />
        </div>
      )}
    </div>
  )
})
