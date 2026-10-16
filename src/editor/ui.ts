import { create } from 'zustand'
import type { AiScope } from '@/ai/types'
import type { AnyItem } from '@/cv/schema'
import type { OversizedBlock } from '@/render/paginate'

export type { AiScope }

/** Yapay zekâ önerisi: tek bir alanın önceki/sonraki hâli. */
export interface FieldChangeSuggestion {
  kind: 'field'
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

/** Bölüme yeni kayıt ekleme önerisi (afterItemId null → sona). */
export interface AddItemSuggestion {
  kind: 'addItem'
  id: string
  sectionId: string
  afterItemId: string | null
  item: AnyItem
  note: string
}

/** Kaydı kaldırma önerisi; snapshot öneri anındaki kaydın JSON'u (sonradan değiştiyse uygulanmaz). */
export interface RemoveItemSuggestion {
  kind: 'removeItem'
  id: string
  sectionId: string
  itemId: string
  snapshot: string
  note: string
}

export type Suggestion = FieldChangeSuggestion | AddItemSuggestion | RemoveItemSuggestion

/** Önerinin önizlemede/panelde işaret ettiği kayıt id'si ('personal' olabilir). */
export function suggestionTargetId(s: Suggestion): string {
  return s.kind === 'field' ? s.target : s.kind === 'addItem' ? s.item.id : s.itemId
}

/**
 * CSS dizgisi içine güvenle yazılacak değer: harf, rakam, "_" ve "-" dışındaki
 * her karakter onaltılık kaçışla yazılır. Kayıt id'leri içe aktarılan
 * yedekten gelebilir; tırnak, süslü ayraç ya da "</style>" kural kıramaz.
 */
export function cssString(value: string): string {
  let out = ''
  for (const ch of value) out += /[A-Za-z0-9_-]/.test(ch) ? ch : `\\${ch.codePointAt(0)!.toString(16)} `
  return `"${out}"`
}

/** Bekleyen önerisi olan kayıtların yanındaki nokta işaretleri (editör formunda). */
export function pendingMarkerCss(suggestions: Suggestion[]): string {
  return suggestions
    .filter((s) => s.kind !== 'addItem')
    .map((s) => {
      const target = suggestionTargetId(s)
      const selector = `[id=${cssString(target === 'personal' ? 'personal-card' : `item-${target}`)}]`
      const color = s.kind === 'removeItem' ? 'var(--danger)' : '#e7c34a'
      return `${selector}{position:relative}${selector}::before{content:"";position:absolute;left:-14px;top:14px;width:6px;height:6px;border-radius:9999px;background:${color}}`
    })
    .join('')
}

/**
 * Editörün kaydedilmeyen arayüz durumu: sekme, odak, yakınlaştırma,
 * sayfalama sonucu, bekleyen öneriler.
 */
interface EditorUiState {
  tab: 'content' | 'appearance'
  /** Önizlemede vurgulanan kayıt: yalnız panelde odak o kayıttayken (ya da öneri üzerine gelinince) */
  focusedItemId: string | null
  /** En son odaklanılan kayıt; odak panelden çıkınca da kalır (kapsam menüsündeki "Seçili kayıt") */
  lastFocusedItemId: string | null
  /** Sağ panelde kaydırılacak hedef; nonce aynı hedefe tekrar kaydırmayı sağlar */
  scrollTarget: { id: string; nonce: number } | null
  /** Önizlemede gösterilecek öneri (data-sg-id) */
  reveal: { id: string; nonce: number } | null
  /** Kabulden sonra önizlemede kısa süre parlayacak kayıtlar */
  flash: { ids: string[]; nonce: number } | null
  zoom: 'fit' | number
  pageCount: number
  oversized: OversizedBlock[]
  clipped: boolean
  suggestions: Suggestion[]
  aiScope: AiScope
  setTab: (tab: EditorUiState['tab']) => void
  focusItem: (id: string | null, scroll?: boolean) => void
  /** Odak kayıttan çıktı: vurgu kalkar, "son odak" kalır */
  blurItem: (id: string) => void
  /** Yalnız önizleme vurgusu (son odağı değiştirmez) */
  highlightItem: (id: string | null) => void
  revealSuggestion: (id: string) => void
  flashItems: (ids: string[]) => void
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
  lastFocusedItemId: null,
  scrollTarget: null,
  reveal: null,
  flash: null,
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
      lastFocusedItemId: id ?? s.lastFocusedItemId,
      scrollTarget: scroll && id ? { id, nonce: (s.scrollTarget?.nonce ?? 0) + 1 } : s.scrollTarget,
    })),
  blurItem: (id) => set((s) => (s.focusedItemId === id ? { focusedItemId: null } : {})),
  highlightItem: (id) => set({ focusedItemId: id }),
  revealSuggestion: (id) => set((s) => ({ reveal: { id, nonce: (s.reveal?.nonce ?? 0) + 1 } })),
  flashItems: (ids) => set((s) => ({ flash: { ids, nonce: (s.flash?.nonce ?? 0) + 1 } })),
  setZoom: (zoom) => set({ zoom }),
  setPagination: ({ pageCount, oversized, clipped }) => set({ pageCount, oversized, clipped }),
  setSuggestions: (suggestions) => set({ suggestions }),
  removeSuggestions: (ids) => set((s) => ({ suggestions: s.suggestions.filter((x) => !ids.includes(x.id)) })),
  setAiScope: (aiScope) => set({ aiScope }),
  reset: () => set({ ...initial }),
}))
