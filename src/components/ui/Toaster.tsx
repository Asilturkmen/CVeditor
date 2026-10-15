import { useEffect } from 'react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'

/**
 * Sayfa içi kısa bildirim. Geri dönüşsüz görünen işlemlerden sonra
 * "Geri al" eylemi taşır (ör. CV silme).
 */
export interface Toast {
  id: number
  message: string
  tone?: 'default' | 'error'
  action?: { label: string; run: () => void }
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id }] }))
    return id
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t)

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.duration ?? (t.action ? 7000 : 3500))
    return () => clearTimeout(timer)
  }, [t, dismiss])
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex min-h-11 items-center gap-3 rounded-xl border py-2 pr-2 pl-4 text-sm shadow-md',
        'animate-[pop-in_200ms_var(--ease-out-soft)]',
        t.tone === 'error' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-line bg-text text-bg',
      )}
    >
      <span className="flex-1">{t.message}</span>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action!.run()
            dismiss(t.id)
          }}
          className="rounded-lg px-2.5 py-1 font-semibold text-bg underline-offset-2 hover:bg-white/10 hover:underline dark:hover:bg-black/10"
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
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  )
}
