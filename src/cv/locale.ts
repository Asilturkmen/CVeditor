import type { CvLanguage, SectionType } from './schema'

/**
 * CV'nin kendi dilindeki metinler (bölüm başlıkları, aylar, "Günümüz").
 * Bunlar arayüz çevirisi değildir: arayüz Türkçeyken İngilizce CV
 * "Experience" başlığıyla çizilir.
 */
export const SECTION_TITLES: Record<CvLanguage, Record<SectionType, string>> = {
  tr: {
    summary: 'Özet',
    experience: 'Deneyim',
    education: 'Eğitim',
    projects: 'Projeler',
    skills: 'Beceriler',
    languages: 'Diller',
    certificates: 'Sertifikalar',
    awards: 'Ödüller',
    volunteer: 'Gönüllülük',
    references: 'Referanslar',
    custom: 'Özel Bölüm',
  },
  en: {
    summary: 'Summary',
    experience: 'Experience',
    education: 'Education',
    projects: 'Projects',
    skills: 'Skills',
    languages: 'Languages',
    certificates: 'Certifications',
    awards: 'Awards',
    volunteer: 'Volunteering',
    references: 'References',
    custom: 'Custom Section',
  },
}

export const MONTHS_SHORT: Record<CvLanguage, readonly string[]> = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

export const PRESENT: Record<CvLanguage, string> = { tr: 'Günümüz', en: 'Present' }

export const LANGUAGE_NAMES: Record<CvLanguage, string> = { tr: 'Türkçe', en: 'İngilizce' }

/** Önizlemede boş ad yerine görünen soluk yer tutucu (PDF'e basılmaz) */
export const NAME_PLACEHOLDER: Record<CvLanguage, string> = { tr: 'Adın Soyadın', en: 'Your Name' }

export function sectionTitle(language: CvLanguage, type: SectionType, custom: string | null): string {
  const trimmed = custom?.trim()
  return trimmed ? trimmed : SECTION_TITLES[language][type]
}
