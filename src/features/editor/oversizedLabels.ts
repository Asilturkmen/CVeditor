import type { AnyItem, Cv } from '@/cv/schema'
import { m } from '@/paraglide/messages'
import { itemLabel } from './labels'

/** Bir sayfadan uzun kayıtların editörde gösterilen adları. */
export function oversizedLabels(cv: Cv, oversized: { itemId: string | null; sectionId: string | null }[]) {
  return oversized.map((o) => {
    const section = cv.sections.find((s) => s.id === o.sectionId)
    const item = section ? (section.items as AnyItem[]).find((i) => i.id === o.itemId) : undefined
    return { id: o.itemId, label: section && item ? itemLabel(section.type, item) || m.editor_untitled() : m.editor_untitled() }
  })
}
