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
