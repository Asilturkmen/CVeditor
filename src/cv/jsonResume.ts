import { z } from 'zod'
import { m } from '@/paraglide/messages'
import { sanitizeRichText, toHref } from '@/render/richtext'
import { createItem, createSection, emptyPersonal, isItemEmpty } from './factory'
import { YearMonthSchema } from './schema'
import type { Cv, CvLanguage, DateRange, ItemOf, Personal, Section, SectionOf, SectionType, YearMonth } from './schema'

/**
 * JSON Resume (https://jsonresume.org/schema, v1.0.0) dönüştürücüsü.
 * Dışa aktarımda gizli bölüm/kayıtlar ve boş kayıtlar atlanır; zengin metin
 * düz metne (paragraf + madde) iner. İçe aktarım hoşgörülüdür: bozuk alan
 * atlanır ve uyarı listesine yazılır, kısmi veri hiçbir zaman fırlatmaz.
 * Özel bölümler standartta yok; kaybolmasın diye meta.cveditor altında taşınır.
 */

export const JSON_RESUME_SCHEMA_URL = 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json'

export interface JsonResumeLocation {
  address?: string
  postalCode?: string
  city?: string
  countryCode?: string
  region?: string
}
export interface JsonResumeProfile {
  network?: string
  username?: string
  url?: string
}
export interface JsonResumeBasics {
  name?: string
  label?: string
  image?: string
  email?: string
  phone?: string
  url?: string
  summary?: string
  location?: JsonResumeLocation
  profiles?: JsonResumeProfile[]
}
interface Dated {
  startDate?: string
  endDate?: string
}
export interface JsonResumeWork extends Dated {
  name?: string
  position?: string
  location?: string
  summary?: string
  highlights?: string[]
}
export interface JsonResumeEducation extends Dated {
  institution?: string
  studyType?: string
  area?: string
  score?: string
  courses?: string[]
}
export interface JsonResumeProject extends Dated {
  name?: string
  description?: string
  highlights?: string[]
  url?: string
  roles?: string[]
}
export interface JsonResumeVolunteer extends Dated {
  organization?: string
  position?: string
  summary?: string
  highlights?: string[]
}
export interface JsonResumeCustomItem extends Dated {
  title?: string
  subtitle?: string
  location?: string
  url?: string
  current: boolean
  /** CVeditör zengin metni (kısıtlı HTML) */
  description?: string
}
export interface JsonResumeCustomSection {
  title: string | null
  items: JsonResumeCustomItem[]
}
export interface JsonResume {
  $schema: string
  basics: JsonResumeBasics
  work: JsonResumeWork[]
  volunteer: JsonResumeVolunteer[]
  education: JsonResumeEducation[]
  awards: { title?: string; date?: string; awarder?: string; summary?: string }[]
  certificates: { name?: string; date?: string; issuer?: string; url?: string }[]
  skills: { name?: string; keywords?: string[] }[]
  languages: { language?: string; fluency?: string }[]
  references: { name?: string; reference?: string }[]
  projects: JsonResumeProject[]
  meta: {
    canonical: string
    version: 'v1.0.0'
    lastModified: string
    cveditor: { language: CvLanguage; customSections: JsonResumeCustomSection[] }
  }
}

// ---------- Dışa aktarım ----------

/** Boş metin, undefined ve boş listeleri atar; metinleri kırpar. */
function compact<T extends object>(obj: T): T {
  const entries = Object.entries(obj)
    .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v] as const)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
  return Object.fromEntries(entries) as T
}

function ymText(value: YearMonth | null): string | undefined {
  if (!value) return undefined
  return value.month == null ? String(value.year) : `${value.year}-${String(value.month).padStart(2, '0')}`
}

/** Devam eden aralıkta endDate yazılmaz (JSON Resume'de "günümüz" budur). */
function rangeDates(range: DateRange): Dated {
  return { startDate: ymText(range.start), endDate: range.current ? undefined : ymText(range.end) }
}

interface Blocks {
  paragraphs: string[]
  bullets: string[]
}

function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeName === 'BR') return '\n'
  return Array.from(node.childNodes).map(textOf).join('')
}

const tidy = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

