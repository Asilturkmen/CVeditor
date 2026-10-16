import { ArrowRight, Check, Loader2, Square } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { PdfText } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { buildKeywordMatchRequest, reviewNameFound, reviewSource } from '@/ai/review'
import type { KeywordMatchResult } from '@/ai/types'
import { parseKeywordMatchResult } from '@/ai/validate'
import type { Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { AiPayloadDialog, DemoBadge, NameMissingNote, WhatIsSentButton } from '@/features/ai/AiPayloadDialog'
import { useAiTask } from '@/features/ai/useAiTask'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import type { KeywordMatch } from '@/review/keywords'

function TermGroup({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  if (count === 0) return null
  return (
    <div>
      <h4 className="flex items-baseline gap-2 text-[13px] font-semibold">
        {title}
        <span className="rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-semibold tabular-nums">{count}</span>
      </h4>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={title}>
        {children}
      </ul>
    </div>
  )
}

const chip = 'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] leading-none'

/**
 * İlan ↔ CV anlamına göre karşılaştırma: kurallı eşleşmenin altında, düğmeyle
 * başlar. Kurallı sonucu değiştirmez; eş anlamlı ve kısaltmaları ayrıca gösterir.
 */
export function KeywordAiMatch({ match, cv, pdf, jobAd }: { match: KeywordMatch; cv: Cv | null; pdf: PdfText | null; jobAd: string }) {
  const provider = getAiProvider()
  const source = useMemo(() => reviewSource(cv, pdf, match.language), [cv, pdf, match.language])
  const nameFound = useMemo(() => !source || reviewNameFound(source), [source])
  const task = useAiTask<{ result: KeywordMatchResult; ad: string; sourceId: unknown }>()
  const [showPayload, setShowPayload] = useState(false)
  const ad = jobAd.trim()
  // Sonuç yalnız geldiği kaynakta (CV ya da yüklenen PDF) görünür.
  const sourceId = cv?.id ?? pdf
  if (!source) return null

  // "Ne gönderilir?" ve gönderim aynı girdilerden kurulur.
  const build = () => buildKeywordMatchRequest(source, ad, match)
  const run = () =>
    void task.run(async (signal) => {
      const prepared = build()
      const result = parseKeywordMatchResult(await provider.matchKeywords(prepared.request, signal))
      return { result: prepared.finish(result), ad, sourceId }
    })

  const { state } = task
  const done = state.status === 'done' && state.value.sourceId === sourceId ? state.value : null
  const stale = done !== null && done.ad !== ad
  const result = done && !stale ? done.result : null
  const total = result ? result.matched.length + result.missing.length + result.related.length : 0

  return (
    <div className="mt-5 border-t border-line pt-4" data-testid="keyword-ai">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold">
        {m.rv_kw_ai_title()}
        {result && provider.isDemo && <DemoBadge />}
      </h3>
      <p className="mt-0.5 text-[13px] text-muted">
        {m.rv_kw_ai_body()}
        {provider.isDemo && <> {m.rv_kw_ai_body_demo()}</>}
      </p>
      {!nameFound && <NameMissingNote />}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {state.status === 'running' ? (
          <>
            <span role="status" className="inline-flex h-7 items-center gap-2 text-[13px] text-muted">
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
              {m.rv_kw_ai_running()}
            </span>
            <Button size="sm" variant="ghost" onClick={task.cancel}>
              <Square className="!size-3 fill-current" aria-hidden />
              {m.ai_stop()}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={run}>
            {done ? m.rv_kw_ai_again() : m.rv_kw_ai_run()}
          </Button>
        )}
        <WhatIsSentButton className="ml-auto text-[13px]" onClick={() => setShowPayload(true)} />
      </div>

      {state.status === 'error' && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger animate-fade-in">
          {state.message}
        </p>
      )}
      {stale && <p className="mt-3 text-[13px] text-muted">{m.rv_kw_ai_stale()}</p>}
      {result && total === 0 && <p className="mt-3 text-sm">{m.rv_kw_ai_none()}</p>}

      {result && total > 0 && (
        <div className="mt-4 flex flex-col gap-4 animate-rise-in">
          <TermGroup title={m.rv_kw_ai_related()} count={result.related.length} hint={m.rv_kw_ai_related_hint()}>
            {result.related.map((r) => (
              <li key={r.term} className={cn(chip, 'border-line bg-surface-2')} aria-label={m.rv_kw_ai_pair({ term: r.term, cvTerm: r.cvTerm })}>
                <span className="break-all">{r.term}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="break-all text-muted">{r.cvTerm}</span>
              </li>
            ))}
          </TermGroup>
          <TermGroup title={m.rv_kw_missing()} count={result.missing.length}>
            {result.missing.map((term) => (
              <li key={term} className={cn(chip, 'border-dashed border-line-strong bg-surface')}>
                <span className="break-all">{term}</span>
              </li>
            ))}
          </TermGroup>
          <TermGroup title={m.rv_kw_present()} count={result.matched.length}>
            {result.matched.map((term) => (
              <li key={term} className={cn(chip, 'border-line bg-surface-2')}>
                <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
                <span className="break-all">{term}</span>
              </li>
            ))}
          </TermGroup>
        </div>
      )}

      <AiPayloadDialog
        open={showPayload}
        onClose={() => setShowPayload(false)}
        build={() => build().request}
        description={m.rv_kw_ai_payload_desc()}
        rules={m.rv_kw_ai_payload_rules()}
        warning={nameFound ? undefined : m.rv_ai_name_missing_payload()}
        demo={provider.isDemo}
      />
    </div>
  )
}
