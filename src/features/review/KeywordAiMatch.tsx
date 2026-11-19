import { ArrowRight, Check, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PdfText } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { buildKeywordMatchRequest, reviewNameFound, reviewSource } from '@/ai/review'
import type { KeywordMatchResult } from '@/ai/types'
import { parseKeywordMatchResult } from '@/ai/validate'
import type { Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { InlineNotice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { AiPayloadDialog, DemoBadge, NameMissingNote, WhatIsSentButton } from '@/features/ai/AiPayloadDialog'
import { useAiTask } from '@/features/ai/useAiTask'
import { m } from '@/paraglide/messages'
import type { KeywordMatch } from '@/review/keywords'
import { TermChip, TermList } from './Terms'

/**
 * İlan ↔ CV anlamına göre karşılaştırma: kurallı eşleşmenin altında (İş ilanı grubunun son
 * satırı), düğmeyle başlar. Kurallı sonucu değiştirmez; eş anlamlı ve kısaltmaları ayrıca gösterir.
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
    <section aria-labelledby="rv-kw-ai" className="flex flex-col gap-3 px-[var(--row-px)] py-3" data-testid="keyword-ai">
      <div>
        <h3 id="rv-kw-ai" className="flex items-center gap-2 text-headline text-fg">
          {m.rv_kw_ai_title()}
          {result && provider.isDemo && <DemoBadge />}
        </h3>
        <p className="mt-0.5 text-callout text-fg-2">
          {m.rv_kw_ai_body()}
          {provider.isDemo && <> {m.rv_kw_ai_body_demo()}</>}
        </p>
        {!nameFound && <NameMissingNote className="mt-2" />}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {state.status === 'running' ? (
          <>
            <span role="status" className="inline-flex h-7 items-center gap-2 text-body text-fg">
              <Spinner />
              {m.rv_kw_ai_running()}
            </span>
            <Button onClick={task.cancel}>
              <Square className="size-3! fill-current" aria-hidden />
              {m.ai_stop()}
            </Button>
          </>
        ) : (
          <Button onClick={run}>{done ? m.rv_kw_ai_again() : m.rv_kw_ai_run()}</Button>
        )}
        <WhatIsSentButton className="ml-auto" onClick={() => setShowPayload(true)} />
      </div>

      {state.status === 'error' && (
        <div role="alert" className="animate-fade-in">
          <InlineNotice tone="danger">{state.message}</InlineNotice>
        </div>
      )}
      {stale && <p className="text-callout text-fg-2">{m.rv_kw_ai_stale()}</p>}
      {result && total === 0 && <p className="text-body text-fg">{m.rv_kw_ai_none()}</p>}

      {result && total > 0 && (
        <div className="flex animate-rise-in flex-col gap-4">
          {result.related.length > 0 && (
            <TermList title={m.rv_kw_ai_related()} count={result.related.length} hint={m.rv_kw_ai_related_hint()}>
              {result.related.map((r) => (
                <TermChip key={r.term} present aria-label={m.rv_kw_ai_pair({ term: r.term, cvTerm: r.cvTerm })}>
                  <span className="break-all">{r.term}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-fg-2" aria-hidden />
                  <span className="break-all text-fg-2">{r.cvTerm}</span>
                </TermChip>
              ))}
            </TermList>
          )}
          {result.missing.length > 0 && (
            <TermList title={m.rv_kw_missing()} count={result.missing.length}>
              {result.missing.map((term) => (
                <TermChip key={term} present={false}>
                  <span className="break-all">{term}</span>
                </TermChip>
              ))}
            </TermList>
          )}
          {result.matched.length > 0 && (
            <TermList title={m.rv_kw_present()} count={result.matched.length}>
              {result.matched.map((term) => (
                <TermChip key={term} present>
                  <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
                  <span className="break-all">{term}</span>
                </TermChip>
              ))}
            </TermList>
          )}
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
    </section>
  )
}