/** Zengin metni paragraflara ve madde metinlerine ayırır; biçim ve bağlantı adresi düşer. */
function readRichText(html: string): Blocks {
  const out: Blocks = { paragraphs: [], bullets: [] }
  if (!html) return out
  const body = new DOMParser().parseFromString(sanitizeRichText(html), 'text/html').body
  let loose = ''
  const flush = () => {
    const t = tidy(loose)
    if (t) out.paragraphs.push(t)
    loose = ''
  }
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeName === 'P') {
      flush()
      const t = tidy(textOf(node))
      if (t) out.paragraphs.push(t)
    } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
      flush()
      for (const li of Array.from((node as Element).children)) {
        const t = tidy(textOf(li))
        if (t) out.bullets.push(t)
      }
    } else {
      loose += textOf(node)
    }
  }
  flush()
  return out
}

/** Düz metin: paragraflar boş satırla, maddeler "- " ile alt alta. */
function plainText(html: string): string {
  const { paragraphs, bullets } = readRichText(html)
  const list = bullets.map((b) => `- ${b}`).join('\n')
  return [...paragraphs, list].filter(Boolean).join('\n\n')
}

/** "İzmir, Türkiye" → { city, region }; sondaki iki harf ülke kodu sayılır. */
function splitLocation(value: string): JsonResumeLocation | undefined {
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) return undefined
  const [city, ...rest] = parts
  const location: JsonResumeLocation = { city }
  if (rest.length && /^[A-Z]{2}$/.test(rest[rest.length - 1])) location.countryCode = rest.pop()
  if (rest.length) location.region = rest.join(', ')
  return location
}

const PROFILE_BASE = { LinkedIn: 'linkedin.com/in/', GitHub: 'github.com/' } as const

function profile(network: keyof typeof PROFILE_BASE, value: string): JsonResumeProfile | null {
  const v = value.trim()
  if (!v) return null
  // Yalnız kullanıcı adı yazılmışsa adresi biz kurarız
  const url = toHref(/[./]/.test(v) ? v : PROFILE_BASE[network] + v)
  let username: string | undefined
  try {
    username = new URL(url).pathname.split('/').filter(Boolean).pop()
  } catch {
    username = undefined
  }
  return compact({ network, username, url })
}

const href = (value: string) => (value.trim() ? toHref(value) : undefined)

