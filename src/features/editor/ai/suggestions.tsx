import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FieldChangeSuggestion, Suggestion } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { diffHtml, diffText } from '@/render/diff'
import { sanitizeDiffHtml } from '@/render/richtext'
import { acceptSuggestions, rejectSuggestions } from './suggestionLogic'

/** Satırdaki öneri işareti: sarı (alan değişikliği) ya da kırmızı (kaldırma) nokta + ekran okuyucu metni. */
export function PendingDot({ kind }: { kind: 'field' | 'removeItem' | null }) {
  if (!kind) return null
  return (
    <span data-pending={kind} className="ml-1.5 inline-flex items-center align-middle">
      <span aria-hidden className={cn('size-2 rounded-full', kind === 'removeItem' ? 'bg-danger' : 'bg-suggest')} />
      <span className="sr-only">{m.ai_pending()}</span>
    </span>
  )
}

const diffClass = cn(
  'text-body-user break-words text-fg',
  '[&_del]:text-fg-2 [&_del]:line-through [&_del]:decoration-danger/70',
  '[&_ins]:rounded-xs [&_ins]:bg-suggest-soft [&_ins]:no-underline [&_ins]:shadow-[inset_0_-2px_0_var(--suggest)]',
  '[&_.sg-old]:text-fg-2 [&_.sg-old]:line-through [&_.sg-new]:mt-1.5 [&_.sg-new]:rounded-sm [&_.sg-new]:bg-suggest-soft [&_.sg-new]:px-1',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_p+p]:mt-1.5 [&_li+li]:mt-0.5',
)

/** Önerinin okunur farkı: silinen üstü çizili, eklenen sarı zeminli. */
export function DiffText({ s, className }: { s: FieldChangeSuggestion; className?: string }) {
  const html = s.rich ? diffHtml(s.before, s.after) : diffText(s.before, s.after)
  return <div className={cn(diffClass, className)} dangerouslySetInnerHTML={{ __html: sanitizeDiffHtml(html) }} />
}

/**
 * Kaydın içinde, alanın altında öneri: fark + yazılı "Reddet / Kabul et" (28px, aralarında 8px).
 * Kabul tek geri alma adımıdır; öneriden sonra alan elle değişirse öneri kendiliğinden düşer.
 */
export function FieldSuggestion({ s }: { s: FieldChangeSuggestion }) {
  return (
    <div
      data-field-suggestion
      className="mx-[calc(var(--row-px)-4px)] mt-1 mb-2 rounded-lg bg-suggest-soft/60 px-3 py-2.5 animate-rise-in"
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-callout text-fg">
        <span aria-hidden className="size-2 rounded-full bg-suggest" />
        <span className="font-medium">{m.ai_suggestion()}</span>
        {s.note && <span className="text-fg-2">· {s.note}</span>}
      </p>
      <DiffText s={s} />
      <div className="mt-2.5 flex justify-end gap-2">
        <Button onClick={() => rejectSuggestions([s])}>
          <X />
          {m.ai_reject()}
        </Button>
        <Button variant="primary" onClick={() => acceptSuggestions([s])}>
          <Check />
          {m.ai_accept()}
        </Button>
      </div>
    </div>
  )
}

/** Kaldırma önerisi: açık kaydın üstünde tek satır + yazılı düğmeler. */
export function RemoveSuggestion({ s }: { s: Suggestion }) {
  return (
    <div className="mx-[calc(var(--row-px)-4px)] mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 animate-rise-in">
      <span aria-hidden className="size-2 rounded-full bg-danger" />
      <span className="min-w-0 flex-1 text-callout text-fg">
        <span className="font-medium">{m.ai2_kind_remove()}</span>
        {s.note && <span className="text-fg-2"> · {s.note}</span>}
      </span>
      <Button onClick={() => rejectSuggestions([s])}>{m.ai_reject()}</Button>
      <Button variant="primary" onClick={() => acceptSuggestions([s])}>
        {m.ai_accept()}
      </Button>
    </div>
  )
}

