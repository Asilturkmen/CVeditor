import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Alt sayfa (telefon): alt kenara yapışık, üst köşeler 20, üstte 36×5 tutamak, alttan yayla gelir.
 * Telefonda eylem listesi ve kısa işler için (⋯ menüsünün telefondaki karşılığı). `Dialog` telefonda
 * zaten alt sayfa olur; bunu yalnız her genişlikte alt sayfa gereken yerde kullan.
 * Birincil düğme tam genişlik `xl` (44), altında Vazgeç düz düğme; `env(safe-area-inset-bottom)` korunur.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-[var(--overlay)]" />
        <D.Content
          className={cn(
            'sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-3xl bg-elevated shadow-4 outline-none',
            'pb-[max(16px,env(safe-area-inset-bottom))]',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-fill-1" />
          <div className="px-5 pt-3">
            <D.Title className="text-title-2 text-fg">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-body text-fg-2">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const SheetClose = D.Close
