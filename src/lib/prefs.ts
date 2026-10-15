import { create } from 'zustand'

/**
 * Site tercihleri (tema, vurgu rengi). CV verisi değildir; anında
 * uygulanabilsin diye localStorage'da durur (index.html ilk boyamadan önce okur).
 */

export const ACCENTS = [
  { id: 'petrol', color: '#1f6f6b' },
  { id: 'murekkep', color: '#2b4f81' },
  { id: 'kiremit', color: '#a8502d' },
  { id: 'orman', color: '#2f6a3c' },
  { id: 'grafit', color: '#45443f' },
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
  const color = ACCENTS.find((a) => a.id === accent)?.color ?? ACCENTS[0].color
  root.style.setProperty('--accent-base', color)
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
