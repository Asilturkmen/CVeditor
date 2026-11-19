import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ToolbarProps extends HTMLAttributes<HTMLElement> {
  /** İçerik altına girmiş mi (`useScrollEdge`). Alt çizgi yalnız o zaman. */
  scrolled?: boolean
  /** lg 52px (üst çubuk) · md 44px (inspector başlığı). */
  size?: 'md' | 'lg'
  /** Çizgi hangi kenarda: üst çubukta alt, alttaki prompt çubuğunda üst. */
  edge?: 'bottom' | 'top'
  as?: 'header' | 'div' | 'footer' | 'nav'
  children: ReactNode
}

/**
 * Malzemeli yapışkan çubuk. Malzeme YALNIZ dört yerde: üst çubuk, inspector başlığı, alttaki prompt
 * çubuğu, yüzen zoom hapı. Üstündeki metin ve ikon yalnız birincil renk (gri metin yok).
 * Üç bölge: baş (geri, başlık), orta (sık kontroller ya da boş), son (eylemler, ⋯, en sağda tek birincil).
 * Bölgeleri `ToolbarSection` ile kur; gruplar arası 8px.
 */
export function Toolbar({ scrolled, size = 'lg', edge = 'bottom', as: As = 'header', className, children, ...props }: ToolbarProps) {
  return (
    <As
      data-scrolled={scrolled ? '' : undefined}
      className={cn(
        'material z-30 flex items-center gap-2 text-fg',
        edge === 'bottom' ? 'scroll-edge-bottom' : 'scroll-edge-top',
        size === 'lg' ? 'min-h-13' : 'min-h-11',
        className,
      )}
      {...props}
    >
      {children}
    </As>
  )
}

/** Çubuk bölgesi: `grow` ile esner (başlık bölgesi). */
export function ToolbarSection({
  children,
  grow,
  className,
}: {
  children: ReactNode
  grow?: boolean
  className?: string
}) {
  return <div className={cn('flex min-w-0 items-center gap-2', grow && 'flex-1', className)}>{children}</div>
}

/**
 * İşleve göre gruplanmış ikon düğmeleri: 36px gri kapsül, iç boşluk 4, içinde 28px yuvarlak ikon
 * düğmeleri arasız. Bir grupta yazı ile ikon karışmaz.
 */
export function ToolbarGroup({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('inline-flex h-9 shrink-0 items-center rounded-full bg-fill-3 px-1 [&_button]:rounded-full', className)}
    >
      {children}
    </div>
  )
}

/**
 * Yüzen hap (zoom hapı, tuval sayfa hapı): malzeme + gölge, 36px kapsül, içinde 28px ikon düğmeleri,
 * yüzde/sayfa düz metin (tabular). Konumu çağıran verir (ör. `absolute right-4 bottom-4`).
 */
export function FloatingPill({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'material inline-flex h-9 items-center gap-0.5 rounded-full px-1 text-fg shadow-2 [&_button]:rounded-full',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Hap içinde bölmeler arası ince dikey çizgi (16px). */
export function PillDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-separator" />
}
