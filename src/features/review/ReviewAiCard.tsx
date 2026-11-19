import { BriefcaseBusiness, CircleCheck, Lightbulb, Square } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { PdfText } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { buildReviewRequest, reviewNameFound, reviewSource } from '@/ai/review'
import type { ReviewComment, ReviewCommentKind } from '@/ai/types'
import { parseReviewResult } from '@/ai/validate'
import type { Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Group } from '@/components/ui/Group'
import { InlineNotice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { AiPayloadDialog, DemoBadge, NameMissingNote, WhatIsSentButton } from '@/features/ai/AiPayloadDialog'
import { useAiTask } from '@/features/ai/useAiTask'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import type { FindingTarget } from '@/review/rules'

const KIND: Record<ReviewCommentKind, { label: () => string; icon: ReactNode; tone: string }> = {
  strength: { label: () => m.rv_ai_kind_strength(), icon: <CircleCheck />, tone: 'text-ok' },
  improve: { label: () => m.rv_ai_kind_improve(), icon: <Lightbulb />, tone: 'text-fg-2' },
  job_fit: { label: () => m.rv_ai_kind_job_fit(), icon: <BriefcaseBusiness />, tone: 'text-fg-2' },
}

const uiLanguage = () => (getLocale() === 'en' ? 'en' : 'tr')

function CommentRow({ comment, onEdit }: { comment: ReviewComment; onEdit?: (target: FindingTarget) => void }) {
  const kind = KIND[comment.kind]
  const target = comment.target
  return (
    <li className="flex items-start gap-3 px-[var(--row-px)] py-3" data-ai-comment={comment.kind}>
      <span className={cn('mt-px shrink-0 [&_svg]:size-4', kind.tone)} aria-hidden>
        {kind.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-callout text-fg-2">{kind.label()}</p>
        <p className="text-body break-words text-fg">{comment.message}</p>
      </div>
      {target && onEdit && (
        <Button
          variant="plain"
          className="-my-1 -mr-2"
          aria-label={m.rv_edit_label({ title: kind.label() })}
          onClick={() => onEdit({ sectionId: target.sectionId, itemId: target.itemId })}
        >
          {m.rv_edit()}
        </Button>
      )}
    </li>
  )
}

/**
 * CV İnceleme'deki yapay zekâ yorumu. İstek yalnız düğmeye basınca gider;
 * "Ne gönderilir?" gidecek verinin tamamını gösterir. Yorumlar puan ya da
 * yüzde taşımaz. Örnek sağlayıcıda "Örnek" rozeti görünür.
 */
export function ReviewAiCard({
  cv,
  pdf,
  jobAd,
  onEdit,
}: {
  cv: Cv | null
  pdf: PdfText | null
  jobAd: string
  onEdit?: (target: FindingTarget) => void
}) {
  const provider = getAiProvider()
  const source = useMemo(() => reviewSource(cv, pdf, uiLanguage()), [cv, pdf])
  // PDF'te ad tahmin edilemediyse metindeki ad maskelenmeden gidebilir: göndermeden önce uyarılır.
  const nameFound = useMemo(() => !source || reviewNameFound(source), [source])
  const task = useAiTask<{ comments: ReviewComment[]; ad: string; sourceId: unknown }>()
  const [showPayload, setShowPayload] = useState(false)
  const ad = jobAd.trim()
  // Sonuç hangi kaynaktan (CV ya da yüklenen PDF) geldiyse yalnız onda görünür; başka
  // kaynağa geçince "Düzenle" eski sonucun hedefini yeni CV'de açmasın.
  const sourceId = cv?.id ?? pdf
  if (!source) return null

  // "Ne gönderilir?" ve gönderim aynı girdilerden kurulur.
  const build = () => buildReviewRequest(source, ad, uiLanguage())
  const request = () =>
    void task.run(async (signal) => {
      const prepared = build()
      const result = parseReviewResult(await provider.review(prepared.request, signal))
      return { comments: prepared.finish(result), ad, sourceId }
    })

  const { state } = task
  const done = state.status === 'done' && state.value.sourceId === sourceId ? state.value : null
  const stale = done !== null && done.ad !== ad

  return (
    <div data-testid="review-ai">
      <Group
        inset="lg"
        title={
          <span className="flex items-center gap-2">
            {m.rv_ai_title()}
            {done && provider.isDemo && <DemoBadge />}
          </span>
        }
      >
        <div className="flex flex-col gap-3 px-[var(--row-px)] py-3">
          <p className="text-callout text-fg-2">
            {m.rv_ai_body()}
            {provider.isDemo && <> {m.rv_ai_body_demo()}</>}
          </p>
          {!nameFound && <NameMissingNote className="mt-0" />}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {state.status === 'running' ? (
              <>
                <span role="status" className="inline-flex h-7 items-center gap-2 text-body text-fg">
                  <Spinner />
                  {m.rv_ai_running()}
                </span>
                <Button onClick={task.cancel}>
                  <Square className="size-3! fill-current" aria-hidden />
                  {m.ai_stop()}
                </Button>
              </>
            ) : (
              <Button onClick={request}>{done ? m.rv_ai_again() : m.rv_ai_request()}</Button>
            )}
            <WhatIsSentButton className="ml-auto" onClick={() => setShowPayload(true)} />
          </div>
          {ad && <p className="text-callout text-fg-2">{m.rv_ai_with_ad()}</p>}

          {state.status === 'error' && (
            <div role="alert" className="animate-fade-in">
              <InlineNotice tone="danger">{state.message}</InlineNotice>
            </div>
          )}
          {stale && <p className="text-callout text-fg-2">{m.rv_ai_stale()}</p>}
          {done && done.comments.length === 0 && <p className="text-body text-fg">{m.rv_ai_empty()}</p>}
        </div>

        {done && done.comments.length > 0 && (
          <ul aria-label={m.rv_ai_list_label()} className="group-rows animate-rise-in">
            {done.comments.map((comment, i) => (
              <CommentRow key={i} comment={comment} onEdit={onEdit} />
            ))}
          </ul>
        )}
      </Group>

      <AiPayloadDialog
        open={showPayload}
        onClose={() => setShowPayload(false)}
        build={() => build().request}
        description={m.rv_ai_payload_desc()}
        rules={m.rv_ai_payload_rules()}
        warning={nameFound ? undefined : m.rv_ai_name_missing_payload()}
        demo={provider.isDemo}
      />
    </div>
  )
}
