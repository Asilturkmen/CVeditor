import { Switch as S } from 'radix-ui'
import { cn } from '@/lib/cn'

/**
 * Anahtar: tek bir ayarı aç/kapat (koyu tema, fotoğraf). 40×24; kapalı ray gri, açık ray vurgu.
 * Top yayla kayar, basılıyken genişler. Satırın tamamı tıklanır (etiketi `htmlFor` ile bağla ya da
 * GroupRow içinde `as="label"`). Araç çubuğunda anahtar olmaz.
 */
export function Switch({
  checked,
  onCheckedChange,
  id,
  className,
  disabled,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
}) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={cn(
        'group relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
        'bg-fill-1 data-[state=checked]:bg-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      <S.Thumb
        className={cn(
          'block h-5 w-5 rounded-full bg-[var(--switch-knob)] shadow-[var(--shadow-knob)]',
          'transition-[translate,width] duration-[280ms] ease-spring-snappy',
          'data-[state=checked]:translate-x-4',
          'group-enabled:group-active:w-6 group-enabled:group-active:data-[state=checked]:translate-x-3',
        )}
      />
    </S.Root>
  )
}
