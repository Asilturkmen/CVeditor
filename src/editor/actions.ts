import type { Draft } from 'immer'
import { createItem, createSection, newId } from '@/cv/factory'
import { DEFAULT_SIDE_TYPES } from '@/cv/sample'
import type { AnyItem, Cv, Personal, Section, SectionType, TemplateSettings } from '@/cv/schema'
import { db } from '@/db/db'
import { defaultSideSections, getTemplate, TEMPLATES, type TemplateId } from '@/render/templates'
import { useEditor } from './store'
import type { Suggestion } from './ui'

/**
 * Editördeki bütün veri değişiklikleri buradan geçer; her biri tek bir
 * geri alma adımıdır (yazma sırasında aynı alan birleştirilir).
 */
const update = (recipe: (d: Draft<Cv>) => void, coalesceKey?: string) =>
  useEditor.getState().update(recipe, { coalesceKey })

function findSection(d: Draft<Cv>, sectionId: string) {
  return d.sections.find((s) => s.id === sectionId)
}

function findItem(d: Draft<Cv>, sectionId: string, itemId: string): Record<string, unknown> | undefined {
  const section = findSection(d, sectionId)
  return (section?.items as unknown as Record<string, unknown>[] | undefined)?.find((i) => i.id === itemId)
}

export function setPersonal<K extends keyof Personal>(field: K, value: Personal[K]) {
  update((d) => {
    d.personal[field] = value as Draft<Personal>[K]
  }, `personal:${field}`)
}

export function setItemField(sectionId: string, itemId: string, field: string, value: unknown) {
  update((d) => {
    const item = findItem(d, sectionId, itemId)
    if (item) item[field] = value
  }, `${itemId}:${field}`)
}

export function addItem(sectionId: string): string | null {
  let id: string | null = null
  update((d) => {
    const section = findSection(d, sectionId)
    if (!section) return
    const item = createItem(section.type)
    id = item.id
    ;(section.items as AnyItem[]).push(item)
  })
  return id
}

export interface RemovedItem {
  cvId: string
  item: AnyItem
  index: number
}

export function removeItem(sectionId: string, itemId: string): RemovedItem | null {
  const cv = useEditor.getState().cv
  const section = cv?.sections.find((s) => s.id === sectionId)
  const index = (section?.items as AnyItem[] | undefined)?.findIndex((i) => i.id === itemId) ?? -1
  if (!section || index < 0) return null
  const item = (section.items as AnyItem[])[index]
  update((d) => {
    findSection(d, sectionId)?.items.splice(index, 1)
  })
  return { cvId: cv!.id, item, index }
}

/**
 * Silinen kaydı geri koyar ("Geri al" bildirimi). Kayıt zaten yerindeyse
 * (ör. arada Ctrl+Z yapıldıysa) ya da başka bir CV açıksa hiçbir şey yapmaz:
 * aynı id iki kez eklenmesin, kayıt yanlış CV'ye gitmesin.
 */
export function restoreItem(sectionId: string, removed: RemovedItem) {
  update((d) => {
    if (d.id !== removed.cvId) return
    const section = findSection(d, sectionId)
    if (!section) return
    const items = section.items as AnyItem[]
    if (items.some((i) => i.id === removed.item.id)) return
    items.splice(Math.min(removed.index, items.length), 0, removed.item)
  })
}

export function duplicateItem(sectionId: string, itemId: string): string | null {
  let id: string | null = null
  update((d) => {
    const section = findSection(d, sectionId)
    if (!section) return
    const items = section.items as AnyItem[]
    const index = items.findIndex((i) => i.id === itemId)
    if (index < 0) return
    // Taslak (Proxy) structuredClone'a verilemez; JSON kopyası düz veridir.
    const copy = { ...JSON.parse(JSON.stringify(items[index])), id: newId(), translationGroupId: newId() }
    id = copy.id
    items.splice(index + 1, 0, copy)
  })
  return id
}

export function toggleItemHidden(sectionId: string, itemId: string) {
  update((d) => {
    const item = findItem(d, sectionId, itemId)
    if (item) item.hidden = !item.hidden
  })
}

export function moveItem(sectionId: string, from: number, to: number) {
  update((d) => {
    const section = findSection(d, sectionId)
    if (!section || from === to) return
    const items = section.items as AnyItem[]
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
  })
}

