import { Check } from 'lucide-react'
import type { PdfText } from '@/ai/pdfText'
import type { Cv } from '@/cv/schema'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import type { Keyword, KeywordMatch } from '@/review/keywords'
import { KeywordAiMatch } from './KeywordAiMatch'

function Chip({ keyword, present }: { keyword: Keyword; present: boolean }) {
  return (
    <li
      title={m.rv_kw_count({ count: keyword.count })}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] leading-none',
        present ? 'border-line bg-surface-2' : 'border-dashed border-line-strong bg-surface',
      )}
    >
      {present && <Check className="size-3.5 shrink-0 text-ok" aria-hidden />}
      <span className="break-all">{keyword.term}</span>
      {keyword.count > 1 && <span className="text-[11px] font-semibold text-muted tabular-nums">×{keyword.count}</span>}
    </li>
  )
}

function Group({ title, items, present, hint }: { title: string; items: Keyword[]; present: boolean; hint?: string }) {
  return (
    <div>
      <h3 className="flex items-baseline gap-2 text-[13px] font-semibold">
        {title}
        <span className="rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-semibold tabular-nums">{items.length}</span>
      </h3>
      {hint && items.length > 0 && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={title}>
          {items.map((k) => (
            <Chip key={k.key} keyword={k} present={present} />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * İlan ↔ CV anahtar kelime karşılaştırması: Eksik ve Var, önem sırasıyla.
 * `ai` verilirse altında anlamına göre karşılaştırma (yapay zekâ) düğmesi durur.
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
    <section aria-labelledby="rv-kw" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="rv-kw" className="text-[15px] font-semibold tracking-tight">
        {m.rv_kw_title()}
      </h2>
      <p className="mt-1 text-[13px] text-muted">{m.rv_kw_note()}</p>
      {total === 0 ? (
        <p className="mt-4 text-sm">{m.rv_kw_none()}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <Group title={m.rv_kw_missing()} items={match.missing} present={false} hint={m.rv_kw_missing_hint()} />
          {match.missing.length === 0 && <p className="-mt-2 text-sm">{m.rv_kw_all_present()}</p>}
          <Group title={m.rv_kw_present()} items={match.present} present />
        </div>
      )}
      {ai && total > 0 && <KeywordAiMatch match={match} cv={ai.cv} pdf={ai.pdf} jobAd={ai.jobAd} />}
    </section>
  )
}
