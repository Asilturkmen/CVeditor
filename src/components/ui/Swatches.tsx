import { Check } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { Tooltip } from './Tooltip'

/** #rrggbb rengin açık olup olmadığı (onay işaretinin rengi için). Hex değilse koyu sayılır. */
function isLight(color: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return l > 0.4
}

export interface Swatch {
  value: string
  /** Dairenin rengi (CSS rengi). İki renkli takımda `second` sağ yarı. */
  color: string
  second?: string
  /** Erişilebilir ad + ipucu ("Petrol"). */
  label: string
}

/**
 * Renk seçici: 24px daireler, aralarında 8px. Seçili: 2px vurgu halkası + 2px boşluk ve içinde onay.
 * Ad ipucu ve `aria-label`'da (yazılı hap değil). `role="radiogroup"`, ok tuşlarıyla.
 */
export function Swatches({
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: Swatch[]
  className?: string
  'aria-label'?: string
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const move = (dir: 1 | -1) => {
    const index = options.findIndex((o) => o.value === value)
    const next = options[(index + dir + options.length) % options.length]
    onChange(next.value)
    refs.current.get(next.value)?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-2', className)}
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
      {options.map((o) => {
        const active = o.value === value
        return (
          <Tooltip key={o.value} content={o.label}>
            <button
              ref={(el) => {
                if (el) refs.current.set(o.value, el)
                else refs.current.delete(o.value)
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              // Seçili yoksa (özel renk) ilk daire sekmeyle ulaşılır olsun.
              tabIndex={active || (!options.some((x) => x.value === value) && o === options[0]) ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                'press press-sm relative flex size-6 shrink-0 items-center justify-center rounded-full phone:size-11',
                active && 'shadow-[0_0_0_2px_var(--bg-content),0_0_0_4px_var(--accent)]',
              )}
            >
              <span
                aria-hidden
                className="absolute inset-0 m-auto size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
                style={{
                  background: o.second ? `linear-gradient(90deg, ${o.color} 50%, ${o.second} 50%)` : o.color,
                }}
              />
              {active && (
                <Check
                  aria-hidden
                  className="relative size-3.5"
                  style={{ color: isLight(o.second ?? o.color) ? '#1d1d1f' : '#ffffff' }}
                  strokeWidth={3}
                />
              )}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
