import { Popover as P } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Popover: menüyle aynı opak yüzey (yarıçap 12, gölge 3), iç boşluk 12-16, en çok 360px.
 * Tetikleyicisini örtmez; aynı anda tek popover; içinden popover açılmaz; uyarı popover'da gösterilmez.
 * Dışına tıklanınca kapanır ve yapılan iş kaydedilir (iptal yok). Tetikleyiciden büyür.
 */
export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close
export const PopoverAnchor = P.Anchor

export function PopoverContent({
  children,
  align = 'center',
  side = 'bottom',
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  'aria-label'?: string
}) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={8}
        aria-label={ariaLabel}
        className={cn('pop z-50 max-w-90 rounded-xl bg-elevated p-4 text-body text-fg shadow-3 outline-none', className)}
      >
        {children}
      </P.Content>
    </P.Portal>
  )
}
