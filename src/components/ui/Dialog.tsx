import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { buttonClass } from './buttonClass'
import { useScrollEdge } from './useScrollEdge'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Eylem satırı: sağa yaslı; solda Vazgeç (secondary), sağda eylem (primary). `lg` düğme kullan. */
  footer?: ReactNode
  /** md 480px (varsayılan), lg 640px (geniş içerik). */
  size?: 'md' | 'lg'
  /** Sağ üst kapat düğmesi. Varsayılan: yalnız eylem satırı yoksa. */
  closeButton?: boolean
  className?: string
}

/**
 * Dialog: kısa, odaklı iş (CV içeriği dialogda düzenlenmez). Opak yüzey, yarıçap 16, iç boşluk 20,
 * en çok 85dvh; yalnız gövde kayar. Telefonda (< 640px) alt sayfa olur: alt kenara yapışık,
 * üst köşeler 20, tutamaklı, eylemler tam genişlik ve birincil üstte.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeButton,
  className,
}: DialogProps) {
  const showClose = closeButton ?? !footer
  // Gövde kayınca başlığın altında ince kaydırma kenarı belirir (içerik başlığın altına girmiş görünmesin).
  const [body, setBody] = useState<HTMLDivElement | null>(null)
  const bodyRef = useMemo(() => ({ current: body }), [body])
  const scrolled = useScrollEdge(bodyRef, 'top')
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-50 bg-[var(--overlay)]" />
        <D.Content
          className={cn(
            'dialog fixed z-50 flex flex-col bg-elevated shadow-4 outline-none',
            // Masaüstü: ortada kart
            'sm:top-1/2 sm:left-1/2 sm:max-h-[85dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            size === 'lg' ? 'w-[min(92vw,640px)]' : 'w-[min(92vw,480px)]',
            // Telefon: alt sayfa (genişlik className ile verilse de tam genişlik)
            'max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-auto! max-sm:rounded-t-3xl max-sm:pb-[env(safe-area-inset-bottom)]',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-fill-1 sm:hidden" />
          <div data-scrolled={scrolled ? '' : undefined} className="scroll-edge-bottom flex items-start gap-4 px-5 pt-5 pb-3 max-sm:pt-3">
            <div className="min-w-0 flex-1">
              <D.Title className="text-title-2 text-fg">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-body text-fg-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            {showClose && (
              <D.Close
                className={buttonClass({ variant: 'ghost', size: 'icon', className: '-mt-1 -mr-1.5' })}
                aria-label={m.common_close()}
              >
                <X />
              </D.Close>
            )}
          </div>
          <div ref={setBody} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">
            {children}
          </div>
          {footer && (
            <div
              className={cn(
                'flex shrink-0 items-center justify-end gap-2 px-5 pb-5',
                // Telefonda birincil (son) üstte, hepsi tam genişlik 44px.
                'max-sm:flex-col-reverse max-sm:items-stretch max-sm:[&>button]:h-11 max-sm:[&>button]:w-full max-sm:[&>button]:rounded-full',
              )}
            >
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
