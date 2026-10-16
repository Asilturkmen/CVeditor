/**
 * Yer adı listeleri ve karşılaştırma katlaması. İçe aktarma (konum tanıma,
 * importText.ts) ve maskeleme (kişinin konumundan ülke adlarını ayırmak,
 * mask.ts) birlikte kullanır.
 */

/** Karşılaştırma için katlama: Türkçe büyük/küçük harf ve aksanlar tek biçime iner ("DENEYİM" → "deneyim"). */
export function fold(value: string): string {
  return value
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Konum yerine geçen genel sözcükler (çalışma biçimi) */
export const REMOTE_WORDS = new Set(['remote', 'uzaktan', 'hybrid', 'hibrit'])

export const CITIES = new Set([
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'kocaeli', 'eskisehir', 'konya', 'adana', 'gaziantep',
  'kayseri', 'trabzon', 'samsun', 'mersin', 'diyarbakir', 'sakarya', 'tekirdag', 'denizli', 'manisa', 'mugla',
  'aydin', 'balikesir', 'edirne', 'canakkale', 'malatya', 'erzurum', 'van', 'hatay', 'sivas', 'bolu', 'duzce',
  'isparta', 'afyonkarahisar', 'kutahya', 'zonguldak', 'rize', 'ordu', 'giresun', 'elazig', 'sanliurfa',
  'mardin', 'batman', 'kahramanmaras', 'osmaniye', 'nevsehir', 'aksaray', 'karaman', 'yalova', 'bodrum',
  'gebze', 'kadikoy', 'besiktas', 'sisli', 'uskudar', 'atasehir', 'maslak', 'levent', 'cankaya', 'bornova',
  'lefkosa', 'girne', 'magusa', 'baku', 'london', 'berlin', 'munich', 'munih', 'hamburg', 'frankfurt',
  'amsterdam', 'rotterdam', 'paris', 'madrid', 'barcelona', 'lisbon', 'dublin', 'vienna', 'viyana', 'zurich',
  'stockholm', 'oslo', 'copenhagen', 'helsinki', 'warsaw', 'prague', 'budapest', 'brussels', 'milan', 'rome',
  'new york', 'san francisco', 'seattle', 'boston', 'austin', 'chicago', 'los angeles', 'toronto', 'vancouver',
  'dubai', 'doha', 'singapore', 'tokyo', 'sydney', 'manchester', 'edinburgh', 'cambridge', 'oxford',
  ...REMOTE_WORDS,
])

export const COUNTRIES = new Set([
  'turkiye', 'turkey', 'kktc', 'trnc', 'germany', 'almanya', 'united kingdom', 'uk', 'ingiltere', 'netherlands',
  'hollanda', 'usa', 'us', 'united states', 'abd', 'canada', 'kanada', 'france', 'fransa', 'spain', 'ispanya',
  'italy', 'italya', 'ireland', 'irlanda', 'austria', 'avusturya', 'switzerland', 'isvicre', 'sweden', 'isvec',
  'norway', 'denmark', 'finland', 'poland', 'portugal', 'belgium', 'azerbaijan', 'azerbaycan', 'uae', 'bae',
  'qatar', 'katar', 'japan', 'australia',
])
