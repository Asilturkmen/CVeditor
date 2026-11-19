import type { SectionType } from '@/cv/schema'
import { fold } from './text'

/**
 * Bölüm başlıklarının TEK kaynağı (TR + EN): CV İnceleme (ATS'lerin tanıdığı
 * başlıklar) ve içe aktarma (PDF'i bölümlere ayırma, src/ai/importHeuristics.ts)
 * aynı tabloyu kullanır; eş anlamlılar burada birleşir. Liste katlanmış
 * biçimde (küçük harf, aksansız) tutulur; "ve / and / &" karşılaştırmada
 * birbirinin yerine geçer. Tam liste değildir: yaygın ATS'lerin (Workday,
 * Greenhouse, Lever, Kariyer.net vb.) eşleştirdiği alışılmış adlar.
 */

/** `contact`: iletişim / kişisel bilgiler bloğu (CV'de ayrı bölüm türü değildir) */
export type HeadingKind = SectionType | 'contact'

export interface HeadingGroup {
  kind: HeadingKind
  /** İçe aktarmada bölümün özgün başlığı korunur (özel bölüm, staj) */
  keepTitle: boolean
  titles: string[]
}

export const HEADING_GROUPS: HeadingGroup[] = [
  {
    kind: 'summary',
    keepTitle: false,
    titles: [
      'ozet', 'hakkimda', 'profil', 'profile', 'summary', 'professional summary', 'profesyonel ozet', 'kariyer hedefi',
      'career objective', 'objective', 'about me', 'about', 'kisa ozet', 'genel bakis', 'overview', 'kariyer ozeti',
      'career summary', 'profesyonel profil', 'professional profile', 'ozgecmis ozeti', 'kisisel ozet', 'personal statement',
      'executive summary', 'ozet bilgi',
    ],
  },
  {
    kind: 'experience',
    keepTitle: false,
    titles: [
      'deneyim', 'deneyimler', 'is deneyimi', 'is deneyimleri', 'is tecrubesi', 'is tecrubeleri', 'tecrube', 'tecrubeler',
      'profesyonel deneyim', 'mesleki deneyim', 'calisma deneyimi', 'calisma deneyimleri', 'calisma gecmisi', 'calisma hayati',
      'is gecmisi', 'is hayati', 'kariyer', 'kariyer gecmisi', 'experience', 'experiences', 'work experience',
      'professional experience', 'professional background', 'employment', 'employment history', 'work history',
      'career history', 'relevant experience',
    ],
  },
  {
    kind: 'experience',
    keepTitle: true,
    titles: ['staj', 'stajlar', 'staj deneyimi', 'staj deneyimleri', 'internship', 'internships', 'internship experience'],
  },
  {
    kind: 'education',
    keepTitle: false,
    titles: [
      'egitim', 'egitim bilgileri', 'egitim bilgisi', 'egitim gecmisi', 'egitim durumu', 'ogrenim', 'ogrenim bilgileri',
      'ogrenim durumu', 'akademik gecmis', 'education', 'academic background', 'academic history', 'education & training',
      'qualifications',
    ],
  },
  {
    kind: 'skills',
    keepTitle: false,
    titles: [
      'beceriler', 'beceri', 'yetenekler', 'yetenek', 'yetkinlikler', 'yetkinlik', 'teknik beceriler', 'teknik yetenekler',
      'teknik yetkinlikler', 'teknik bilgi', 'teknik bilgiler', 'bilgisayar becerileri', 'bilgisayar bilgisi',
      'programlama dilleri', 'skills', 'technical skills', 'core skills', 'key skills', 'core competencies', 'competencies',
      'skills & tools', 'tools & technologies', 'technologies', 'teknolojiler', 'araclar & teknolojiler',
      'beceriler & yetkinlikler', 'skills & abilities', 'hard skills', 'soft skills', 'kisisel beceriler',
      'skills & expertise', 'uzmanlik alanlari', 'expertise', 'programming languages',
    ],
  },
  {
    kind: 'projects',
    keepTitle: false,
    titles: [
      'projeler', 'proje', 'projelerim', 'projects', 'personal projects', 'selected projects', 'key projects', 'side projects',
      'kisisel projeler', 'academic projects', 'akademik projeler', 'secili projeler',
    ],
  },
  {
    kind: 'languages',
    keepTitle: false,
    titles: ['diller', 'yabanci diller', 'yabanci dil', 'dil bilgisi', 'dil becerileri', 'languages', 'language skills', 'language'],
  },
  {
    kind: 'certificates',
    keepTitle: false,
    titles: [
      'sertifikalar', 'sertifika', 'sertifikalar & kurslar', 'kurslar & sertifikalar', 'kurslar', 'egitimler & sertifikalar',
      'sertifika & kurslar', 'belgeler', 'certificates', 'certifications', 'certification', 'certificates & courses',
      'certifications & courses', 'courses & certifications', 'courses', 'licenses & certifications',
      'certifications & licenses', 'lisanslar & sertifikalar',
    ],
  },
  {
    kind: 'awards',
    keepTitle: false,
    titles: [
      'oduller', 'basarilar', 'oduller & basarilar', 'basarilar & oduller', 'awards', 'honors', 'honours', 'honors & awards',
      'awards & honors', 'achievements', 'awards & achievements',
    ],
  },
  {
    kind: 'volunteer',
    keepTitle: false,
    titles: [
      'gonulluluk', 'gonullu calismalar', 'gonullu deneyim', 'gonulluluk deneyimi', 'gonullu faaliyetler', 'sosyal sorumluluk',
      'sosyal sorumluluk projeleri', 'toplumsal calismalar', 'volunteer', 'volunteering', 'volunteer experience',
      'volunteer work', 'community involvement',
    ],
  },
  { kind: 'references', keepTitle: false, titles: ['referanslar', 'referans', 'references', 'referees'] },
  {
    kind: 'contact',
    keepTitle: true,
    titles: [
      'iletisim', 'iletisim bilgileri', 'kisisel bilgiler', 'kisisel detaylar', 'contact', 'contact information', 'contact info',
      'contact details', 'personal information', 'personal details',
    ],
  },
  {
    kind: 'custom',
    keepTitle: true,
    titles: [
      'hobiler', 'ilgi alanlari', 'hobiler & ilgi alanlari', 'interests', 'hobbies', 'hobbies & interests', 'yayinlar',
      'publications', 'uyelikler', 'memberships', 'konferanslar', 'conferences', 'etkinlikler', 'activities',
      'extracurricular activities', 'ders disi etkinlikler', 'kulupler', 'clubs', 'leadership', 'liderlik', 'patentler',
      'patents', 'research', 'arastirma', 'arastirmalar', 'tez', 'thesis', 'egitimler', 'trainings', 'seminerler',
    ],
  },
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
/** Harf aralıklı yazım ("D E N E Y İ M") için boşluksuz anahtar */
const BY_COMPACT = new Map<string, SectionType>()
const EXTRA_KEYS = new Set<string>()
for (const group of HEADING_GROUPS) {
  for (const title of group.titles) {
    const key = headingKey(title)
    if (group.kind === 'contact' || group.kind === 'custom') EXTRA_KEYS.add(key)
    else {
      BY_KEY.set(key, group.kind)
      BY_COMPACT.set(key.replace(/ /g, ''), group.kind)
    }
  }
}

/** Başlık hangi standart bölüme karşılık geliyor? Tanınmıyorsa null. */
export function standardTypeOf(title: string): SectionType | null {
  const key = headingKey(title)
  const direct = BY_KEY.get(key)
  if (direct) return direct
  // "D E N E Y İ M": her sözcük tek harfse harf aralıklı yazımdır
  const words = key.split(' ')
  if (words.length >= 4 && words.every((w) => w.length === 1)) return BY_COMPACT.get(words.join('')) ?? null
  return null
}

/** Başlık ATS'lerin tanıdığı bir ad mı (standart ya da yaygın ek bölüm)? */
export function isKnownHeading(title: string): boolean {
  const key = headingKey(title)
  return BY_KEY.has(key) || EXTRA_KEYS.has(key)
}
