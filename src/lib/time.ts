import { getLocale } from '@/paraglide/runtime'

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** Geçerli bir tarih metni mi? (Yedekten ya da bozuk kayıttan her şey gelebilir.) */
export function isValidDate(iso: unknown): iso is string {
  return typeof iso === 'string' && iso !== '' && Number.isFinite(Date.parse(iso))
}

/** "3 saat önce", "dün" gibi göreli zaman (arayüz dilinde). Geçersiz tarihte boş metin; asla hata fırlatmaz. */
export function relativeTime(iso: string, now = Date.now()): string {
  if (!isValidDate(iso)) return ''
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}

export function daysSince(iso: string | undefined | null, now = Date.now()): number | null {
  if (!isValidDate(iso)) return null
  return Math.floor((now - Date.parse(iso)) / (24 * 3600 * 1000))
}

/** Tarih ve saat (arayüz dilinde). Geçersiz tarihte boş metin; asla hata fırlatmaz (liste ekranı çökmesin). */
export function formatDateTime(iso: string): string {
  if (!isValidDate(iso)) return ''
  try {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return ''
  }
}

/** Saat bu kadar ilerideyse (bozuk kayıt, yanlış saat) "bir öncekinden büyük" kuralı bırakılır. */
const MAX_AHEAD_MS = 60_000

/**
 * Yeni `updatedAt`. Kayıt sürümü olarak da kullanıldığından (iki sekme denetimi) aynı milisaniyede
 * art arda iki değişiklik aynı değeri almaz: öncekinden büyük olmayan zaman bir milisaniye ilerletilir.
 */
export function nextTimestamp(previous?: string | null, now = Date.now()): string {
  const prev = isValidDate(previous) ? Date.parse(previous) : NaN
  const ahead = prev - now
  return new Date(ahead >= 0 && ahead < MAX_AHEAD_MS ? prev + 1 : now).toISOString()
}
