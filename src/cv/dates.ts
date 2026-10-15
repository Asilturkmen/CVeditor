import { MONTHS_SHORT, PRESENT } from './locale'
import type { CvLanguage, DateRange, YearMonth } from './schema'

export function formatYearMonth(value: YearMonth | null, language: CvLanguage): string {
  if (!value) return ''
  if (value.month == null) return String(value.year)
  return `${MONTHS_SHORT[language][value.month - 1]} ${value.year}`
}

/** "Oca 2024 – Günümüz", "2019 – 2023", yalnız başlangıç varsa tek tarih */
export function formatDateRange(range: DateRange, language: CvLanguage): string {
  const start = formatYearMonth(range.start, language)
  const end = range.current ? PRESENT[language] : formatYearMonth(range.end, language)
  if (start && end) return start === end ? start : `${start} – ${end}`
  return start || end
}

/** Sıralama ve doğrulama için: bitiş başlangıçtan önce mi? */
export function isRangeInverted(range: DateRange): boolean {
  if (!range.start || !range.end || range.current) return false
  const a = range.start.year * 12 + (range.start.month ?? 1)
  const b = range.end.year * 12 + (range.end.month ?? 12)
  return b < a
}
