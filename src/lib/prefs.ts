import { create } from 'zustand'

/**
 * Site tercihleri (tema, vurgu rengi). CV verisi değildir; anında
 * uygulanabilsin diye localStorage'da durur (index.html ilk boyamadan önce okur).
 */

/**
 * Vurgu seçenekleri: açık ve koyu tema için ayrı değer (koyu, açıktan türetilmez).
 * Kural: beyaz yazıyla ≥ 4.5:1 ve gri pencerede metin olarak ≥ 4.5:1. index.html ilk boyama haritası aynı liste.
 */
export const ACCENTS = [
  { id: 'petrol', color: '#00786f', dark: '#2cc7b5' },
  { id: 'murekkep', color: '#0a5fd8', dark: '#5cb8ff' },
  { id: 'kiremit', color: '#b8500f', dark: '#ffa056' },
  { id: 'orman', color: '#1b7f3b', dark: '#4ad968' },
  { id: 'grafit', color: '#48484a', dark: '#d1d1d6' },
] as const

export type AccentId = (typeof ACCENTS)[number]['id']
export type Theme = 'light' | 'dark'

const THEME_KEY = 'cveditor:theme'
const ACCENT_KEY = 'cveditor:accent'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Özel pencere ya da engellenmiş depolama: tercih yalnız bu oturumda kalır.
  }
}

function apply(theme: Theme, accent: AccentId) {
  const root = document.documentElement
  root.dataset.theme = theme
  const option = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]
  root.style.setProperty('--accent-light', option.color)
  root.style.setProperty('--accent-dark', option.dark)
}

interface PrefsState {
  theme: Theme
  accent: AccentId
  setTheme: (theme: Theme) => void
  setAccent: (accent: AccentId) => void
}

const initialTheme: Theme = read(THEME_KEY) === 'dark' ? 'dark' : 'light'
const storedAccent = read(ACCENT_KEY)
const initialAccent: AccentId = ACCENTS.some((a) => a.id === storedAccent) ? (storedAccent as AccentId) : 'petrol'

export const usePrefs = create<PrefsState>((set, get) => ({
  theme: initialTheme,
  accent: initialAccent,
  setTheme(theme) {
    write(THEME_KEY, theme)
    apply(theme, get().accent)
    set({ theme })
  },
  setAccent(accent) {
    write(ACCENT_KEY, accent)
    apply(get().theme, accent)
    set({ accent })
  },
}))

apply(initialTheme, initialAccent)
