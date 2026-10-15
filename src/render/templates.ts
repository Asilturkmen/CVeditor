import { DEFAULT_SIDE_TYPES } from '@/cv/sample'
import type { Section, TemplateSettings } from '@/cv/schema'
import klasikCss from './styles/klasik.css?raw'
import modernCss from './styles/modern.css?raw'

/**
 * Şablon = ortak çizim motorunun üstünde ayar + küçük stil.
 * Yeni şablon eklemek ayrı bir kod yığını değil, bir CSS dosyası ve
 * varsayılan ayarlardır. Bütün şablonlar aynı HTML'i (renderCv) kullanır.
 */
export interface TemplateDef {
  id: TemplateId
  name: string
  css: string
  defaults: Omit<TemplateSettings, 'sideSections'>
}

export type TemplateId = 'klasik' | 'modern'

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  klasik: {
    id: 'klasik',
    name: 'Klasik',
    css: klasikCss,
    defaults: {
      accentColor: '#1f5f8b',
      font: 'source-serif-4',
      fontSize: 'md',
      spacing: 'normal',
      columns: 1,
      showPhoto: false,
      headerAlign: 'left',
    },
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    css: modernCss,
    defaults: {
      accentColor: '#2f6f62',
      font: 'inter',
      fontSize: 'md',
      spacing: 'normal',
      columns: 2,
      showPhoto: false,
      headerAlign: 'left',
    },
  },
}

export const TEMPLATE_LIST: TemplateDef[] = [TEMPLATES.klasik, TEMPLATES.modern]

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.klasik
}

export function defaultSideSections(sections: Section[]): string[] {
  return sections
    .filter((s) => (DEFAULT_SIDE_TYPES as readonly string[]).includes(s.type))
    .map((s) => s.id)
}

export function templateSettingsFor(id: TemplateId, sections: Section[]): TemplateSettings {
  return { ...TEMPLATES[id].defaults, sideSections: defaultSideSections(sections) }
}
