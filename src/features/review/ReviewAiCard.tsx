import { BriefcaseBusiness, CircleCheck, Lightbulb, Loader2, Square } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { PdfText } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { buildReviewRequest, reviewNameFound, reviewSource } from '@/ai/review'
import type { ReviewComment, ReviewCommentKind } from '@/ai/types'
import { parseReviewResult } from '@/ai/validate'
import type { Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { AiPayloadDialog, DemoBadge, NameMissingNote, WhatIsSentButton } from '@/features/ai/AiPayloadDialog'
import { useAiTask } from '@/features/ai/useAiTask'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import type { FindingTarget } from '@/review/rules'

const KIND: Record<ReviewCommentKind, { label: () => string; icon: ReactNode; tone: string }> = {
  strength: { label: () => m.rv_ai_kind_strength(), icon: <CircleCheck />, tone: 'text-ok' },
  improve: { label: () => m.rv_ai_kind_improve(), icon: <Lightbulb />, tone: 'text-muted' },
  job_fit: { label: () => m.rv_ai_kind_job_fit(), icon: <BriefcaseBusiness />, tone: 'text-muted' },
}

const uiLanguage = () => (getLocale() === 'en' ? 'en' : 'tr')

function CommentRow({ comment, onEdit }: { comment: ReviewComment; onEdit?: (target: FindingTarget) => void }) {
  const kind = KIND[comment.kind]
  const target = comment.target
  return (
    <li className="flex items-start gap-3 px-4 py-3" data-ai-comment={comment.kind}>
      <span className={cn('mt-[3px] shrink-0 [&_svg]:size-4', kind.tone)} aria-hidden>
        {kind.icon}
      </span>
      <p className="min-w-0 flex-1 leading-snug">
        <span className={cn('mr-2 text-[12.5px] font-semibold', kind.tone === 'text-ok' ? 'text-ok' : 'text-text')}>
          {kind.label()}
        </span>
        <span className="text-[13px] break-words">{comment.message}</span>
      </p>
      {target && onEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="-my-0.5 text-accent hover:text-accent"
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
    <section aria-labelledby="rv-ai" className="rounded-xl border border-line bg-surface" data-testid="review-ai">
      <div className="px-4 pt-3.5 pb-4">
        <h2 id="rv-ai" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          {m.rv_ai_title()}
          {done && provider.isDemo && <DemoBadge />}
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {m.rv_ai_body()}
          {provider.isDemo && <> {m.rv_ai_body_demo()}</>}
        </p>
        {!nameFound && <NameMissingNote />}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {state.status === 'running' ? (
            <>
              <span role="status" className="inline-flex h-7 items-center gap-2 text-[13px] text-muted">
                <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
                {m.rv_ai_running()}
              </span>
              <Button size="sm" variant="ghost" onClick={task.cancel}>
                <Square className="!size-3 fill-current" aria-hidden />
                {m.ai_stop()}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={request}>
              {done ? m.rv_ai_again() : m.rv_ai_request()}
            </Button>
          )}
          {ad && <span className="text-[13px] text-muted">{m.rv_ai_with_ad()}</span>}
          <WhatIsSentButton className="ml-auto text-[13px]" onClick={() => setShowPayload(true)} />
        </div>

        {state.status === 'error' && (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger animate-fade-in">
            {state.message}
          </p>
        )}
        {stale && <p className="mt-3 text-[13px] text-muted">{m.rv_ai_stale()}</p>}
        {done && done.comments.length === 0 && <p className="mt-3 text-sm">{m.rv_ai_empty()}</p>}
      </div>

      {done && done.comments.length > 0 && (
        <ul aria-label={m.rv_ai_list_label()} className="divide-y divide-line border-t border-line animate-rise-in">
          {done.comments.map((comment, i) => (
            <CommentRow key={i} comment={comment} onEdit={onEdit} />
          ))}
        </ul>
      )}

      <AiPayloadDialog
        open={showPayload}
        onClose={() => setShowPayload(false)}
        build={() => build().request}
        description={m.rv_ai_payload_desc()}
        rules={m.rv_ai_payload_rules()}
        warning={nameFound ? undefined : m.rv_ai_name_missing_payload()}
        demo={provider.isDemo}
      />
    </section>
  )
}
