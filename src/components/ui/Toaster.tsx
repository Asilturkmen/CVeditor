import { useEffect, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { buttonClass } from './buttonClass'
import { toastDuration, useToasts, type Toast } from './toast'

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  // Fare üstündeyken ya da odak içindeyken süre işlemez: "Geri al"a uzanırken bildirim kaybolmasın.
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused
  const remaining = useRef(toastDuration(t))

  useEffect(() => {
    // Süresiz bildirim (ör. "sayfayı yenile") kendiliğinden kapanmaz.
    if (paused || remaining.current === Infinity) return
    const startedAt = Date.now()
    const timer = setTimeout(() => dismiss(t.id), remaining.current)
    return () => {
      clearTimeout(timer)
      // Duraklatılınca kalan süre saklanır; en az bir saniye bırakılır ki fare çekilir çekilmez kapanmasın.
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt))
    }
  }, [t.id, paused, dismiss])

  const error = t.tone === 'error'
  return (
    <div
      role="status"
      data-toast
      data-tone={error ? 'error' : 'default'}
      data-paused={paused ? '' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
      className={cn(
        // Kapsül, temayla aynı yüzey (ters renk değil); renk yalnız durum ikonunda.
        'toast-enter pointer-events-auto flex min-h-10 max-w-full items-center gap-2 rounded-[20px] bg-elevated py-2 text-body text-fg shadow-2',
        t.action ? 'pr-1.5' : 'pr-4',
        error ? 'pl-3' : 'pl-4',
      )}
    >
      {error && <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />}
      <span className="min-w-0 flex-1">{t.message}</span>
      {t.action && (
        <button
          type="button"
          data-toast-action
          onClick={() => {
            t.action!.run()
            dismiss(t.id)
          }}
          // Düz vurgu düğmesi; yüzey her tonda aynı olduğu için renk tona göre değişmez.
          className={buttonClass({ variant: 'plain', size: 'md', className: 'rounded-full font-semibold' })}
        >
          {t.action.label}
        </button>
      )}
    </div>
  )
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return (
    // Konum varsayılanı pencerenin alt ortası; editör tuvalin alt ortasına (hapın üstüne) taşır:
    // --toast-x, --toast-bottom, --toast-max (features/editor/PreviewPane.tsx useToastAnchor).
    <div className="pointer-events-none fixed bottom-[var(--toast-bottom,1.5rem)] left-[var(--toast-x,50%)] z-[70] flex w-[min(92vw,var(--toast-max,480px),480px)] -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  )
}
