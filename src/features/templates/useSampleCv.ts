import { useMemo } from 'react'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { templateSettingsFor, type TemplateId } from '@/render/templates'
import { SAMPLE_SILHOUETTE } from './silhouette'

/** Galeride gösterilen uydurma örnek CV (gerçek kişi değil); fotoğraf yerinde çizilmiş silüet. */
export function useSampleCv(templateId: TemplateId) {
  return useMemo(() => {
    // Galeri örneği arayüz diliyle yazılır (dil değişince sayfa yeniden yüklenir).
    const language = getLocale() === 'en' ? 'en' : 'tr'
    const sections = sampleSections(language)
    return createCv({
      name: m.badge_sample(),
      language,
      templateId,
      template: { ...templateSettingsFor(templateId, sections), showPhoto: true },
      personal: { ...samplePersonal(language), photo: SAMPLE_SILHOUETTE },
      sections,
    })
  }, [templateId])
}
