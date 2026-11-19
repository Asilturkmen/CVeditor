import type { CvLanguage } from '@/cv/schema'
import {
  bounded,
  buildContactMasks,
  createMasker,
  EMAIL_RE,
  hasUnknownPlaceholder,
  loosePattern,
  phonesIn,
  PLACEHOLDER_RE,
  type ReferenceMaskSource,
} from './mask'
import { CITIES, COUNTRIES, fold } from './places'
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

export { fold }
export { EMAIL_RE, phonesIn }

// ---------------------------------------------------------------- Kalıplar

const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[\p{L}\d%_.-]+\/?/giu
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+(?:\/[\w.-]+)?\/?/gi
const URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+(?:com|net|org|dev|io|me|app|co|tr|info|xyz|site|tech|design|page|blog|art|studio|online|eu|de|uk)(?:\.[a-z]{2})?(?:\/[^\s,;|)⟧]*)?/gi

/** Satır sonunda bölünmüş bağlantıları birleştirir: "linkedin.com/in/ada-" + "yilmaz". */
export function joinWrappedUrls(text: string): string {
  return text.replace(/((?:linkedin|github)\.com\/\S*[-/_])\n(?=[\w-]+(?:\n|$))/gi, '$1')
}

const cleanUrl = (value: string) => value.replace(/[.,;:)]+$/, '').replace(/\/$/, '')
const stripProtocol = (value: string) => cleanUrl(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '')

// ---------------------------------------------------------------- Konum

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

export type ContactPlaceholderKind = 'EMAIL' | 'PHONE' | 'LINKEDIN' | 'GITHUB' | 'WEBSITE' | 'LOCATION' | 'RAW'

export interface MaskedText {
  text: string
  /** yer tutucu → asıl değer (ör. "⟦EMAIL⟧" → "ada@example.com") */
  map: Record<string, string>
}

/** PDF metninde zaten duran ⟦…⟧ ya da tek ayraç (gerçek yer tutucularla karışmasın diye kaçışlanır) */
const LITERAL_RE = /⟦[^⟦⟧\n]{0,40}⟧|[⟦⟧]/g

/**
 * Sağlayıcıya gitmeden önce ilk adım: bütün e-postalar, telefonlar,
 * LinkedIn/GitHub bağlantıları (referanslarınki dahil) ve kişisel web
 * sitesi/konum yer tutucuya döner. Aynı değer aynı yer tutucuyu alır; işlem
 * kayıpsızdır. Web sitesi ve konum sözcük sınırıyla aranır ("Rize" konumu
 * "summarize" içinde eşleşmez). İkinci adım `maskPersonal`'dır; ikisini
 * birlikte `maskPdfText` (pdfMask.ts) çağırır.
 */
export function maskContacts(input: string, contacts: ExtractedContacts = {}): MaskedText {
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
  /** Yalnız yer tutucuların dışında kalan metinde değiştirir. */
  const outside = (text: string, fn: (part: string) => string) =>
    text
      .split(/(⟦[A-Z]+(?:_\d+)?⟧)/)
      .map((part, i) => (i % 2 === 1 ? part : fn(part)))
      .join('')

  let text = joinWrappedUrls(input).replace(LITERAL_RE, (token) => placeholder('RAW', token))
  // Ana değerler önce: kişinin kendi e-postası ⟦EMAIL⟧ olsun
  if (contacts.email) placeholder('EMAIL', contacts.email)
  if (contacts.phone) placeholder('PHONE', contacts.phone)

  text = outside(text, (part) => part.replace(LINKEDIN_RE, (v) => placeholder('LINKEDIN', cleanUrl(v)) + v.slice(cleanUrl(v).length)))
  text = outside(text, (part) => part.replace(GITHUB_RE, (v) => placeholder('GITHUB', cleanUrl(v)) + v.slice(cleanUrl(v).length)))
  text = outside(text, (part) => part.replace(EMAIL_RE, (v) => placeholder('EMAIL', v)))
  for (const phone of phonesIn(text)) text = outside(text, (part) => part.split(phone).join(placeholder('PHONE', phone)))
  if (contacts.website && contacts.website.length >= 4) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}@._-])(?:https?://)?(?:www\\.)?${escapeRe(contacts.website)}(?![\\p{L}\\p{N}_-])`, 'giu')
    text = outside(text, (part) => part.replace(re, (v) => placeholder('WEBSITE', v)))
  }
  if (contacts.location && contacts.location.length >= 4) {
    // Kısa tek sözcüklü yer adı ("Rize", "Ordu") yalnız büyük harfle başlıyorsa: sıradan sözcük maskelenmez.
    const short = !/\s/.test(contacts.location) && contacts.location.replace(/[^\p{L}]/gu, '').length <= 4
    const re = new RegExp(bounded(loosePattern(contacts.location, { ascii: true })), 'giu')
    text = outside(text, (part) => part.replace(re, (v) => (short && !/^\p{Lu}/u.test(v) ? v : placeholder('LOCATION', v))))
  }
  return { text, map }
}

