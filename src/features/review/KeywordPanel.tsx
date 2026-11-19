import { Check } from 'lucide-react'
import type { PdfText } from '@/ai/pdfText'
import type { Cv } from '@/cv/schema'
import { m } from '@/paraglide/messages'
import type { Keyword, KeywordMatch } from '@/review/keywords'
import { KeywordAiMatch } from './KeywordAiMatch'
import { TermChip, TermList } from './Terms'

function Chip({ keyword, present }: { keyword: Keyword; present: boolean }) {
  return (
    <TermChip title={m.rv_kw_count({ count: keyword.count })} present={present}>
      {present && <Check className="size-3.5 shrink-0 text-ok" aria-hidden />}
      <span className="break-all">{keyword.term}</span>
      {keyword.count > 1 && <span className="text-fg-2 tabular-nums">×{keyword.count}</span>}
    </TermChip>
  )
}

/**
 * İlan ↔ CV anahtar kelime karşılaştırması: Eksik ve Var, önem sırasıyla (İş ilanı grubunun
 * satırları). `ai` verilirse altında anlamına göre karşılaştırma (yapay zekâ) satırı durur.
 */
export function KeywordPanel({
  match,
  ai,
}: {
  match: KeywordMatch
  ai?: { cv: Cv | null; pdf: PdfText | null; jobAd: string }
}) {
  const total = match.present.length + match.missing.length
  return (
    <>
      <section aria-labelledby="rv-kw" className="flex flex-col gap-4 px-[var(--row-px)] py-3">
        <div>
          <h3 id="rv-kw" className="text-headline text-fg">
            {m.rv_kw_title()}
          </h3>
          <p className="mt-0.5 text-callout text-fg-2">{m.rv_kw_note()}</p>
        </div>
        {total === 0 ? (
          <p className="text-body text-fg">{m.rv_kw_none()}</p>
        ) : (
          <>
            <TermList title={m.rv_kw_missing()} count={match.missing.length} hint={m.rv_kw_missing_hint()}>
              {match.missing.map((k) => (
                <Chip key={k.key} keyword={k} present={false} />
              ))}
            </TermList>
            {match.missing.length === 0 && <p className="-mt-2 text-body text-fg">{m.rv_kw_all_present()}</p>}
            <TermList title={m.rv_kw_present()} count={match.present.length}>
              {match.present.map((k) => (
                <Chip key={k.key} keyword={k} present />
              ))}
            </TermList>
          </>
        )}
      </section>
      {ai && total > 0 && <KeywordAiMatch match={match} cv={ai.cv} pdf={ai.pdf} jobAd={ai.jobAd} />}
    </>
  )
}