export function addSection(type: SectionType): string {
  const section = createSection(type, 1)
  update((d) => {
    d.sections.push(section as Draft<Section>)
    if ((DEFAULT_SIDE_TYPES as readonly string[]).includes(type)) d.template.sideSections.push(section.id)
  })
  return section.id
}

export interface RemovedSection {
  cvId: string
  section: Section
  index: number
  side: boolean
}

export function removeSection(sectionId: string): RemovedSection | null {
  const cv = useEditor.getState().cv
  const index = cv?.sections.findIndex((s) => s.id === sectionId) ?? -1
  if (!cv || index < 0) return null
  const section = cv.sections[index]
  const side = cv.template.sideSections.includes(sectionId)
  update((d) => {
    d.sections.splice(index, 1)
    d.template.sideSections = d.template.sideSections.filter((id) => id !== sectionId)
  })
  return { cvId: cv.id, section, index, side }
}

/** Silinen bölümü geri koyar; restoreItem ile aynı korumalar. */
export function restoreSection(removed: RemovedSection) {
  update((d) => {
    if (d.id !== removed.cvId || d.sections.some((s) => s.id === removed.section.id)) return
    d.sections.splice(Math.min(removed.index, d.sections.length), 0, removed.section as Draft<Section>)
    if (removed.side && !d.template.sideSections.includes(removed.section.id)) {
      d.template.sideSections.push(removed.section.id)
    }
  })
}

export function renameSection(sectionId: string, title: string | null) {
  update((d) => {
    const section = findSection(d, sectionId)
    if (section) section.title = title
  }, `${sectionId}:title`)
}

export function toggleSectionHidden(sectionId: string) {
  update((d) => {
    const section = findSection(d, sectionId)
    if (section) section.hidden = !section.hidden
  })
}

export function moveSection(from: number, to: number) {
  update((d) => {
    if (from === to) return
    const [moved] = d.sections.splice(from, 1)
    d.sections.splice(to, 0, moved)
  })
}

export function setTemplateSetting<K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) {
  update((d) => {
    d.template[key] = value as Draft<TemplateSettings>[K]
  }, key === 'accentColor' ? 'template:accent' : undefined)
}

export function toggleSideSection(sectionId: string) {
  update((d) => {
    const list = d.template.sideSections
    const index = list.indexOf(sectionId)
    if (index >= 0) list.splice(index, 1)
    else list.push(sectionId)
  })
}

/**
 * Şablon değiştirmek içeriği kaybettirmez. Sütun düzeni yeni şablonun
 * varsayılanına geçer; renk ve yazı tipi kullanıcı değiştirmediyse
 * (eski şablonun varsayılanındaysa) yeni şablonunkine geçer.
 */
export function switchTemplate(templateId: TemplateId) {
  update((d) => {
    if (d.templateId === templateId) return
    const previous = getTemplate(d.templateId).defaults
    const next = TEMPLATES[templateId].defaults
    if (d.template.accentColor === previous.accentColor) d.template.accentColor = next.accentColor
    if (d.template.font === previous.font) d.template.font = next.font
    d.template.columns = next.columns
    if (next.columns === 2 && d.template.sideSections.length === 0) {
      d.template.sideSections = defaultSideSections(d.sections as Section[])
    }
    d.templateId = templateId
  })
}

/** Alan önerisinin hedef alanının bugünkü değeri; alan yoksa (ya da öneri alan önerisi değilse) undefined. */
export function currentSuggestionValue(cv: Cv, s: Suggestion): unknown {
  if (s.kind !== 'field') return undefined
  if (s.target === 'personal') return (cv.personal as unknown as Record<string, unknown>)[s.field]
  const section = cv.sections.find((x) => x.id === s.sectionId)
  const item = (section?.items as unknown as Record<string, unknown>[] | undefined)?.find((i) => i.id === s.target)
  return item?.[s.field]
}

/**
 * Öneri hâlâ uygulanabilir mi? Alan önerisi: alan öneriden sonra değişmemiş.
 * Ekleme: bölüm duruyor ve aynı id'li kayıt yok. Kaldırma: kayıt duruyor ve
 * öneriden sonra değişmemiş.
 */
