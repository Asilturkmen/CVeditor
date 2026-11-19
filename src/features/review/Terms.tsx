import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Anahtar kelime: CV'de olan gri dolgu + onay, olmayan yalnız ince kenar (renk tek işaret değil).
 * 24px, yarıçap 6; uzun terim sarar.
 */
export function TermChip({
  present,
  children,
  title,
  'aria-label': ariaLabel,
}: {
  present: boolean
  children: ReactNode
  title?: string
  'aria-label'?: string
}) {
  return (
    <li
      title={title}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex min-h-6 max-w-full items-center gap-1 rounded-sm px-2 py-0.5 text-callout text-fg',
        present ? 'bg-fill-3' : 'shadow-[inset_0_0_0_1px_var(--separator-strong)]',
      )}
    >
      {children}
    </li>
  )
}

/** Başlık + düz sayı + (varsa) açıklama + terimler. */
export function TermList({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="flex items-baseline gap-1.5 text-headline text-fg">
        {title}
        <span className="font-normal text-fg-2 tabular-nums">{count}</span>
      </h4>
      {hint && count > 0 && <p className="mt-0.5 text-callout text-fg-2">{hint}</p>}
      {count > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={title}>
          {children}
        </ul>
      )}
    </div>
  )
}
