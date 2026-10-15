import { create } from 'zustand'
import type { OversizedBlock } from '@/render/paginate'

/** Yapay zekâ önerisi: tek bir alanın önceki/sonraki hâli. */
export interface Suggestion {
  id: string
  sectionId: string | null
  /** Kayıt id'si ya da kişisel bilgiler için 'personal' */
  target: string
  field: string
  before: string
  after: string
  rich: boolean
  note: string
}

export type AiScope = { kind: 'all' } | { kind: 'section'; sectionId: string } | { kind: 'item'; sectionId: string; itemId: string }

/**
 * Editörün kaydedilmeyen arayüz durumu: sekme, odak, yakınlaştırma,
 * sayfalama sonucu, bekleyen öneriler.
 */
interface EditorUiState {
  tab: 'content' | 'appearance'
  focusedItemId: string | null
  /** Sağ panelde kaydırılacak hedef; nonce aynı hedefe tekrar kaydırmayı sağlar */
  scrollTarget: { id: string; nonce: number } | null
  zoom: 'fit' | number
  pageCount: number
  oversized: OversizedBlock[]
  clipped: boolean
  suggestions: Suggestion[]
  aiScope: AiScope
  setTab: (tab: EditorUiState['tab']) => void
  focusItem: (id: string | null, scroll?: boolean) => void
  setZoom: (zoom: EditorUiState['zoom']) => void
  setPagination: (r: { pageCount: number; oversized: OversizedBlock[]; clipped: boolean }) => void
  setSuggestions: (s: Suggestion[]) => void
  removeSuggestions: (ids: string[]) => void
  setAiScope: (scope: AiScope) => void
  reset: () => void
}

const initial = {
  tab: 'content' as const,
  focusedItemId: null,
  scrollTarget: null,
  zoom: 'fit' as const,
  pageCount: 1,
  oversized: [],
  clipped: false,
  suggestions: [],
  aiScope: { kind: 'all' } as AiScope,
}

export const useEditorUi = create<EditorUiState>((set) => ({
  ...initial,
  setTab: (tab) => set({ tab }),
  focusItem: (id, scroll = false) =>
    set((s) => ({
      focusedItemId: id,
      scrollTarget: scroll && id ? { id, nonce: (s.scrollTarget?.nonce ?? 0) + 1 } : s.scrollTarget,
    })),
  setZoom: (zoom) => set({ zoom }),
  setPagination: ({ pageCount, oversized, clipped }) => set({ pageCount, oversized, clipped }),
  setSuggestions: (suggestions) => set({ suggestions }),
  removeSuggestions: (ids) => set((s) => ({ suggestions: s.suggestions.filter((x) => !ids.includes(x.id)) })),
  setAiScope: (aiScope) => set({ aiScope }),
  reset: () => set({ ...initial }),
}))
