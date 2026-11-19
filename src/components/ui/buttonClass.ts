import { cn } from '@/lib/cn'

/**
 * Düğme türleri (DESIGN.md "Düğme"):
 * - primary: vurgu dolgulu; görünümde bir tane.
 * - secondary: gri dolgu (Vazgeç, Yükle, Dosya seç).
 * - plain: zeminsiz, vurgu renkli yazı ("+ Ekle", bağlantı görünümlü eylem).
 * - ghost / quiet: zeminsiz, nötr yazı (araç çubuğundaki yazılı eylem). İkisi aynı görünür; `quiet` eski ad.
 * - destructive: gri dolgu + kırmızı yazı. Asla dolgulu kırmızı, asla Enter'ın hedefi. `danger` eski ad.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'ghost' | 'quiet' | 'destructive' | 'danger'

/**
 * Boyutlar: sm 24 · md 28 (varsayılan; inspector, araç çubuğu, ayar satırı) · lg 36 kapsül (dialog, sayfa
 * başlığı, "PDF al") · xl 44 kapsül (telefon, boş durum). Telefonda (dokunmatik + dar) md ve lg de 44. İkon: icon 28 · icon-sm 24 · icon-lg 36 (telefonda 44).
 */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'bg-fill-3 text-fg hover:bg-fill-2 active:bg-fill-1',
  plain: 'text-accent hover:bg-fill-4 active:bg-fill-3',
  ghost: 'text-fg hover:bg-fill-4 active:bg-fill-3',
  quiet: 'text-fg hover:bg-fill-4 active:bg-fill-3',
  destructive: 'bg-fill-3 text-danger hover:bg-fill-2 active:bg-fill-1',
  danger: 'bg-fill-3 text-danger hover:bg-fill-2 active:bg-fill-1',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'press h-6 gap-1.5 rounded-sm px-2 text-callout font-medium [&_svg]:size-3.5',
  md: 'press h-7 gap-1.5 rounded-md px-3 text-body font-medium phone:h-11 phone:px-4',
  lg: 'press h-9 gap-1.5 rounded-full px-4 text-body font-medium phone:h-11',
  xl: 'press press-wide h-11 gap-2 rounded-full px-5 text-title-3',
  icon: 'press press-sm size-7 rounded-md phone:size-11',
  'icon-sm': 'press press-sm size-6 rounded-sm phone:size-11',
  'icon-lg': 'press size-9 rounded-full phone:size-11',
}

/** Düğme görünümü; düğme olmayan öğelerde (ör. `Link`) aynı sınıfları kullanmak için. */
export function buttonClass({
  variant = 'secondary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:active:bg-transparent',
    variants[variant],
    // Devre dışı dolgulu düğme dolgusunu korur (hover/basılı yok).
    variant === 'primary' &&'disabled:hover:bg-accent disabled:active:bg-accent',
    (variant === 'secondary' || variant === 'destructive' || variant === 'danger') &&
      'disabled:hover:bg-fill-3 disabled:active:bg-fill-3',
    sizes[size],
    className,
  )
}
