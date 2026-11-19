import { formatDateRange, formatYearMonth } from '@/cv/dates'
import { stripHtml } from '@/cv/factory'
import type { AnyItem, CvLanguage, DateRange, SectionType, YearMonth } from '@/cv/schema'

/**
 * Kaydın adı (satır, uyarılar, kapsam seçimi, bildirim için). Metin "…" ile kesilmez: uzun ad
 * gösterildiği yerde sarar; özetin adı yalnız ilk cümlesidir (yapıyla kısalır).
 */
export function itemLabel(type: SectionType, item: AnyItem): string {
  const it = item as Record<string, unknown>
  const s = (key: string) => (typeof it[key] === 'string' ? (it[key] as string).trim() : '')
  const join = (...parts: string[]) => parts.filter(Boolean).join(' — ')
  switch (type) {
    case 'summary':
      // Özetin adı ilk cümlesidir (kesilmez; satırda sarar).
      return firstSentence(stripHtml(s('content')))
    case 'experience':
      return join(s('position'), s('company'))
    case 'education':
      return join(s('school'), s('field') || s('degree'))
    case 'projects':
      return s('name')
    case 'skills':
      return s('name') || s('keywords')
    case 'languages':
      return join(s('name'), s('level'))
    case 'certificates':
      return s('name')
    case 'awards':
      return s('title')
    case 'volunteer':
      return join(s('role'), s('organization'))
    case 'references':
      return s('name')
    case 'custom':
      return s('title')
  }
}

/**
 * Anahat satırının parçaları: ad (kalın), kurum (soluk, adın yanında), tarih (sağda). Metin
 * kısaltılmaz; satır sarar. Boş parça ''.
 */
export function rowParts(type: SectionType, item: AnyItem, language: CvLanguage): { title: string; meta: string; date: string } {
  const it = item as Record<string, unknown>
  const s = (key: string) => (typeof it[key] === 'string' ? (it[key] as string).trim() : '')
  const range = () => {
    const r = it.dates as DateRange | undefined
    return r ? formatDateRange(r, language) : ''
  }
  const month = () => formatYearMonth((it.date as YearMonth | null | undefined) ?? null, language)
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ')
  switch (type) {
    case 'summary':
      return { title: firstSentence(stripHtml(s('content'))), meta: '', date: '' }
    case 'experience':
      return { title: s('position'), meta: s('company'), date: range() }
    case 'education':
      return { title: s('school'), meta: join(s('field'), s('degree')), date: range() }
    case 'projects':
      return { title: s('name'), meta: s('role'), date: range() }
    case 'skills':
      return { title: s('name'), meta: s('keywords'), date: '' }
    case 'languages':
      return { title: s('name'), meta: s('level'), date: '' }
    case 'certificates':
      return { title: s('name'), meta: s('issuer'), date: month() }
    case 'awards':
      return { title: s('title'), meta: s('issuer'), date: month() }
    case 'volunteer':
      return { title: s('role'), meta: s('organization'), date: range() }
    case 'references':
      return { title: s('name'), meta: join(s('position'), s('organization')), date: '' }
    case 'custom':
      return { title: s('title'), meta: s('subtitle'), date: range() }
  }
}

/** Metnin ilk cümlesi (boşluklar sadeleşir). Cümle uzunsa kesilmez; satır sarar. */
export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const match = /^(.+?[.!?])(\s|$)/.exec(clean)
  return match ? match[1] : clean
}
