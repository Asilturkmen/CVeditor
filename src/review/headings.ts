import type { SectionType } from '@/cv/schema'
import { fold } from './text'

/**
 * ATS'lerin tanıdığı bölüm başlıkları (TR + EN). Liste katlanmış biçimde
 * (küçük harf, aksansız) tutulur; "ve", "and", "&" karşılaştırmada atılır.
 * Tam liste değildir: yaygın ATS'lerin (Workday, Greenhouse, Lever, Kariyer.net
 * vb.) eşleştirdiği alışılmış adlar.
 */
const STANDARD: Record<Exclude<SectionType, 'custom'>, string[]> = {
  summary: [
    'ozet', 'profil', 'hakkimda', 'kariyer hedefi', 'kariyer ozeti', 'profesyonel ozet', 'ozgecmis ozeti', 'kisisel ozet',
    'summary', 'profile', 'professional summary', 'about me', 'about', 'objective', 'career objective', 'career summary',
    'professional profile',
  ],
  experience: [
    'deneyim', 'deneyimler', 'is deneyimi', 'is deneyimleri', 'profesyonel deneyim', 'mesleki deneyim', 'tecrube',
    'is tecrubesi', 'is tecrubeleri', 'calisma gecmisi', 'is gecmisi', 'kariyer', 'kariyer gecmisi',
    'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history',
    'career history', 'relevant experience',
  ],
  education: [
    'egitim', 'egitim bilgileri', 'egitim bilgisi', 'ogrenim', 'ogrenim bilgileri', 'akademik gecmis',
    'education', 'academic background', 'education training', 'academic history', 'qualifications',
  ],
  projects: ['projeler', 'proje', 'projelerim', 'kisisel projeler', 'projects', 'personal projects', 'selected projects', 'key projects'],
  skills: [
    'beceriler', 'yetenekler', 'yetkinlikler', 'teknik beceriler', 'teknik yetkinlikler', 'bilgisayar becerileri',
    'beceri', 'yetkinlik', 'skills', 'technical skills', 'core skills', 'key skills', 'competencies',
    'core competencies', 'technologies', 'skills expertise', 'tools technologies',
  ],
  languages: ['diller', 'yabanci diller', 'yabanci dil', 'dil becerileri', 'dil bilgisi', 'languages', 'language skills', 'language'],
  certificates: [
    'sertifikalar', 'sertifika', 'sertifikalar kurslar', 'kurslar sertifikalar', 'belgeler',
    'certificates', 'certifications', 'certification', 'licenses certifications', 'courses certifications',
  ],
  awards: ['oduller', 'basarilar', 'oduller basarilar', 'awards', 'honors', 'honours', 'achievements', 'awards honors', 'honors awards'],
  volunteer: [
    'gonulluluk', 'gonullu calismalar', 'gonullu deneyim', 'sosyal sorumluluk', 'sosyal sorumluluk projeleri',
    'volunteering', 'volunteer experience', 'volunteer work', 'volunteer',
  ],
  references: ['referanslar', 'referans', 'references', 'referees'],
}

/** Özel bölümler için de tanınan başlıklar */
const EXTRA = [
  'yayinlar', 'publications', 'hobiler', 'ilgi alanlari', 'interests', 'hobbies', 'uyelikler', 'memberships',
  'konferanslar', 'conferences', 'kurslar', 'courses', 'egitimler', 'trainings', 'seminerler', 'kisisel bilgiler',
  'personal information', 'iletisim', 'contact', 'liderlik', 'leadership', 'arastirma', 'research', 'patentler', 'patents',
]

/** Başlığı karşılaştırma biçimine getirir: katlanmış, noktalamasız, bağlaçsız. */
export function headingKey(title: string): string {
  return fold(title)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 've' && w !== 'and' && w !== 'ile')
    .join(' ')
}

const BY_KEY = new Map<string, SectionType>()
for (const [type, titles] of Object.entries(STANDARD)) for (const t of titles) BY_KEY.set(t, type as SectionType)
const EXTRA_KEYS = new Set(EXTRA)

/** Başlık hangi standart bölüme karşılık geliyor? Tanınmıyorsa null. */
export function standardTypeOf(title: string): SectionType | null {
  return BY_KEY.get(headingKey(title)) ?? null
}

/** Başlık ATS'lerin tanıdığı bir ad mı (standart ya da yaygın ek bölüm)? */
export function isKnownHeading(title: string): boolean {
  const key = headingKey(title)
  return BY_KEY.has(key) || EXTRA_KEYS.has(key)
}
