import { CURRENT_SCHEMA_VERSION } from './schema'
import type {
  AnyItem,
  Cv,
  CvLanguage,
  DateRange,
  ItemOf,
  Personal,
  Section,
  SectionOf,
  SectionType,
  TemplateSettings,
} from './schema'

export function newId(): string {
  return crypto.randomUUID()
}

export const emptyRange = (): DateRange => ({ start: null, end: null, current: false })

function base() {
  const id = newId()
  return { id, translationGroupId: newId(), hidden: false }
}

/** Bölüm türüne göre boş kayıt. Her kayıt kendi çeviri grubuyla doğar. */
export function createItem<T extends SectionType>(type: T): ItemOf<T> {
  const b = base()
  const items: { [K in SectionType]: () => ItemOf<K> } = {
    summary: () => ({ ...b, content: '' }),
    experience: () => ({ ...b, position: '', company: '', location: '', dates: emptyRange(), description: '' }),
    education: () => ({
      ...b,
      school: '',
      degree: '',
      field: '',
      location: '',
      dates: emptyRange(),
      grade: '',
      description: '',
    }),
    projects: () => ({ ...b, name: '', role: '', url: '', dates: emptyRange(), description: '' }),
    skills: () => ({ ...b, name: '', keywords: '' }),
    languages: () => ({ ...b, name: '', level: '' }),
    certificates: () => ({ ...b, name: '', issuer: '', date: null, url: '' }),
    awards: () => ({ ...b, title: '', issuer: '', date: null, description: '' }),
    volunteer: () => ({ ...b, role: '', organization: '', location: '', dates: emptyRange(), description: '' }),
    references: () => ({ ...b, name: '', position: '', organization: '', email: '', phone: '' }),
    custom: () => ({ ...b, title: '', subtitle: '', location: '', dates: emptyRange(), url: '', description: '' }),
  }
  return items[type]() as ItemOf<T>
}

export function createSection<T extends SectionType>(type: T, itemCount = 0): SectionOf<T> {
  const items = Array.from({ length: itemCount }, () => createItem(type))
  return { id: newId(), type, title: null, hidden: false, items } as unknown as SectionOf<T>
}

export const emptyPersonal = (): Personal => ({
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  linkedin: '',
  github: '',
  photo: null,
})

/** Boş CV'nin başlangıç bölümleri; ipucu metinleri görünsün diye bazılarında boş kayıt var. */
export function defaultSections(): Section[] {
  return [
    createSection('summary', 1),
    createSection('experience', 1),
    createSection('education', 1),
    createSection('projects'),
    createSection('skills'),
    createSection('languages'),
  ]
}

export function createCv(input: {
  name: string
  language: CvLanguage
  templateId: string
  template: TemplateSettings
  personal?: Personal
  sections?: Section[]
}): Cv {
  const now = new Date().toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: newId(),
    name: input.name,
    language: input.language,
    templateId: input.templateId,
    template: input.template,
    personal: input.personal ?? emptyPersonal(),
    sections: input.sections ?? defaultSections(),
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * CV kopyası: yeni CV ve bölüm id'leri, yeni kayıt id'leri; ama
 * translationGroupId korunur ki kopyadaki kayıt asıl kayıtla bağlı kalsın.
 * Yan sütun ayarı yeni bölüm id'lerine eşlenir.
 */
export function duplicateCv(source: Cv, overrides: { name: string; language?: CvLanguage }): Cv {
  const now = new Date().toISOString()
  const sectionIdMap = new Map<string, string>()
  const sections = source.sections.map((section) => {
    const id = newId()
    sectionIdMap.set(section.id, id)
    return {
      ...structuredClone(section),
      id,
      items: section.items.map((item) => ({ ...structuredClone(item), id: newId() })),
    } as Section
  })
  return {
    ...structuredClone(source),
    id: newId(),
    name: overrides.name,
    language: overrides.language ?? source.language,
    template: {
      ...structuredClone(source.template),
      sideSections: source.template.sideSections.map((id) => sectionIdMap.get(id)).filter((id): id is string => !!id),
    },
    sections,
    createdAt: now,
    updatedAt: now,
  }
}

/** Kayıt bütünüyle boş mu? Boş kayıtlar önizlemede çizilmez. */
export function isItemEmpty(item: AnyItem): boolean {
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || key === 'translationGroupId' || key === 'hidden') continue
    if (typeof value === 'string' && stripHtml(value).trim() !== '') return false
    if (value && typeof value === 'object') {
      const range = value as Partial<DateRange> & { year?: number }
      if (range.year != null || range.start || range.end || range.current) return false
    }
  }
  return true
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
}
