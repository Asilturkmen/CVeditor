import { useMemo } from 'react'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { CvLanguage } from '@/cv/schema'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { supportedColumns, TEMPLATES, templateSettingsFor, type ColorSet, type TemplateId } from '@/render/templates'
import { SAMPLE_SILHOUETTE } from './silhouette'

export interface SampleOptions {
  /** Örneğin dili; verilmezse arayüz dili (galeri). Şablon sayfasında seçilen CV dili. */
  language?: CvLanguage
  /** Fotoğraflı (varsayılan) ya da fotoğrafsız çizim */
  photo?: boolean
  /** Sütun sayısı; şablon desteklemiyorsa desteklenen en yakın değer. Verilmezse şablonun varsayılanı. */
  columns?: 1 | 2
  /** Renk takımı; verilmezse şablonun varsayılanı */
  colorSet?: ColorSet
}

/**
 * Galeride ve şablon sayfasında gösterilen uydurma örnek CV (gerçek kişi değil); fotoğraf
 * yerinde çizilmiş silüet. Kullanıcının CV'sine asla yazılmaz.
 */
export function useSampleCv(templateId: TemplateId, options: SampleOptions = {}) {
  const { photo = true, columns, colorSet } = options
  // Galeri örneği arayüz diliyle yazılır (dil değişince sayfa yeniden yüklenir).
  const language: CvLanguage = options.language ?? (getLocale() === 'en' ? 'en' : 'tr')
  return useMemo(() => {
    const sections = sampleSections(language)
    const template = TEMPLATES[templateId]
    const defaults = templateSettingsFor(templateId, sections)
    return createCv({
      name: m.badge_sample(),
      language,
      templateId,
      template: {
        ...defaults,
        showPhoto: photo,
        columns: columns ? supportedColumns(template, columns) : defaults.columns,
        ...(colorSet ? { accentColor: colorSet.accent, baseColor: colorSet.base ?? null } : {}),
      },
      personal: { ...samplePersonal(language), photo: photo ? SAMPLE_SILHOUETTE : null },
      sections,
    })
  }, [templateId, language, photo, columns, colorSet])
}
