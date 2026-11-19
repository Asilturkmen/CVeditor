import { Check } from 'lucide-react'
import type { PdfText } from '@/ai/pdfText'
import type { Cv } from '@/cv/schema'
import { m } from '@/paraglide/messages'
import type { Keyword, KeywordMatch } from '@/review/keywords'
import { KeywordAiMatch } from './KeywordAiMatch'
import { TermChip, TermList } from './Terms'

function Chip({ keyword }: { keyword: Keyword }) {
  return (
    <TermChip title={m.rv_kw_count({ count: keyword.count })}>
      <span>{keyword.term}</span>
      {keyword.count > 1 && <span className="ml-1 text-fg-2 tabular-nums">×{keyword.count}</span>}
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
          // Geniş sütunda Eksik ve Var yan yana; dar ekranda alt alta.
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <TermList title={m.rv_kw_missing()} count={match.missing.length} hint={m.rv_kw_missing_hint()}>
                {match.missing.map((k) => (
                  <Chip key={k.key} keyword={k} />
                ))}
              </TermList>
              {match.missing.length === 0 && <p className="text-body text-fg">{m.rv_kw_all_present()}</p>}
            </div>
            <TermList title={m.rv_kw_present()} count={match.present.length} icon={<Check className="text-ok" />}>
              {match.present.map((k) => (
                <Chip key={k.key} keyword={k} />
              ))}
            </TermList>
          </div>
        )}
      </section>
      {ai && total > 0 && <KeywordAiMatch match={match} cv={ai.cv} pdf={ai.pdf} jobAd={ai.jobAd} />}
    </>
  )
}
