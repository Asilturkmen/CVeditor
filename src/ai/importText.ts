import type { CvLanguage } from '@/cv/schema'
import { buildContactMasks, createMasker } from './mask'
import type { ImportResult } from './types'

/**
 * İçe aktarılan CV metni için dil bağımsız yardımcılar: iletişim bilgisi
 * çıkarma, dil algılama ve sağlayıcıya gitmeden önce maskeleme. Hepsi
 * tarayıcıda çalışır; metin hiçbir yere gönderilmez.
 */

export interface ExtractedContacts {
  email?: string
  phone?: string
  linkedin?: string
  github?: string
  website?: string
  location?: string
}

/** Karşılaştırma için katlama: Türkçe büyük/küçük harf ve aksanlar tek biçime iner ("DENEYİM" → "deneyim"). */
export function fold(value: string): string {
  return value
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

// ---------------------------------------------------------------- Kalıplar

export const EMAIL_RE = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[a-z]{2,}/giu
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[\p{L}\d%_.-]+\/?/giu
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+(?:\/[\w.-]+)?\/?/gi
const URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+(?:com|net|org|dev|io|me|app|co|tr|info|xyz|site|tech|design|page|blog|art|studio|online|eu|de|uk)(?:\.[a-z]{2})?(?:\/[^\s,;|)⟧]*)?/gi
/** +90 532 123 45 67 · 0532 123 45 67 · (0532) 123-45-67 · +1 (415) 555-0132 · +44 20 7946 0958 */
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,4}/g

function isPhone(candidate: string, before: string): boolean {
  const digits = candidate.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  // Tarih aralığı ya da yıl dizisi değil: "2019 - 2023 2024"
  if (/^(?:19|20)\d{2}\b/.test(candidate) && !candidate.startsWith('+')) return false
  if (/[\p{L}\d]$/u.test(before)) return false
  const start = candidate.trimStart()[0]
  return start === '+' || start === '(' || start === '0' || (digits.length === 10 && digits.startsWith('5'))
}

/** Satır sonunda bölünmüş bağlantıları birleştirir: "linkedin.com/in/ada-" + "yilmaz". */
export function joinWrappedUrls(text: string): string {
  return text.replace(/((?:linkedin|github)\.com\/\S*[-/_])\n(?=[\w-]+(?:\n|$))/gi, '$1')
}

export function phonesIn(text: string): string[] {
  const out: string[] = []
  for (const match of text.matchAll(PHONE_RE)) {
    const value = match[0].trim()
    const before = text.slice(Math.max(0, match.index - 1), match.index)
    if (isPhone(value, before)) out.push(value)
  }
  return out
}

const cleanUrl = (value: string) => value.replace(/[.,;:)]+$/, '').replace(/\/$/, '')
const stripProtocol = (value: string) => cleanUrl(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '')

// ---------------------------------------------------------------- Konum

const CITIES = new Set(
  [
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
    'remote', 'uzaktan', 'hybrid', 'hibrit',
  ],
)
const COUNTRIES = new Set([
  'turkiye', 'turkey', 'kktc', 'trnc', 'germany', 'almanya', 'united kingdom', 'uk', 'ingiltere', 'netherlands',
  'hollanda', 'usa', 'us', 'united states', 'abd', 'canada', 'kanada', 'france', 'fransa', 'spain', 'ispanya',
  'italy', 'italya', 'ireland', 'irlanda', 'austria', 'avusturya', 'switzerland', 'isvicre', 'sweden', 'isvec',
  'norway', 'denmark', 'finland', 'poland', 'portugal', 'belgium', 'azerbaijan', 'azerbaycan', 'uae', 'bae',
  'qatar', 'katar', 'japan', 'australia',
])

