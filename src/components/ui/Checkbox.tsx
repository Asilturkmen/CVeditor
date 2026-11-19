import { Checkbox as C, RadioGroup as R } from 'radix-ui'
import { Check, Minus } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const box = cn(
  'inline-flex size-4 shrink-0 items-center justify-center bg-content shadow-[inset_0_0_0_1px_var(--control-border)]',
  'transition-colors duration-150 outline-offset-2',
  'data-[state=checked]:bg-accent data-[state=checked]:shadow-none data-[state=indeterminate]:bg-accent data-[state=indeterminate]:shadow-none',
  'disabled:cursor-not-allowed disabled:opacity-40',
)

/**
 * Onay kutusu: 16px, yarıçap 4; boşken kenar (3:1), doluyken vurgu zemin + beyaz işaret (yayla gelir).
 * `checked="indeterminate"` tire. `label` verilirse kutu + etiket tek tıklama alanıdır (8px ara).
 * Hiyerarşik seçenek listesi için; tek ayarı vurgulamak için anahtar.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id: idProp,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}) {
  const autoId = useId()
  const id = idProp ?? autoId
  const control = (
    <C.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(box, 'rounded-xs', !label && className)}
    >
      <C.Indicator className="flex animate-[check-in_300ms_var(--spring-bouncy)] items-center justify-center text-accent-fg">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3.5} /> : <Check className="size-3" strokeWidth={3.5} />}
      </C.Indicator>
    </C.Root>
  )
  if (!label) return control
  return (
    <label
      htmlFor={id}
      className={cn('inline-flex cursor-pointer items-start gap-2 text-body text-fg has-disabled:cursor-not-allowed', className)}
    >
      <span className="flex h-[18px] items-center">{control}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={disabled ? 'text-fg-3' : undefined}>{label}</span>
        {description && <span className="text-callout text-fg-2">{description}</span>}
      </span>
    </label>
  )
}

/** Radyo grubu: seçenekler `RadioItem`. Satır görünümlü seçimler (başlangıç türü) için `RadioRow`. */
export function RadioGroup({
  value,
  onValueChange,
  children,
  className,
  'aria-label': ariaLabel,
  orientation = 'vertical',
}: {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
  'aria-label'?: string
  orientation?: 'vertical' | 'horizontal'
}) {
  return (
    <R.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      orientation={orientation}
      className={cn('flex', orientation === 'vertical' ? 'flex-col gap-2' : 'flex-wrap gap-4', className)}
    >
      {children}
    </R.Root>
  )
}

const dot = cn(
  'inline-flex shrink-0 items-center justify-center rounded-full bg-content shadow-[inset_0_0_0_1px_var(--control-border)]',
  'transition-colors duration-150 outline-offset-2',
  'data-[state=checked]:bg-accent data-[state=checked]:shadow-none',
  'disabled:cursor-not-allowed disabled:opacity-40',
)

/** Radyo: 16px daire; seçiliyken vurgu zemin + 6px beyaz nokta. Etiket sağda, tek tıklama alanı. */
export function RadioItem({
  value,
  label,
  description,
  disabled,
}: {
  value: string
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-start gap-2 text-body text-fg has-disabled:cursor-not-allowed">
      <span className="flex h-[18px] items-center">
        <R.Item id={id} value={value} disabled={disabled} className={cn(dot, 'size-4')}>
          <R.Indicator className="block size-1.5 animate-[check-in_300ms_var(--spring-bouncy)] rounded-full bg-accent-fg" />
        </R.Item>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={disabled ? 'text-fg-3' : undefined}>{label}</span>
        {description && <span className="text-callout text-fg-2">{description}</span>}
      </span>
    </label>
  )
}

/**
 * Satır görünümlü radyo (şablon, başlangıç türü): satırın tamamı seçim; 20px daire işaret, başlık +
 * açıklama, seçiliyken yumuşak vurgu zemini. `Group` içinde kullan (ayırıcıları grup koyar);
 * seçili satırın altında ek alan açılacaksa `children`.
 */
export function RadioRow({
  value,
  title,
  description,
  icon,
  disabled,
  selected,
  children,
}: {
  value: string
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  disabled?: boolean
  /** Grubun değeri bu satır mı (zemin ve ek alan için). */
  selected: boolean
  children?: ReactNode
}) {
  const id = useId()
  return (
    <div className={cn('transition-colors duration-150', selected && 'bg-accent-soft')}>
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-14 cursor-pointer items-start gap-3 px-[var(--row-px)] py-3',
          disabled ? 'cursor-not-allowed' : !selected && 'hover:bg-fill-4',
        )}
      >
        <R.Item id={id} value={value} disabled={disabled} className={cn(dot, 'mt-px size-5')}>
          <R.Indicator className="block size-2 animate-[check-in_300ms_var(--spring-bouncy)] rounded-full bg-accent-fg" />
        </R.Item>
        {icon && <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', selected ? 'text-accent' : 'text-fg-2')}>{icon}</span>}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-body', disabled ? 'text-fg-3' : 'text-fg', selected && 'font-semibold')}>{title}</span>
          {description && <span className="text-callout text-fg-2">{description}</span>}
        </span>
      </label>
      {selected && children && <div className="px-[var(--row-px)] pb-3 pl-[calc(var(--row-px)+32px)]">{children}</div>}
    </div>
  )
}
