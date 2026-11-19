import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Option<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

const rail = {
  sm: 'h-6 rounded-sm',
  md: 'h-7 rounded-md',
  lg: 'h-8 rounded-md',
} as const

const segment = {
  sm: 'h-5 px-2 text-callout',
  md: 'h-6 px-3 text-body',
  lg: 'h-7 px-3.5 text-body',
} as const

/**
 * Segmented control: aynı nesnenin başka yüzü ya da 2-5 seçenekli ayar (İçerik | Görünüm, dil,
 * boyut, boşluk). Başka sayfaya gidiş için değil (o `NavPills`).
 * Ray gri dolgu, başparmak beyaz (koyuda gri) ve yayla kayar; seçim vurguyla doldurulmaz.
 * Segmentler eşit genişlikte; seçili 600, diğerleri 400, hepsi birincil renk. Kalınlaşınca
 * genişlik sıçramasın diye her etiket kalın kopyasıyla yer tutar. Ok tuşlarıyla (animasyonsuz).
 * Boyut: sm ray 24 · md 28 (varsayılan) · lg 32 (dialog, sayfa başlığı).
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
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'aria-label'?: string
  /** Kabın genişliğini doldur (segmentler yine eşit). */
  stretch?: boolean
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>())
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null)
  // Klavyeyle yapılan seçimde başparmak animasyonsuz yer değiştirir.
  const [instant, setInstant] = useState(true)

  useLayoutEffect(() => {
    const el = refs.current.get(value)
    if (!el) return
    const update = () => setThumb({ x: el.offsetLeft, width: el.offsetWidth })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, options.length])

  const move = (dir: 1 | -1) => {
    const enabled = options.filter((o) => !o.disabled)
    const index = enabled.findIndex((o) => o.value === value)
    const next = enabled[(index + dir + enabled.length) % enabled.length]
    setInstant(true)
    onChange(next.value)
    refs.current.get(next.value)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-grid auto-cols-fr grid-flow-col items-center bg-fill-3 p-0.5',
        rail[size],
        stretch && 'grid w-full',
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
      {thumb && (
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 bottom-0.5 left-0 bg-[var(--segment-thumb)] shadow-1',
            size === 'sm' ? 'rounded-[4px]' : 'rounded-sm',
            !instant && 'transition-transform duration-300 ease-spring-smooth',
          )}
          style={{ width: thumb.width, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value
        const text = typeof option.label === 'string' ? option.label : undefined
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
            data-label={text}
            onPointerDown={() => setInstant(false)}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5 rounded-sm whitespace-nowrap text-fg',
              '[&_svg]:size-4',
              segment[size],
              active ? 'font-semibold' : 'font-normal',
              // Kalın kopya görünmez yer tutar: seçim değişince genişlik sıçramaz.
              // gap-0: aradaki boşluk görünmez kopyaya da uygulanınca yazı 3px yukarı kayıyordu.
              text && 'flex-col gap-0 after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)]',
              option.disabled && 'cursor-not-allowed text-fg-3',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