/** "İstanbul", "İstanbul, Türkiye", "Berlin, Germany", "Remote" gibi parçalar. */
export function looksLikeLocation(part: string): boolean {
  const value = part.trim().replace(/[()]/g, '')
  if (/^⟦LOCATION(?:_\d+)?⟧$/.test(value)) return true
  if (!value || value.length > 40 || /\d|@/.test(value)) return false
  const pieces = fold(value)
    .split(/\s*[,/]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (pieces.length === 0 || pieces.length > 3) return false
  return pieces.every((p) => CITIES.has(p) || COUNTRIES.has(p)) || (pieces.length === 2 && COUNTRIES.has(pieces[1]))
}

const SPLIT_PARTS = /\s+[·|•–—]\s+|\s{3,}|\t|\s+\|\s*|\s*\|\s+/

function locationIn(lines: string[]): string | undefined {
  for (const line of lines) {
    const labeled = /^(?:adres|address|konum|location|şehir|city|ikamet)\s*[:：]\s*(.+)$/i.exec(line.trim())
    if (labeled) return labeled[1].trim()
    for (const part of line.split(SPLIT_PARTS)) {
      if (looksLikeLocation(part) && !/^⟦/.test(part.trim())) return part.trim()
    }
  }
  return undefined
}

// ---------------------------------------------------------------- Çıkarma

/**
 * Metindeki kişisel iletişim bilgileri. Web sitesi yalnız başlık
 * bölgesinde (ilk satırlar) ya da başka iletişim bilgisiyle aynı satırda,
 * ya da "Web:" etiketiyle aranır; proje bağlantıları kişisel site sayılmaz.
 */
export function extractContacts(input: string): ExtractedContacts {
  const text = joinWrappedUrls(input)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const result: ExtractedContacts = {}

  const email = text.match(EMAIL_RE)?.[0]
  if (email) result.email = email
  const phone = phonesIn(text)[0]
  if (phone) result.phone = phone
  const linkedin = text.match(LINKEDIN_RE)?.[0]
  if (linkedin) result.linkedin = stripProtocol(linkedin)
  else {
    const label = /(?:^|\s)linkedin\s*[:：]\s*(?:\/?in\/)?([\p{L}\d_-]{3,})/iu.exec(text)
    if (label) result.linkedin = `linkedin.com/in/${label[1]}`
  }
  const github = text.match(GITHUB_RE)?.[0]
  if (github) result.github = stripProtocol(github)
  else {
    const label = /(?:^|\s)github\s*[:：]\s*@?([\w-]{2,})/i.exec(text)
    if (label) result.github = `github.com/${label[1]}`
  }

  const isContactLine = (line: string) =>
    new RegExp(EMAIL_RE.source, 'iu').test(line) || phonesIn(line).length > 0 || /linkedin|github/i.test(line)
  const candidates = lines.filter((line, i) => i < 12 || isContactLine(line) || /^(?:web|website|site|portfolyo|portfolio|blog)\s*[:：]/i.test(line))
  for (const line of candidates) {
    for (const match of line.matchAll(URL_RE)) {
      const before = line.slice(0, match.index)
      if (/@[\p{L}\d.-]*$/u.test(before)) continue // e-postanın alan adı
      const value = stripProtocol(match[0])
      if (/linkedin\.com|github\.com|^asp\.net$/i.test(value)) continue
      if (email && fold(email).endsWith(fold(value))) continue
      result.website ??= value
    }
  }

  // Önce iletişim satırları ve tek başına konum satırları; deneyim satırlarındaki
  // "Şirket | Londra" parçaları ancak başlık bölgesindeyse (ilk 6 satır)
  const location =
    locationIn(lines.filter((l) => isContactLine(l) || /^(?:adres|address|konum|location)\s*[:：]/i.test(l))) ??
    lines.slice(0, 40).find((l) => looksLikeLocation(l))?.trim() ??
    locationIn(lines.slice(0, 6))
  if (location) result.location = location
  return result
}

// ---------------------------------------------------------------- Dil

const TR_WORDS = new Set(
  've ile için bir bu olarak da de çok daha en ama gibi olan veya ise sonra kadar üzerinde yönelik ekip proje projeler geliştirme geliştirdim yaptım sağladım görev aldım sorumlu deneyim eğitim üniversitesi lisans yüksek beceriler diller sertifikalar hakkımda özet günümüz halen şirketi müşteri kullanıcı yazılım tasarım sistem sistemleri yıllık yıl ay alanında'.split(
    ' ',
  ),
)
const EN_WORDS = new Set(
  'and the of to in for with on as at by from an is are was were my our this that using used team project projects developed built led managed improved designed created experience education university bachelor master skills languages certifications summary profile present years year responsible across over into within'.split(
    ' ',
  ),
)

export interface DetectedLanguage {
  language: CvLanguage
  /** 0-1; 0.6 altı "emin değil" sayılır */
  confidence: number
}

/** Türkçe harf oranı + sık sözcükler. Metin çok kısaysa güven düşük döner. */
export function detectLanguage(text: string): DetectedLanguage {
  const words = text.toLocaleLowerCase('tr').match(/[\p{L}']+/gu) ?? []
  if (words.length === 0) return { language: 'tr', confidence: 0 }
  let tr = 0
  let en = 0
  for (const w of words) {
    if (TR_WORDS.has(w)) tr++
    if (EN_WORDS.has(w)) en++
  }
  const letters = text.match(/\p{L}/gu)?.length ?? 1
  const trLetters = text.match(/[çğışöüÇĞİŞÖÜ]/g)?.length ?? 0
  // Türkçe metinde bu harfler harflerin ~%6-8'i; İngilizce metinde yalnız özel adlarda geçer.
  const ratio = trLetters / letters
  tr += Math.min(ratio / 0.06, 1.5) * words.length * 0.08
  en += Math.max(0, 1 - ratio / 0.01) * words.length * 0.04
  const total = tr + en
  if (total === 0) return { language: 'tr', confidence: 0 }
  const language: CvLanguage = tr >= en ? 'tr' : 'en'
  const margin = Math.abs(tr - en) / total
  // Az kanıt (kısa metin) güveni düşürür
  const evidence = Math.min(1, words.length / 40)
  return { language, confidence: Math.round((0.5 + margin / 2) * evidence * 100) / 100 }
}

// ---------------------------------------------------------------- Maskeleme

export type ContactPlaceholderKind = 'EMAIL' | 'PHONE' | 'LINKEDIN' | 'GITHUB' | 'WEBSITE' | 'LOCATION'

export interface MaskedText {
  text: string
  /** yer tutucu → asıl değer (ör. "⟦EMAIL⟧" → "ada@example.com") */
  map: Record<string, string>
}

/**
 * Sağlayıcıya gitmeden önce: bütün e-postalar, telefonlar, LinkedIn/GitHub
 * bağlantıları (referanslarınki dahil) ve kişisel web sitesi/konum yer
 * tutucuya döner. Aynı değer aynı yer tutucuyu alır; işlem kayıpsızdır.
 */
export function maskContacts(input: string, contacts: ExtractedContacts = {}): MaskedText {
  let text = joinWrappedUrls(input)
  const map: Record<string, string> = {}
  const byValue = new Map<string, string>()
  const counters: Partial<Record<ContactPlaceholderKind, number>> = {}
  const placeholder = (kind: ContactPlaceholderKind, value: string) => {
    const key = `${kind}:${value}`
    const existing = byValue.get(key)
    if (existing) return existing
    const n = (counters[kind] ?? 0) + 1
    counters[kind] = n
    const ph = n === 1 ? `⟦${kind}⟧` : `⟦${kind}_${n}⟧`
    byValue.set(key, ph)
    map[ph] = value
    return ph
  }
  // Ana değerler önce: kişinin kendi e-postası ⟦EMAIL⟧ olsun
  if (contacts.email) placeholder('EMAIL', contacts.email)
  if (contacts.phone) placeholder('PHONE', contacts.phone)

  text = text.replace(LINKEDIN_RE, (v) => placeholder('LINKEDIN', cleanUrl(v)) + v.slice(cleanUrl(v).length))
  text = text.replace(GITHUB_RE, (v) => placeholder('GITHUB', cleanUrl(v)) + v.slice(cleanUrl(v).length))
  text = text.replace(EMAIL_RE, (v) => placeholder('EMAIL', v))
  for (const phone of phonesIn(text)) text = text.split(phone).join(placeholder('PHONE', phone))
  for (const [kind, value] of [
    ['WEBSITE', contacts.website],
    ['LOCATION', contacts.location],
  ] as const) {
    if (!value || value.length < 4) continue
    const re = new RegExp(`(?:https?://)?(?:www\\.)?${escapeRe(value)}`, 'gi')
    if (re.test(text)) text = text.replace(re, (v) => placeholder(kind, v))
  }
  return { text, map }
}

/**
 * Yerelde tahmin edilen ad (PDF'teki en büyük satır ya da kurallı ayrıştırıcının
 * bulduğu ad) metnin her yerinde ⟦NAME⟧ ile maskelenir; Türkçe büyük/küçük harf
 * farkına dayanıklıdır ("Ayşe Yılmaz" = "AYŞE YILMAZ"). Her yazım ayrı yer
 * tutucu alır (⟦NAME_2⟧), geri koyma kayıpsızdır.
 */
export function maskName(masked: MaskedText, name: string | null | undefined): MaskedText {
  if (!name?.trim()) return masked
  const masker = createMasker(buildContactMasks({ fullName: name }))
  const text = masker.mask(masked.text)
  return { text, map: { ...masked.map, ...masker.map() } }
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PLACEHOLDER_RE = /⟦[A-Z]+(?:_\d+)?⟧/g

export function unmaskText(text: string, map: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (ph) => map[ph] ?? '')
}

/** Sağlayıcı yanıtındaki bütün metinlerde yer tutucuları yerelde asıl değerlere çevirir. */
export function unmaskImportResult(result: ImportResult, map: Record<string, string>): ImportResult {
  const un = (v: string | undefined) => (v == null ? v : unmaskText(v, map).trim())
  const personal = Object.fromEntries(
    Object.entries(result.personal).map(([k, v]) => [k, un(v as string | undefined)]),
  ) as ImportResult['personal']
  return {
    personal,
    sections: result.sections.map((section) => ({
      ...section,
      title: section.title == null ? section.title : un(section.title),
      items: section.items.map((item) => ({
        ...item,
        fields: Object.fromEntries(Object.entries(item.fields).map(([k, v]) => [k, un(v) ?? ''])),
        bullets: item.bullets?.map((b) => un(b) ?? ''),
      })),
    })),
  }
}

/**
 * Sağlayıcı yanıtını yerel bulgularla tamamlar: model bir iletişim alanını
 * kaçırdıysa metinden çıkarılanı koyar; ad yoksa PDF'teki en büyük yazılı
 * satırı (adayı) kullanır.
 */
export function completeImportResult(
  result: ImportResult,
  local: { contacts: ExtractedContacts; nameHint?: string | null },
): ImportResult {
  const personal = { ...result.personal }
  for (const key of ['email', 'phone', 'linkedin', 'github', 'website', 'location'] as const) {
    if (!personal[key]?.trim() && local.contacts[key]) personal[key] = local.contacts[key]
  }
  if (!personal.fullName?.trim() && local.nameHint) personal.fullName = local.nameHint
  return { ...result, personal }
}
