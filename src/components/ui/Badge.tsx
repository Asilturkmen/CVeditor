import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Rozet: yalnız bilgi taşımayan kısa işaret (TR / EN, "Örnek", "Gizli"). 18px, yarıçap 4, 11/500.
 * Sayaç rozet değildir (düz sayı yaz); değer rozet/hap içine alınmaz (düz ikincil metin).
 * `tone="warn"`: kullanıcıyı uyaran işaret ("Örnek").
 */
export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'warn'
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[18px] shrink-0 items-center rounded-xs px-1.5 text-caption whitespace-nowrap',
        tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-fill-3 text-fg',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Klavye tuşu ("/", "Ctrl+Z"): 18px, yarıçap 4, 11/500, ikincil renk. Dokunmatikte gizle (`pointer-coarse:hidden`). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-xs bg-fill-3 px-1 text-caption text-fg-2',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
