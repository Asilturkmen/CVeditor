import { z } from 'zod'

/**
 * CV veri modeli. Tek gerçek kaynak budur: şablonlar bu veriyi çizer,
 * içerik ile görünüm ayrıdır. Biçim baştan sunucuya taşınabilecek şekilde
 * düz JSON'dur (tarih ISO metni, görsel data URL).
 *
 * Şema değişirse CURRENT_SCHEMA_VERSION artırılır ve migrate.ts'e göç eklenir.
 */
export const CURRENT_SCHEMA_VERSION = 1

export const CV_LANGUAGES = ['tr', 'en'] as const
export const LanguageSchema = z.enum(CV_LANGUAGES)
export type CvLanguage = z.infer<typeof LanguageSchema>

export const YearMonthSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  /** 1-12; null ise yalnız yıl gösterilir */
  month: z.number().int().min(1).max(12).nullable(),
})
export type YearMonth = z.infer<typeof YearMonthSchema>

export const DateRangeSchema = z.object({
  start: YearMonthSchema.nullable(),
  end: YearMonthSchema.nullable(),
  /** "Devam ediyor": bitiş yerine "Günümüz / Present" yazılır */
  current: z.boolean(),
})
export type DateRange = z.infer<typeof DateRangeSchema>

/** Kısıtlı HTML: p, ul, li, strong, em, a[href], br. Çizimde yeniden temizlenir. */
const RichText = z.string()

/**
 * Her kaydın ortak alanları. `id` kalıcıdır (sıralama, kaydırma, yapay zekâ
 * önerisi hedefi). `translationGroupId` aynı kaydın başka CV'lerdeki
 * kopyalarını/çevirilerini birbirine bağlar.
 */
const itemBase = {
  id: z.string().min(1),
  translationGroupId: z.string().min(1),
  hidden: z.boolean(),
}

export const SummaryItemSchema = z.object({ ...itemBase, content: RichText })
export const ExperienceItemSchema = z.object({
  ...itemBase,
  position: z.string(),
  company: z.string(),
  location: z.string(),
  dates: DateRangeSchema,
  description: RichText,
})
export const EducationItemSchema = z.object({
  ...itemBase,
  school: z.string(),
  degree: z.string(),
  field: z.string(),
  location: z.string(),
  dates: DateRangeSchema,
  grade: z.string(),
  description: RichText,
})
export const ProjectItemSchema = z.object({
  ...itemBase,
  name: z.string(),
  role: z.string(),
  url: z.string(),
  dates: DateRangeSchema,
  description: RichText,
})
export const SkillItemSchema = z.object({
  ...itemBase,
  name: z.string(),
  keywords: z.string(),
})
export const LanguageItemSchema = z.object({
  ...itemBase,
  name: z.string(),
  level: z.string(),
})
export const CertificateItemSchema = z.object({
  ...itemBase,
  name: z.string(),
  issuer: z.string(),
  date: YearMonthSchema.nullable(),
  url: z.string(),
})
export const AwardItemSchema = z.object({
  ...itemBase,
  title: z.string(),
  issuer: z.string(),
  date: YearMonthSchema.nullable(),
  description: RichText,
})
export const VolunteerItemSchema = z.object({
  ...itemBase,
  role: z.string(),
  organization: z.string(),
  location: z.string(),
  dates: DateRangeSchema,
  description: RichText,
})
export const ReferenceItemSchema = z.object({
  ...itemBase,
  name: z.string(),
  position: z.string(),
  organization: z.string(),
  email: z.string(),
  phone: z.string(),
})
export const CustomItemSchema = z.object({
  ...itemBase,
  title: z.string(),
  subtitle: z.string(),
  location: z.string(),
  dates: DateRangeSchema,
  url: z.string(),
  description: RichText,
})

const sectionBase = {
  id: z.string().min(1),
  /** null → başlık CV diline göre otomatik (Deneyim / Experience) */
  title: z.string().nullable(),
  hidden: z.boolean(),
}

export const SectionSchema = z.discriminatedUnion('type', [
  z.object({ ...sectionBase, type: z.literal('summary'), items: z.array(SummaryItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('experience'), items: z.array(ExperienceItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('education'), items: z.array(EducationItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('projects'), items: z.array(ProjectItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('skills'), items: z.array(SkillItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('languages'), items: z.array(LanguageItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('certificates'), items: z.array(CertificateItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('awards'), items: z.array(AwardItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('volunteer'), items: z.array(VolunteerItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('references'), items: z.array(ReferenceItemSchema) }),
  z.object({ ...sectionBase, type: z.literal('custom'), items: z.array(CustomItemSchema) }),
])
export type Section = z.infer<typeof SectionSchema>
export type SectionType = Section['type']
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>
export type ItemOf<T extends SectionType> = SectionOf<T>['items'][number]
export type AnyItem = Section['items'][number]

export const SECTION_TYPES = [
  'summary',
  'experience',
  'education',
  'projects',
  'skills',
  'languages',
  'certificates',
  'awards',
  'volunteer',
  'references',
  'custom',
] as const satisfies readonly SectionType[]

export const PersonalSchema = z.object({
  fullName: z.string(),
  /** Unvan, ör. "Frontend Geliştirici" */
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  website: z.string(),
  linkedin: z.string(),
  github: z.string(),
  /** Küçültülmüş JPEG data URL; yoksa null */
  photo: z.string().nullable(),
})
export type Personal = z.infer<typeof PersonalSchema>

export const FONT_IDS = ['inter', 'ibm-plex-sans', 'source-sans-3', 'source-serif-4', 'literata'] as const
export const FontIdSchema = z.enum(FONT_IDS)
export type FontId = z.infer<typeof FontIdSchema>

export const TemplateSettingsSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font: FontIdSchema,
  fontSize: z.enum(['sm', 'md', 'lg']),
  spacing: z.enum(['compact', 'normal', 'relaxed']),
  columns: z.union([z.literal(1), z.literal(2)]),
  /** İki sütunda yan sütuna giden bölümlerin id'leri */
  sideSections: z.array(z.string()),
  showPhoto: z.boolean(),
  headerAlign: z.enum(['left', 'center']),
})
export type TemplateSettings = z.infer<typeof TemplateSettingsSchema>

export const CvSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  language: LanguageSchema,
  templateId: z.string().min(1),
  template: TemplateSettingsSchema,
  personal: PersonalSchema,
  sections: z.array(SectionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Cv = z.infer<typeof CvSchema>
