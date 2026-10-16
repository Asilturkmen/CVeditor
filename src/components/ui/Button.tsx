import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'icon' | 'icon-sm'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm disabled:bg-surface-3 disabled:text-faint disabled:shadow-none',
  secondary:
    'bg-surface text-text border border-line-strong hover:bg-surface-2 hover:border-faint/60 shadow-sm disabled:text-faint',
  ghost: 'text-muted hover:text-text hover:bg-surface-2 disabled:text-faint disabled:hover:bg-transparent',
  quiet: 'text-text hover:bg-surface-2 disabled:text-faint',
  danger: 'bg-danger text-white hover:brightness-95 shadow-sm dark:text-black',
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  icon: 'size-9 rounded-lg justify-center',
  'icon-sm': 'size-7 rounded-md justify-center',
}

/** Düğme görünümü; düğme olmayan öğelerde (ör. `Link`) aynı sınıfları kullanmak için. */
export function buttonClass({ variant = 'secondary', size = 'md', className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    'inline-flex shrink-0 items-center font-medium whitespace-nowrap select-none',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out',
    'active:translate-y-px disabled:active:translate-y-0',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    className,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  )
})
