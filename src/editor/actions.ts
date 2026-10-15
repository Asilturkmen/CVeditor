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

export function removeItem(sectionId: string, itemId: string): { item: AnyItem; index: number } | null {
  const cv = useEditor.getState().cv
  const section = cv?.sections.find((s) => s.id === sectionId)
  const index = (section?.items as AnyItem[] | undefined)?.findIndex((i) => i.id === itemId) ?? -1
  if (!section || index < 0) return null
  const item = (section.items as AnyItem[])[index]
  update((d) => {
    findSection(d, sectionId)?.items.splice(index, 1)
  })
  return { item, index }
}

export function restoreItem(sectionId: string, item: AnyItem, index: number) {
  update((d) => {
    const section = findSection(d, sectionId)
    if (!section) return
    ;(section.items as AnyItem[]).splice(Math.min(index, section.items.length), 0, item)
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

export function removeSection(sectionId: string): { section: Section; index: number; side: boolean } | null {
  const cv = useEditor.getState().cv
  const index = cv?.sections.findIndex((s) => s.id === sectionId) ?? -1
  if (!cv || index < 0) return null
  const section = cv.sections[index]
  const side = cv.template.sideSections.includes(sectionId)
  update((d) => {
    d.sections.splice(index, 1)
    d.template.sideSections = d.template.sideSections.filter((id) => id !== sectionId)
  })
  return { section, index, side }
}

export function restoreSection(section: Section, index: number, side: boolean) {
  update((d) => {
    d.sections.splice(Math.min(index, d.sections.length), 0, section as Draft<Section>)
    if (side) d.template.sideSections.push(section.id)
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

/** Önerileri tek adımda uygular (toplu kabul = tek geri alma adımı). */
export function applySuggestions(list: Suggestion[]) {
  if (list.length === 0) return
  update((d) => {
    for (const s of list) {
      if (s.target === 'personal') {
        ;(d.personal as unknown as Record<string, unknown>)[s.field] = s.after
      } else if (s.sectionId) {
        const item = findItem(d, s.sectionId, s.target)
        if (item) item[s.field] = s.after
      }
    }
  })
}

/**
 * Kaydı başka bir CV'ye ekler (V1: çevirmeden, olduğu gibi). Aynı
 * translationGroupId'yi taşır; V3'te "çevirerek ekle" aynı bağı kullanacak.
 */
export async function copyItemToCv(targetCvId: string, sectionType: SectionType, item: AnyItem): Promise<string> {
  const target = await db.cvs.get(targetCvId)
  if (!target) throw new Error('CV bulunamadı')
  const copy = { ...structuredClone(item), id: newId() } as AnyItem
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
