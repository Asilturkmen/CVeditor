import { create } from 'zustand'

/**
 * Sayfa içi kısa bildirim. Geri dönüşsüz görünen işlemlerden sonra
 * "Geri al" eylemi taşır (ör. CV silme). Gösterimi `Toaster` bileşeni yapar.
 */
export interface Toast {
  id: number
  message: string
  tone?: 'default' | 'error'
  action?: { label: string; run: () => void }
  /** ms; `Infinity` kendiliğinden kapanmaz */
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

/** Aynı anda en fazla bu kadar bildirim görünür; fazlası olunca en eski düz bildirim düşer. */
export const MAX_TOASTS = 3

/**
 * Düşürülmeyen bildirim: eylemi olan ("Geri al" kaybolursa silinen şey geri getirilemez) ya da
 * süresiz olan (ör. "sayfayı yenile"). Bunlar kuyruk taşsa da yerinde kalır.
 */
export const isStickyToast = (toast: Pick<Toast, 'action' | 'duration'>) => !!toast.action || toast.duration === Infinity

/** Varsayılan süre: eylemli bildirim daha uzun kalır. */
export const toastDuration = (toast: Pick<Toast, 'action' | 'duration'>) => toast.duration ?? (toast.action ? 7000 : 3500)

/** Kuyruğa yeni bildirim ekler; sınır aşılırsa yalnız eski DÜZ bildirimler düşer. */
export function enqueueToast(toasts: Toast[], next: Toast): Toast[] {
  const all = [...toasts, next]
  let overflow = all.length - MAX_TOASTS
  if (overflow <= 0) return all
  return all.filter((t) => {
    if (overflow <= 0 || t === next || isStickyToast(t)) return true
    overflow--
    return false
  })
}

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = nextId++
    set((s) => ({ toasts: enqueueToast(s.toasts, { ...toast, id }) }))
    return id
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t)
