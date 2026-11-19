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

/** Yıl listesinin alt sınırı (şema 1900-2100 kabul eder; liste kısa kalsın diye buradan başlar). */
export const FIRST_LISTED_YEAR = 1960

/**
 * Tarih seçicideki yıllar, yeniden eskiye: gelecek 5 yıldan `FIRST_LISTED_YEAR`'a. Kayıttaki yıl bu
 * aralığın dışındaysa (ör. yedekten gelen 1955 ya da 2040) listeye eklenir: mevcut değer her zaman
 * görünür ve yeniden seçilebilir, boş görünüp ilk dokunuşta kaybolmaz.
 */
export function yearOptions(current: number | null | undefined, thisYear = new Date().getFullYear()): number[] {
  const last = thisYear + 5
  const years = Array.from({ length: last - FIRST_LISTED_YEAR + 1 }, (_, i) => last - i)
  if (current == null || !Number.isInteger(current) || years.includes(current)) return years
  return current > last ? [current, ...years] : [...years, current]
}
