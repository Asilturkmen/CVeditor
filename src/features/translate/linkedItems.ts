import type { AnyItem, Cv, SectionType } from '@/cv/schema'
import { updateStoredCv } from '@/db/repo'

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
 *
 * Okuma ve yazma tek işlemdedir ve sürüm (`updatedAt`) `nextTimestamp` ile
 * ilerler (`updateStoredCv`): hedef CV başka sekmede açıksa o sekmenin
 * kaydıyla yarışmaz; bekleyen değişikliği yoksa güncel hâli yükler, varsa
 * çakışma bildirir (sessizce ezmez).
 */
export async function replaceLinkedItem(targetCvId: string, type: SectionType, item: AnyItem): Promise<string> {
  return updateStoredCv(targetCvId, (target) => {
    const linked = findLinkedItem(target, type, item.translationGroupId)
    if (!linked) throw new Error('Bağlı kayıt bulunamadı')
    const section = target.sections.find((s) => s.id === linked.sectionId)!
    const items = section.items as AnyItem[]
    const index = items.findIndex((i) => i.id === linked.itemId)
    const existing = items[index]
    items[index] = { ...structuredClone(item), id: existing.id, hidden: existing.hidden, translationGroupId: existing.translationGroupId } as AnyItem
    return target.name
  })
}
