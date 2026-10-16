import { useMemo } from 'react'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { templateSettingsFor, type TemplateId } from '@/render/templates'

/** Galeride gösterilen uydurma örnek CV (gerçek kişi değil). */
export function useSampleCv(templateId: TemplateId) {
  return useMemo(() => {
    // Galeri örneği arayüz diliyle yazılır (dil değişince sayfa yeniden yüklenir).
    const language = getLocale() === 'en' ? 'en' : 'tr'
    const sections = sampleSections(language)
    return createCv({
      name: m.badge_sample(),
      language,
      templateId,
      template: templateSettingsFor(templateId, sections),
      personal: samplePersonal(language),
      sections,
    })
  }, [templateId])
}
