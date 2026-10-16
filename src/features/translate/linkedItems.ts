import type { AnyItem, Cv, SectionType } from '@/cv/schema'
import { db } from '@/db/db'

/**
 * Hedef CV'de aynı çeviri grubundan kayıt (bağlı kayıt) varsa yeri. Bir CV'de
 * bir gruptan en fazla bir kayıt olur: CV içinde çoğaltma ve başka CV'ye
 * "Yeni kayıt olarak ekle" yeni grup verir (copyItemToCv), duplicateCv grubu
 * yalnız başka CV'ye taşır. Eski sürümden kalmış çift kayıt varsa ilki seçilir.
 */
export function findLinkedItem(cv: Cv, type: SectionType, translationGroupId: string): { sectionId: string; itemId: string } | null {
  for (const section of cv.sections) {
    if (section.type !== type) continue
    const item = (section.items as AnyItem[]).find((i) => i.translationGroupId === translationGroupId)
    if (item) return { sectionId: section.id, itemId: item.id }
  }
  return null
}

/**
 * Bağlı kaydı yeni içerikle değiştirir; kaydın kendi id'si, gizliliği ve
 * çeviri bağı korunur. Hedef CV'nin adını döndürür.
 */
export async function replaceLinkedItem(targetCvId: string, type: SectionType, item: AnyItem): Promise<string> {
  const target = await db.cvs.get(targetCvId)
  if (!target) throw new Error('CV bulunamadı')
  const linked = findLinkedItem(target, type, item.translationGroupId)
  if (!linked) throw new Error('Bağlı kayıt bulunamadı')
  const section = target.sections.find((s) => s.id === linked.sectionId)!
  const items = section.items as AnyItem[]
  const index = items.findIndex((i) => i.id === linked.itemId)
  const existing = items[index]
  items[index] = { ...structuredClone(item), id: existing.id, hidden: existing.hidden, translationGroupId: existing.translationGroupId } as AnyItem
  target.updatedAt = new Date().toISOString()
  await db.cvs.put(target)
  return target.name
}