/**
 * Yerelde tahmin edilen ad metnin her yerinde ⟦NAME⟧ ile maskelenir; Türkçe
 * büyük/küçük harf farkına dayanıklıdır ("Ayşe Yılmaz" = "AYŞE YILMAZ"). Her
 * yazım ayrı yer tutucu alır (⟦NAME_2⟧), geri koyma kayıpsızdır.
 */
export function maskName(masked: MaskedText, name: string | null | undefined): MaskedText {
  return maskPersonal(masked, { name })
}

/**
 * `maskContacts`'tan sonra ikinci adım: ad (ve zayıf ad adayları), konum ve
 * referans kişilerin adı düzenlemedeki kurallarla (mask.ts) maskelenir: ad
 * parçaları ve bağlantıdaki bitişik ad, konumun parçaları ("İstanbul
 * ofisinde"), Türkçe büyük/küçük ve aksansız yazım. Ayrıca genel desenler
 * (kimlik no, doğum tarihi, sokak adresi, kullanıcı adı, "[at]" e-postası)
 * burada uygulanır; ad bulunamasa da çalışır. Önceki adımın yer tutucuları
 * korunur, çakışmaz.
 */
export function maskPersonal(
  masked: MaskedText,
  source: { name?: string | null; extraNames?: string[]; location?: string; references?: ReferenceMaskSource[] },
): MaskedText {
  const masks = buildContactMasks({
    fullName: source.name ?? '',
    extraNames: source.extraNames,
    location: source.location,
    references: source.references,
  })
  const masker = createMasker(masks, { reserved: Object.keys(masked.map) })
  const text = masker.mask(masked.text)
  return { text, map: { ...masked.map, ...masker.map() } }
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** İçe aktarma: bilinen yer tutucular geri konur; bilinmeyen (uydurma) yer tutucu silinir. */
export function unmaskText(text: string, map: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (ph) => map[ph] ?? '')
}

/** Bilinen yer tutucuları geri koyar; bilinmeyen olduğu gibi kalır (çağıran önce `hasUnknownPlaceholder` ile denetler). */
export function restoreText(text: string, map: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (ph) => map[ph] ?? ph)
}

export interface UnmaskedImport {
  result: ImportResult
  /** Tanınmayan ya da bozulmuş yer tutucu içerdiği için boş bırakılan değer sayısı */
  dropped: number
}

/**
 * Sağlayıcı yanıtındaki bütün metinlerde yer tutucuları yerelde asıl
 * değerlere çevirir. Tanınmayan ya da bozulmuş yer tutucu ("⟦İSİM⟧",
 * "[EMAIL]", "⟦EMAIL", gönderilmemiş ⟦PHONE_9⟧) içeren değer CV'ye yazılmaz:
 * alan boş kalır, madde atılır ve `dropped` sayılır.
 */
export function unmaskImport(result: ImportResult, map: Record<string, string>): UnmaskedImport {
  const known = new Set(Object.keys(map))
  let dropped = 0
  const un = (v: string) => {
    if (hasUnknownPlaceholder(v, known)) {
      dropped++
      return ''
    }
    return restoreText(v, map).trim()
  }
  const opt = (v: string | undefined) => (v == null ? v : un(v))
  const personal = Object.fromEntries(
    Object.entries(result.personal).map(([k, v]) => [k, opt(v as string | undefined)]),
  ) as ImportResult['personal']
  const sections = result.sections.map((section) => ({
    ...section,
    title: section.title == null ? section.title : un(section.title),
    items: section.items.map((item) => ({
      ...item,
      fields: Object.fromEntries(Object.entries(item.fields).map(([k, v]) => [k, un(v)])),
      bullets: item.bullets?.map(un).filter(Boolean),
    })),
  }))
  return { result: { personal, sections }, dropped }
}

/** `unmaskImport`'un yalnız sonucu. */
export function unmaskImportResult(result: ImportResult, map: Record<string, string>): ImportResult {
  return unmaskImport(result, map).result
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