export function toJsonResume(cv: Cv): JsonResume {
  const visible = <T extends SectionType>(type: T): ItemOf<T>[] =>
    cv.sections
      .filter((s): s is SectionOf<T> => s.type === type && !s.hidden)
      .flatMap((s) => (s.items as ItemOf<T>[]).filter((item) => !item.hidden && !isItemEmpty(item)))

  const p = cv.personal
  const summary = visible('summary')
    .map((item) => plainText(item.content))
    .filter(Boolean)
    .join('\n\n')
  const profiles = [profile('LinkedIn', p.linkedin), profile('GitHub', p.github)].filter(
    (x): x is JsonResumeProfile => !!x,
  )

  const customSections = cv.sections
    .filter((s): s is SectionOf<'custom'> => s.type === 'custom' && !s.hidden)
    .map((s) => ({
      title: s.title,
      items: s.items
        .filter((item) => !item.hidden && !isItemEmpty(item))
        .map((item) =>
          compact({
            title: item.title,
            subtitle: item.subtitle,
            location: item.location,
            url: item.url,
            ...rangeDates(item.dates),
            current: item.dates.current,
            description: item.description,
          }),
        ),
    }))
    .filter((s) => s.items.length > 0)

  return {
    $schema: JSON_RESUME_SCHEMA_URL,
    basics: compact({
      name: p.fullName,
      label: p.headline,
      image: p.photo ?? undefined,
      email: p.email,
      phone: p.phone,
      url: href(p.website),
      summary,
      location: splitLocation(p.location),
      profiles,
    }),
    work: visible('experience').map((item) => {
      const b = readRichText(item.description)
      return compact({
        name: item.company,
        position: item.position,
        location: item.location,
        ...rangeDates(item.dates),
        summary: b.paragraphs.join('\n\n'),
        highlights: b.bullets,
      })
    }),
    volunteer: visible('volunteer').map((item) => {
      const b = readRichText(item.description)
      return compact({
        organization: item.organization,
        position: item.role,
        ...rangeDates(item.dates),
        summary: b.paragraphs.join('\n\n'),
        highlights: b.bullets,
      })
    }),
    education: visible('education').map((item) => ({
      ...compact({
        institution: item.school,
        studyType: item.degree,
        area: item.field,
        score: item.grade,
        ...rangeDates(item.dates),
      }),
      courses: [],
    })),
    awards: visible('awards').map((item) =>
      compact({ title: item.title, awarder: item.issuer, date: ymText(item.date), summary: plainText(item.description) }),
    ),
    certificates: visible('certificates').map((item) =>
      compact({ name: item.name, issuer: item.issuer, date: ymText(item.date), url: href(item.url) }),
    ),
    skills: visible('skills').map((item) =>
      compact({
        name: item.name,
        keywords: item.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    ),
    languages: visible('languages').map((item) => compact({ language: item.name, fluency: item.level })),
    references: visible('references').map((item) => {
      const head = [item.position, item.organization].filter((s) => s.trim()).join(', ')
      const reference = [head, item.email, item.phone].filter((s) => s.trim()).join(' · ')
      return compact({ name: item.name, reference })
    }),
    projects: visible('projects').map((item) => {
      const b = readRichText(item.description)
      return compact({
        name: item.name,
        description: b.paragraphs.join('\n\n'),
        highlights: b.bullets,
        url: href(item.url),
        roles: item.role.trim() ? [item.role] : [],
        ...rangeDates(item.dates),
      })
    }),
    meta: {
      canonical: JSON_RESUME_SCHEMA_URL,
      version: 'v1.0.0',
      lastModified: cv.updatedAt,
      cveditor: { language: cv.language, customSections },
    },
  }
}

// ---------- İçe aktarım ----------

type Obj = Record<string, unknown>
type Entry = [Obj, string]

const Text = z.union([z.string(), z.number()]).transform((v) => String(v).trim())
const AnyObject = z.record(z.string(), z.unknown())
const AnyArray = z.array(z.unknown())

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Düz metin + maddeler → güvenli zengin metin. Boş satır paragraf, tek satır sonu <br>. */
function richText(summary: string, highlights: string[] = []): string {
  const paragraphs = summary
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para.split('\n').map((line) => escapeHtml(line.trim())).join('<br>')}</p>`)
  const list = highlights.length ? `<ul>${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>` : ''
  return sanitizeRichText(paragraphs.join('') + list)
}

const PRESENT_WORDS = /^(present|current|now|ongoing|today|günümüz|devam)/i

/** "YYYY", "YYYY-MM", "YYYY-MM-DD" (ve ISO zaman damgası) → YearMonth */
function parseDate(value: string): YearMonth | null {
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?:$|T)/.exec(value.trim())
  if (!m) return null
  const parsed = YearMonthSchema.safeParse({ year: Number(m[1]), month: m[2] ? Number(m[2]) : null })
  return parsed.success ? parsed.data : null
}

/** "pozisyon, kurum · e-posta · telefon" biçimini (dışa aktarımımız) geri çözer; serbest metin pozisyona gider. */
function parseReference(text: string) {
  const out = { position: '', organization: '', email: '', phone: '' }
  const rest: string[] = []
  for (const part of text.split(' · ').map((s) => s.trim()).filter(Boolean)) {
    if (!out.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part)) out.email = part
    else if (!out.phone && /^\+?[\d\s().-]{6,}$/.test(part)) out.phone = part
    else rest.push(part)
  }
  const head = rest.join(' · ')
  const comma = head.indexOf(', ')
  if (rest.length === 1 && comma > 0 && head.length <= 120) {
    out.position = head.slice(0, comma).trim()
    out.organization = head.slice(comma + 2).trim()
  } else {
    out.position = head
  }
  return out
}

/** Alan alan okuyan, bozuk değeri atlayıp uyarı yazan yardımcılar. */
function createReader(warnings: string[]) {
  const warn = (path: string, message: string) => warnings.push(`${path}: ${message}`)
  const at = (base: string, key: string) => (base ? `${base}.${key}` : key)

  const object = (value: unknown, path: string): Obj | null => {
    if (value == null) return null
    const r = AnyObject.safeParse(value)
    if (r.success && !Array.isArray(value)) return r.data
    warn(path, m.imp_json_warn_object())
    return null
  }

  const text = (o: Obj, key: string, base: string): string => {
    const v = o[key]
    if (v == null) return ''
    const r = Text.safeParse(v)
    if (r.success) return r.data
    warn(at(base, key), m.imp_json_warn_text())
    return ''
  }

  const texts = (o: Obj, key: string, base: string): string[] => {
    const v = o[key]
    if (v == null) return []
    if (typeof v === 'string') return v.trim() ? [v.trim()] : []
    const arr = AnyArray.safeParse(v)
    if (!arr.success) {
      warn(at(base, key), m.imp_json_warn_list())
      return []
    }
    return arr.data.flatMap((x, i) => {
      const r = Text.safeParse(x)
      if (r.success) return r.data ? [r.data] : []
      warn(`${at(base, key)}[${i}]`, m.imp_json_warn_text())
      return []
    })
  }

  const list = (o: Obj | null, key: string, base = ''): Entry[] => {
    const v = o?.[key]
    if (v == null) return []
    const arr = AnyArray.safeParse(v)
    if (!arr.success) {
      warn(at(base, key), m.imp_json_warn_list())
      return []
    }
    return arr.data.flatMap((x, i): Entry[] => {
      const path = `${at(base, key)}[${i}]`
      const item = object(x, path)
      return item ? [[item, path]] : []
    })
  }

  const toDate = (s: string, path: string): YearMonth | null => {
    if (!s) return null
    const d = parseDate(s)
    if (!d) warn(path, m.imp_json_warn_date({ value: s }))
    return d
  }

  const date = (o: Obj, key: string, base: string) => toDate(text(o, key, base), at(base, key))

  /** Bitişsiz başlangıç yalnız iş/gönüllülük/projede "devam ediyor" sayılır. */
  const range = (o: Obj, base: string, openMeansCurrent: boolean): DateRange => {
    const start = date(o, 'startDate', base)
    const endText = text(o, 'endDate', base)
    if (PRESENT_WORDS.test(endText)) return { start, end: null, current: true }
    const end = toDate(endText, at(base, 'endDate'))
    return { start, end, current: openMeansCurrent && !!start && !end }
  }

  return { object, text, texts, list, date, range }
}

function joinLocation(parts: string[]): string {
  return parts.filter(Boolean).join(', ')
}

const EXTRA_TITLES: Record<CvLanguage, { publications: string; interests: string }> = {
  tr: { publications: 'Yayınlar', interests: 'İlgi Alanları' },
  en: { publications: 'Publications', interests: 'Interests' },
}

export interface JsonResumeImport {
  personal: Personal
  sections: Section[]
  warnings: string[]
}

export function fromJsonResume(input: unknown, options: { language: CvLanguage }): JsonResumeImport {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(m.imp_json_err_not_object())
  }
  const root = input as Obj
  if (['basics', 'work', 'education', 'projects', 'skills'].every((key) => root[key] == null)) {
    throw new Error(m.imp_json_err_not_resume())
  }

  const warnings: string[] = []
  const r = createReader(warnings)

  // Kişisel bilgiler
  const personal = emptyPersonal()
  const basics = r.object(root.basics, 'basics') ?? {}
  personal.fullName = r.text(basics, 'name', 'basics')
  personal.headline = r.text(basics, 'label', 'basics')
  personal.email = r.text(basics, 'email', 'basics')
  personal.phone = r.text(basics, 'phone', 'basics')
  personal.website = r.text(basics, 'url', 'basics') || r.text(basics, 'website', 'basics')
  const image = r.text(basics, 'image', 'basics') || r.text(basics, 'picture', 'basics')
  if (/^data:image\//i.test(image)) personal.photo = image
  else if (image) warnings.push(`basics.image: ${m.imp_json_warn_image()}`)
  const loc = r.object(basics.location, 'basics.location')
  if (loc) {
    const t = (key: string) => r.text(loc, key, 'basics.location')
    personal.location =
      joinLocation([t('city'), t('region'), t('countryCode')]) || joinLocation([t('address'), t('postalCode')])
  }
  for (const [prof, path] of r.list(basics, 'profiles', 'basics')) {
    const network = r.text(prof, 'network', path)
    const username = r.text(prof, 'username', path)
    if (/linkedin/i.test(network)) {
      personal.linkedin = r.text(prof, 'url', path) || (username ? `linkedin.com/in/${username}` : '')
    } else if (/github/i.test(network)) {
      personal.github = r.text(prof, 'url', path) || (username ? `github.com/${username}` : '')
    }
  }

  const sections: Section[] = []
  const add = <T extends SectionType>(type: T, items: ItemOf<T>[], title: string | null = null) => {
    const kept = items.filter((item) => !isItemEmpty(item))
    if (kept.length) sections.push({ ...createSection(type), title, items: kept } as Section)
  }

  const summary = r.text(basics, 'summary', 'basics')
  add('summary', summary ? [{ ...createItem('summary'), content: richText(summary) }] : [])

  add(
    'experience',
    r.list(root, 'work').map(([o, path]) => ({
      ...createItem('experience'),
      position: r.text(o, 'position', path),
      // v0.x şemasında şirket adı "company" alanındaydı
      company: r.text(o, 'name', path) || r.text(o, 'company', path),
      location: r.text(o, 'location', path),
      dates: r.range(o, path, true),
      description: richText(r.text(o, 'summary', path), r.texts(o, 'highlights', path)),
    })),
  )

  add(
    'education',
    r.list(root, 'education').map(([o, path]) => ({
      ...createItem('education'),
      school: r.text(o, 'institution', path),
      degree: r.text(o, 'studyType', path),
      field: r.text(o, 'area', path),
      grade: r.text(o, 'score', path) || r.text(o, 'gpa', path),
      dates: r.range(o, path, false),
      description: richText('', r.texts(o, 'courses', path)),
    })),
  )

  add(
    'projects',
    r.list(root, 'projects').map(([o, path]) => ({
      ...createItem('projects'),
      name: r.text(o, 'name', path),
      role: r.texts(o, 'roles', path).join(', '),
      url: r.text(o, 'url', path),
      dates: r.range(o, path, true),
      description: richText(r.text(o, 'description', path), r.texts(o, 'highlights', path)),
    })),
  )

  add(
    'skills',
    r.list(root, 'skills').map(([o, path]) => ({
      ...createItem('skills'),
      name: r.text(o, 'name', path),
      keywords: r.texts(o, 'keywords', path).join(', '),
    })),
  )

  add(
    'languages',
    r.list(root, 'languages').map(([o, path]) => ({
      ...createItem('languages'),
      name: r.text(o, 'language', path),
      level: r.text(o, 'fluency', path),
    })),
  )

  add(
    'certificates',
    r.list(root, 'certificates').map(([o, path]) => ({
      ...createItem('certificates'),
      name: r.text(o, 'name', path),
      issuer: r.text(o, 'issuer', path),
      date: r.date(o, 'date', path),
      url: r.text(o, 'url', path),
    })),
  )

  add(
    'awards',
    r.list(root, 'awards').map(([o, path]) => ({
      ...createItem('awards'),
      title: r.text(o, 'title', path),
      issuer: r.text(o, 'awarder', path),
      date: r.date(o, 'date', path),
      description: richText(r.text(o, 'summary', path)),
    })),
  )

  add(
    'volunteer',
    r.list(root, 'volunteer').map(([o, path]) => ({
      ...createItem('volunteer'),
      role: r.text(o, 'position', path),
      organization: r.text(o, 'organization', path),
      dates: r.range(o, path, true),
      description: richText(r.text(o, 'summary', path), r.texts(o, 'highlights', path)),
    })),
  )

  add(
    'references',
    r.list(root, 'references').map(([o, path]) => ({
      ...createItem('references'),
      name: r.text(o, 'name', path),
      ...parseReference(r.text(o, 'reference', path)),
    })),
  )

  // Standartta karşılığı olmayan yayın ve ilgi alanları özel bölüm olur
  const extra = EXTRA_TITLES[options.language]
  add(
    'custom',
    r.list(root, 'publications').map(([o, path]) => ({
      ...createItem('custom'),
      title: r.text(o, 'name', path),
      subtitle: r.text(o, 'publisher', path),
      url: r.text(o, 'url', path),
      dates: { start: r.date(o, 'releaseDate', path), end: null, current: false },
      description: richText(r.text(o, 'summary', path)),
    })),
    extra.publications,
  )
  add(
    'custom',
    r.list(root, 'interests').map(([o, path]) => ({
      ...createItem('custom'),
      title: r.text(o, 'name', path),
      description: richText(r.texts(o, 'keywords', path).join(', ')),
    })),
    extra.interests,
  )

  // CVeditör'ün kendi dışa aktardığı özel bölümler
  const meta = r.object(root.meta, 'meta')
  const cveditor = meta && r.object(meta.cveditor, 'meta.cveditor')
  for (const [cs, path] of r.list(cveditor, 'customSections', 'meta.cveditor')) {
    add(
      'custom',
      r.list(cs, 'items', path).map(([o, itemPath]) => {
        const dates = r.range(o, itemPath, false)
        return {
          ...createItem('custom'),
          title: r.text(o, 'title', itemPath),
          subtitle: r.text(o, 'subtitle', itemPath),
          location: r.text(o, 'location', itemPath),
          url: r.text(o, 'url', itemPath),
          dates: { ...dates, current: o.current === true },
          description: sanitizeRichText(r.text(o, 'description', itemPath)),
        }
      }),
      r.text(cs, 'title', path) || null,
    )
  }

  return { personal, sections, warnings }
}
