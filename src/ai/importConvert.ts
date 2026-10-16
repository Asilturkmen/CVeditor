import { TEXT_FIELDS } from '@/cv/fields'
import { createItem, createSection, emptyPersonal, isItemEmpty } from '@/cv/factory'
import type { AnyItem, DateRange, Personal, Section, YearMonth } from '@/cv/schema'
import { sanitizeRichText } from '@/render/richtext'
import { findDates, headingOf } from './importHeuristics'
import type { ImportResult } from './types'

/**
 * İçe aktarma sonucunu (kurallı ayrıştırıcı ya da yapay zekâ) CV modeline
 * çevirir: yeni kimlikler, tarihler YearMonth'a, maddeler <ul><li>'ye
 * (kaçışlı, sanitizeRichText'ten geçmiş). Gerçek sağlayıcı da bunu kullanır.
 */

export interface ImportedCv {
  personal: Personal
  sections: Section[]
}

/** "2024-02", "2024", "02/2024", "Şub 2024", "present" → YearMonth | 'present' | null */
export function parseImportDate(value: string | undefined | null): YearMonth | 'present' | null {
  const v = value?.trim()
  if (!v) return null
  if (/^(?:present|current|now|today|ongoing|günümüz|gunumuz|halen|hala|hâlâ|devam)/i.test(v)) return 'present'
  const valid = (year: number, month: number | null): YearMonth | null =>
    year >= 1900 && year <= 2100 && (month == null || (month >= 1 && month <= 12)) ? { year, month } : null
  let m = /^(\d{4})[-./](\d{1,2})(?:[-./]\d{1,2})?$/.exec(v)
  if (m) return valid(Number(m[1]), Number(m[2]))
  m = /^(\d{4})$/.exec(v)
  if (m) return valid(Number(m[1]), null)
  m = /^(?:\d{1,2}[./])?(\d{1,2})[./](\d{4})$/.exec(v)
  if (m) return valid(Number(m[2]), Number(m[1]))
  const found = findDates(v)
  return found && found.start !== v ? parseImportDate(found.start) : null
}

function toRange(start?: string, end?: string): DateRange {
  const s = parseImportDate(start)
  const e = parseImportDate(end)
  return {
    start: s === 'present' ? null : s,
    end: e === 'present' ? null : e,
    current: e === 'present',
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Düz metin paragraflar + maddeler → kısıtlı zengin metin */
export function toRichText(paragraphs: string | undefined, bullets: string[] = []): string {
  const paras = (paragraphs ?? '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
  const items = bullets.map((b) => b.trim()).filter(Boolean)
  const list = items.length ? `<ul>${items.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''
  return sanitizeRichText(paras.join('') + list)
}

const plain = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()

export function importResultToCv(result: ImportResult): ImportedCv {
  const personal = emptyPersonal()
  for (const key of ['fullName', 'headline', 'email', 'phone', 'location', 'website', 'linkedin', 'github'] as const) {
    personal[key] = plain(result.personal[key])
  }

  const sections: Section[] = []
  for (const source of result.sections) {
    const type = source.type
    const section = createSection(type)
    // Standart başlıklar ("İş Deneyimi", "Experience") CV diline göre otomatik gelsin
    const heading = source.title ? headingOf(source.title) : null
    const keep = source.title?.trim() && (type === 'custom' || !heading || heading.keepTitle || heading.kind !== type)
    section.title = keep ? source.title!.trim() : null

    const items: AnyItem[] = []
    for (const entry of source.items) {
      const fields = entry.fields ?? {}
      const item = createItem(type) as AnyItem & Record<string, unknown>
      const bullets = entry.bullets ?? []
      let bulletsUsed = false
      for (const field of TEXT_FIELDS[type]) {
        if (field.rich) {
          item[field.key] = toRichText(fields[field.key] ?? (field.key === 'content' ? fields.description : undefined), bullets)
          bulletsUsed = true
        } else item[field.key] = plain(fields[field.key])
      }
      if (!bulletsUsed && bullets.length) {
        // Açıklama alanı olmayan türler: beceride anahtar sözcüklere, diğerlerinde ilk alana eklenir
        const key = type === 'skills' ? 'keywords' : TEXT_FIELDS[type][0].key
        item[key] = [item[key] as string, ...bullets.map(plain)].filter(Boolean).join(', ')
      }
      const start = entry.start ?? fields.start ?? fields.date
      const end = entry.end ?? fields.end
      if ('dates' in item) item.dates = toRange(start, end)
      if ('date' in item) {
        const d = parseImportDate(start ?? end)
        item.date = d === 'present' ? null : d
      }
      if (!isItemEmpty(item)) items.push(item)
    }
    if (items.length === 0) continue
    ;(section as { items: AnyItem[] }).items = items
    sections.push(section as Section)
  }
  return { personal, sections }
}
