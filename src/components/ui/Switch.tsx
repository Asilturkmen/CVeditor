import { Switch as S } from 'radix-ui'
import { cn } from '@/lib/cn'

export function Switch({
  checked,
  onCheckedChange,
  id,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  className?: string
  'aria-label'?: string
}) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200',
        'bg-line-strong data-[state=checked]:bg-accent',
        className,
      )}
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-spring)] data-[state=checked]:translate-x-[17px] dark:bg-surface" />
    </S.Root>
  )
}
