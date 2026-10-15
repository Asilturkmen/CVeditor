import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Option<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

/**
 * Seçili öğenin altındaki gösterge kayarak yer değiştirir: hangi seçeneğe
 * geçildiğini anlatan hareket. Klavye: ok tuşları.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
  stretch,
}: {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
  stretch?: boolean
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const el = refs.current.get(value)
    if (!el) return
    const update = () => setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, options.length])

  const move = (dir: 1 | -1) => {
    const enabled = options.filter((o) => !o.disabled)
    const index = enabled.findIndex((o) => o.value === value)
    const next = enabled[(index + dir + enabled.length) % enabled.length]
    onChange(next.value)
    refs.current.get(next.value)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center rounded-lg bg-surface-2 p-0.5',
        stretch && 'flex w-full',
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-md bg-surface shadow-sm ring-1 ring-line transition-[left,width] duration-200 ease-[var(--ease-out-soft)] dark:bg-surface-3"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) refs.current.set(option.value, el)
              else refs.current.delete(option.value)
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150',
              '[&_svg]:size-3.5',
              size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              stretch && 'flex-1',
              active ? 'text-text' : 'text-muted hover:text-text',
              option.disabled && 'text-faint hover:text-faint',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
