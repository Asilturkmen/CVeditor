import { createItem, isItemEmpty, newId } from '@/cv/factory'
import { CONTACT_FIELDS, PERSONAL_TEXT_FIELDS, textField, TEXT_FIELDS } from '@/cv/fields'
import type { AnyItem, Cv, Section } from '@/cv/schema'
import type { Suggestion } from '@/editor/ui'
import { sanitizeRichText } from '@/render/richtext'
import { hasPlaceholder } from './payload'
import type { EditPayload, EditResult } from './types'

/**
 * Model işlemlerini (EditOperation) arayüzün önerilerine çevirir. Her işlem
 * ayrı doğrulanır; uymayan işlem sessizce atılır ve `dropped` sayısına girer:
 * - hedef kayıt/bölüm var ve istekte gönderilen kapsamın içinde
 * - alan o bölüm türünün metin alanı (kişisel bilgide: unvan; iletişim alanı —
 *   kişinin ya da referansın — yalnız istekte gönderildiyse)
 * - zengin metin süzgeçten geçer, düz metinden etiket atılır
 * - değişiklik yaratmayan işlem öneri olmaz (atılmış sayılmaz)
 * - geri konamayan yer tutucu (⟦…⟧) kalan değer atılır
 */

const MAX_VALUE = 8000
const MAX_NOTE = 240

function plain(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
}

function clean(value: string, rich: boolean): string {
  return rich ? sanitizeRichText(value.trim()) : plain(value)
}

/** Aynı anlama gelen iki değer (ör. boş paragraf farkı) öneri sayılmaz. */
function same(before: string, after: string, rich: boolean): boolean {
  return rich ? sanitizeRichText(before) === after : before.trim() === after
}

export function operationsToSuggestions(
  cv: Cv,
  result: EditResult,
  unmask: (s: string) => string,
  payload: Pick<EditPayload, 'scope' | 'sections' | 'personal'>,
): { suggestions: Suggestion[]; dropped: number } {
  const suggestions: Suggestion[] = []
  let dropped = 0
  const seen = new Set<string>()

  const sentSections = new Map(payload.sections.map((s) => [s.id, s]))
  const sectionOf = (id: string) => (sentSections.has(id) ? cv.sections.find((s) => s.id === id) : undefined)
  const sentItem = (sectionId: string, itemId: string) => sentSections.get(sectionId)?.items.some((i) => i.id === itemId)
  const sentField = (sectionId: string, itemId: string, field: string) =>
    !!sentSections.get(sectionId)?.items.some((i) => i.id === itemId && field in i)
  /** Kaydı, gönderilen kapsamdaki bölümlerde arar */
  const findItem = (itemId: string): { section: Section; item: AnyItem } | undefined => {
    for (const sent of payload.sections) {
      if (!sent.items.some((i) => i.id === itemId)) continue
      const section = cv.sections.find((s) => s.id === sent.id)
      const item = (section?.items as AnyItem[] | undefined)?.find((i) => i.id === itemId)
      if (section && item) return { section, item }
    }
    return undefined
  }
  const note = (reason: string | undefined) => (reason ? unmask(reason).trim().slice(0, MAX_NOTE) : '')
  const value = (raw: string, rich: boolean): string | null => {
    const restored = unmask(raw)
    if (restored.length > MAX_VALUE || hasPlaceholder(restored)) return null
    return clean(restored, rich)
  }

  for (const op of result.operations) {
    if (op.op === 'set') {
      const key = `${op.target}:${op.field}`
      if (seen.has(key)) {
        dropped++
        continue
      }
      let before: unknown
      let rich = false
      let sectionId: string | null = null
      if (op.target === 'personal') {
        const isHeadline = PERSONAL_TEXT_FIELDS.some((f) => f.key === op.field) && payload.scope.kind === 'all'
        const isContact = (CONTACT_FIELDS as readonly string[]).includes(op.field) && op.field in payload.personal
        if (!isHeadline && !isContact) {
          dropped++
          continue
        }
        before = (cv.personal as unknown as Record<string, unknown>)[op.field]
      } else {
        const found = findItem(op.target)
        const field = found && textField(found.section.type, op.field)
        // Referansın e-postası/telefonu yalnız istekte gönderildiyse değiştirilebilir.
        if (!found || !field || (field.contact && !sentField(found.section.id, op.target, op.field))) {
          dropped++
          continue
        }
        rich = field.rich
        sectionId = found.section.id
        before = (found.item as unknown as Record<string, unknown>)[op.field]
      }
      const after = value(op.value, rich)
      if (typeof before !== 'string' || after === null) {
        dropped++
        continue
      }
      seen.add(key)
      if (same(before, after, rich)) continue
      suggestions.push({ kind: 'field', id: newId(), sectionId, target: op.target, field: op.field, before, after, rich, note: note(op.reason) })
    } else if (op.op === 'add') {
      const section = sectionOf(op.sectionId)
      const items = (section?.items ?? []) as AnyItem[]
      // Tek kayıt kapsamında yeni kayıt eklenmez; özet tek kayıtlıdır.
      if (!section || payload.scope.kind === 'item' || (section.type === 'summary' && items.length > 0)) {
        dropped++
        continue
      }
      const item = createItem(section.type) as AnyItem
      const record = item as unknown as Record<string, unknown>
      let invalid = false
      for (const f of TEXT_FIELDS[section.type]) {
        // İletişim istenmediyse yeni kayda da iletişim alanı yazılmaz.
        if (f.contact && !(f.contact in payload.personal)) continue
        const raw = op.fields[f.key]
        if (typeof raw !== 'string') continue
        const v = value(raw, f.rich)
        if (v === null) invalid = true
        else record[f.key] = v
      }
      if (invalid || isItemEmpty(item)) {
        dropped++
        continue
      }
      // Kapsam dışındaki ya da olmayan kaydın ardına değil: sona eklenir.
      const afterItemId = op.afterItemId && sentItem(section.id, op.afterItemId) && items.some((i) => i.id === op.afterItemId) ? op.afterItemId : null
      suggestions.push({ kind: 'addItem', id: newId(), sectionId: section.id, afterItemId, item, note: note(op.reason) })
    } else {
      const section = sectionOf(op.sectionId)
      const item = (section?.items as AnyItem[] | undefined)?.find((i) => i.id === op.itemId)
      const key = `remove:${op.itemId}`
      if (!section || !item || !sentItem(section.id, op.itemId) || seen.has(key)) {
        dropped++
        continue
      }
      seen.add(key)
      suggestions.push({
        kind: 'removeItem',
        id: newId(),
        sectionId: section.id,
        itemId: item.id,
        snapshot: JSON.stringify(item),
        note: note(op.reason),
      })
    }
  }

  // Kaldırılacak kayıttaki alan önerileri anlamsız: kaldırma önerisi yeter.
  const removed = new Set(suggestions.flatMap((s) => (s.kind === 'removeItem' ? [s.itemId] : [])))
  const kept = suggestions.filter((s) => !(s.kind === 'field' && removed.has(s.target)))
  return { suggestions: kept, dropped: dropped + suggestions.length - kept.length }
}