export function isSuggestionFresh(cv: Cv, s: Suggestion): boolean {
  if (s.kind === 'field') return currentSuggestionValue(cv, s) === s.before
  const section = cv.sections.find((x) => x.id === s.sectionId)
  if (!section) return false
  const items = section.items as AnyItem[]
  if (s.kind === 'addItem') return !cv.sections.some((x) => (x.items as AnyItem[]).some((i) => i.id === s.item.id))
  const item = items.find((i) => i.id === s.itemId)
  return !!item && JSON.stringify(item) === s.snapshot
}

/**
 * Önerileri tek adımda uygular (toplu kabul = tek geri alma adımı).
 * Öneri üretildikten sonra hedef değiştiyse o öneri uygulanmaz: kullanıcının
 * sonradan yazdığı metin sessizce ezilmesin. Uygulanan öneri sayısını döndürür.
 */
export function applySuggestions(list: Suggestion[]): number {
  const cv = useEditor.getState().cv
  if (!cv) return 0
  const fresh = list.filter((s) => isSuggestionFresh(cv, s))
  if (fresh.length === 0) return 0
  let applied = 0
  update((d) => {
    // Aynı kaydın ardına birden çok ekleme: sıraları korunsun diye her biri bir öncekinin ardına.
    const anchors = new Map<string, string | null>()
    for (const s of fresh) {
      if (s.kind === 'field') {
        if (s.target === 'personal') {
          ;(d.personal as unknown as Record<string, unknown>)[s.field] = s.after
          applied++
        } else if (s.sectionId) {
          const item = findItem(d, s.sectionId, s.target)
          if (item) {
            item[s.field] = s.after
            applied++
          }
        }
      } else if (s.kind === 'addItem') {
        const section = findSection(d, s.sectionId)
        if (!section) continue
        const items = section.items as AnyItem[]
        if (items.some((i) => i.id === s.item.id)) continue
        const key = s.afterItemId ?? ''
        const after = anchors.has(key) ? anchors.get(key)! : s.afterItemId
        const index = after ? items.findIndex((i) => i.id === after) : -1
        // Taslağa önerideki nesnenin kopyası girer (öneri listesi donmasın, paylaşılmasın).
        const copy = JSON.parse(JSON.stringify(s.item)) as AnyItem
        if (index >= 0) items.splice(index + 1, 0, copy)
        else items.push(copy)
        anchors.set(key, copy.id)
        applied++
      } else {
        const section = findSection(d, s.sectionId)
        const index = section ? (section.items as AnyItem[]).findIndex((i) => i.id === s.itemId) : -1
        if (section && index >= 0) {
          section.items.splice(index, 1)
          applied++
        }
      }
    }
  })
  return applied
}

/**
 * Kaydı başka bir CV'ye yeni kayıt olarak ekler (çevrilmiş ya da olduğu
 * gibi). Hedefte bu çeviri grubundan kayıt yoksa aynı translationGroupId'yi
 * taşır (bağlı kopya). Varsa ("Yeni kayıt olarak ekle") kopya bağımsızdır
 * ve yeni grup alır: bir CV'de aynı gruptan iki kayıt olmaz, böylece
 * findLinkedItem hep tek ve doğru kaydı bulur.
 */
export async function copyItemToCv(targetCvId: string, sectionType: SectionType, item: AnyItem): Promise<string> {
  const target = await db.cvs.get(targetCvId)
  if (!target) throw new Error('CV bulunamadı')
  const alreadyLinked = target.sections.some((s) => (s.items as AnyItem[]).some((i) => i.translationGroupId === item.translationGroupId))
  const copy = { ...structuredClone(item), id: newId(), ...(alreadyLinked ? { translationGroupId: newId() } : {}) } as AnyItem
  let section = target.sections.find((s) => s.type === sectionType)
  if (!section) {
    section = createSection(sectionType)
    target.sections.push(section)
    if ((DEFAULT_SIDE_TYPES as readonly string[]).includes(sectionType)) target.template.sideSections.push(section.id)
  }
  ;(section.items as AnyItem[]).push(copy)
  target.updatedAt = new Date().toISOString()
  await db.cvs.put(target)
  return target.name
}
