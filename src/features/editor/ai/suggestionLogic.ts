import { stripHtml } from '@/cv/factory'
import { toast } from '@/components/ui/toast'
import { applySuggestions } from '@/editor/actions'
import { suggestionTargetId, useEditorUi, type FieldChangeSuggestion, type Suggestion } from '@/editor/ui'
import { m } from '@/paraglide/messages'

/** Önerileri uygular (toplu kabul tek geri alma adımı); bayat olanlar atlanır ve söylenir. */
export function acceptSuggestions(list: Suggestion[]) {
  const ui = useEditorUi.getState()
  const applied = applySuggestions(list)
  ui.removeSuggestions(list.map((s) => s.id))
  ui.highlightItem(null)
  if (applied < list.length) toast({ message: m.ai_stale_skipped({ count: list.length - applied }) })
  if (applied > 0) {
    toast({ message: m.ai_accepted({ count: applied }) })
    ui.flashItems(list.filter((s) => s.kind !== 'removeItem').map(suggestionTargetId))
  }
}

export function rejectSuggestions(list: Suggestion[]) {
  const ui = useEditorUi.getState()
  ui.removeSuggestions(list.map((s) => s.id))
  ui.highlightItem(null)
}

/** Kayıt/kişisel bilgiler için bekleyen öneri türü (satırdaki işaret). Seçicide kullan. */
export function pendingKind(suggestions: Suggestion[], targetId: string): 'field' | 'removeItem' | null {
  let kind: 'field' | 'removeItem' | null = null
  for (const s of suggestions) {
    if (s.kind === 'addItem') continue
    if (suggestionTargetId(s) !== targetId) continue
    if (s.kind === 'removeItem') return 'removeItem'
    kind = 'field'
  }
  return kind
}

/** Bir alanın bekleyen önerisi (seçicide kullan; aynı nesne döner, gereksiz çizim yok). */
export function fieldSuggestion(suggestions: Suggestion[], targetId: string, field: string): FieldChangeSuggestion | undefined {
  return suggestions.find((s): s is FieldChangeSuggestion => s.kind === 'field' && s.target === targetId && s.field === field)
}

/** Listede gösterilecek ilk değişen satır: eski → yeni (kısaltılmaz, sarar). */
export function firstChangedLine(s: FieldChangeSuggestion): { before: string; after: string } {
  const lines = (html: string) =>
    html
      .split(/<\/(?:p|li)>|<br\s*\/?>/i)
      .map((l) => stripHtml(l).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  const a = s.rich ? lines(s.before) : [s.before.trim()]
  const b = s.rich ? lines(s.after) : [s.after.trim()]
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return { before: a[i] ?? '', after: b[i] ?? '' }
  return { before: a[0] ?? '', after: b[0] ?? '' }
}
