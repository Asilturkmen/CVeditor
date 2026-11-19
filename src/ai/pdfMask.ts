import type { CvLanguage } from '@/cv/schema'
import { hasNonNameWord, heuristicImport, isDocumentTitle, looksLikeName, referenceNames, stripDocumentTitle, stripNameTitle } from './importHeuristics'
import { extractContacts, maskContacts, maskPersonal, type ExtractedContacts } from './importText'
import { fold } from './places'
import type { PdfText, PdfTextLine } from './pdfText'

/**
 * Yüklenen PDF'in metnini sağlayıcıya gitmeden önce maskeleyen TEK işlev.
 * CV İnceleme (review.ts) ve içe aktarma (features/import/runImport.ts) aynı
 * `maskPdfText`'i çağırır; iki yol aynı korumaları uygular:
 * - bütün e-posta, telefon, LinkedIn/GitHub bağlantıları, kişisel site, konum;
 * - tahmin edilen ad (ve zayıf ad adayları), konumun parçaları, "Referanslar"
 *   bölümündeki kişi adları;
 * - genel desenler: kimlik no, doğum tarihi, sokak adresi, kullanıcı adı…
 *
 * Ad tahmini en iyi çabadır ve bilerek temkinlidir: belge başlığı
 * ("CURRICULUM VITAE", "ÖZGEÇMİŞ"), bölüm başlığı, unvan ya da kurum adı ad
 * sayılmaz. Emin olunamayan aday yine maskelenir (fazladan maske zararsızdır)
 * ama `nameFound: false` döner: arayüz göndermeden önce uyarır. Yanlış bir
 * adı "bulundu" saymak, bulunamadı demekten kötüdür (gerçek ad açık gider ve
 * uyarı çıkmaz).
 */

export interface NameGuess {
  /** En iyi aday (emin olunmasa da); yoksa null */
  name: string | null
  /** Ad güvenle bulundu mu (etiket, belirgin büyük yazı, ilk satırlar ya da e-posta/LinkedIn ile doğrulama) */
  confident: boolean
  /** Maskelenecek bütün adaylar (en iyi aday dahil) */
  candidates: string[]
}

const NAME_LABEL =
  /^(?:ad[ıi]?\s*(?:ve\s*|[-/&]\s*)?soyad[ıi]?|ad\s*soyad|isim(?:\s*soyisim)?|ad[ıi]?|full\s*name|name(?:\s*(?:and|&|\/)?\s*surname)?)\s*[:：]\s*(.+)$/iu

/** Satır ad olabilir mi? Belge başlığı sözcükleri ve unvan ("Dr.") atılır; unvan, kurum, okul, yer adı ad değildir. */
export function strictName(text: string): string | null {
  const stripped = stripNameTitle(stripDocumentTitle(text)).trim()
  return stripped && looksLikeName(stripped) && !hasNonNameWord(stripped) ? stripped : null
}

/** E-posta, LinkedIn, GitHub ve site adresindeki kullanıcı adları (katlanmış, yalnız harf) */
function handlesOf(contacts: ExtractedContacts): string[] {
  const letters = (value: string) => fold(value).replace(/[^a-z]/g, '')
  const out: string[] = []
  if (contacts.email) out.push(letters(contacts.email.split('@')[0]))
  if (contacts.linkedin) out.push(letters(contacts.linkedin.replace(/^.*linkedin\.com\/(?:in|pub)\//i, '')))
  if (contacts.github) out.push(letters(contacts.github.replace(/^.*github\.com\//i, '').split('/')[0]))
  if (contacts.website) out.push(letters(contacts.website.split('/')[0].replace(/\.[a-z.]{2,8}$/i, '')))
  return out.filter((h) => h.length >= 4)
}

/** Ad, e-posta ya da profil adresindeki kullanıcı adıyla örtüşüyor mu ("Ayşe Yılmaz" ↔ "ayse.yilmaz@…", "ayilmaz")? */
export function nameMatchesHandle(name: string, contacts: ExtractedContacts): boolean {
  const parts = name
    .split(/\s+/)
    .map((p) => fold(p).replace(/[^a-z]/g, ''))
    .filter(Boolean)
  if (parts.length < 2) return false
  const last = parts[parts.length - 1]
  return handlesOf(contacts).some((handle) => {
    const hits = parts.filter((p) => p.length >= 4 && handle.includes(p)).length
    // İki parça, ya da soyad + adın baş harfi ("ayilmaz"), ya da tek uzun parça (≥ 5 harf)
    if (hits >= 2) return true
    if (last.length >= 4 && (handle === parts[0][0] + last || handle === last + parts[0][0])) return true
    return parts.some((p) => p.length >= 5 && handle.includes(p))
  })
}

/** İlk sayfada gövde yazısından belirgin biçimde büyük satırlar, büyükten küçüğe. */
function prominentLines(lines: PdfTextLine[]): string[] {
  const first = lines.filter((l) => l.page === 1 && l.size)
  if (first.length < 2) return []
  // Gövde boyutu: en çok karakter taşıyan yazı boyutu
  const weight = new Map<number, number>()
  for (const l of first) weight.set(l.size!, (weight.get(l.size!) ?? 0) + l.text.length)
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return first
    .filter((l) => l.size! >= body * 1.25)
    .sort((a, b) => b.size! - a.size!)
    .map((l) => l.text)
}

/**
 * PDF'te kişinin adı. Sırayla: "Ad Soyad:" etiketi; ilk sayfanın belirgin
 * büyük satırları; ilk satırlar; kurallı ayrıştırıcının bulduğu ad. Son
 * ikisi yalnız ilk dört içerik satırındaysa ya da e-posta/LinkedIn kullanıcı
 * adıyla doğrulanıyorsa "emin" sayılır.
 */
export function guessPdfName(pdf: Pick<PdfText, 'lines' | 'text'>, contacts: ExtractedContacts, maskedText: string, language: CvLanguage): NameGuess {
  const candidates: string[] = []
  let best: string | null = null
  let confident = false
  const consider = (text: string | null | undefined, sure: boolean) => {
    const name = text ? strictName(text) : null
    if (!name) return
    if (!candidates.some((c) => fold(c) === fold(name))) candidates.push(name)
    const validated = sure || nameMatchesHandle(name, contacts)
    if (!best || (validated && !confident)) best = name
    if (validated) confident = true
  }

  const content = pdf.text
    .split('\n')
    .map((l) => l.replace(/^[•\s]+/, '').trim())
    .filter((l) => l && !isDocumentTitle(l))
  for (const line of content.slice(0, 40)) {
    const labeled = NAME_LABEL.exec(line)
    if (labeled) consider(labeled[1].split(/\s{3,}|\s+[|·•]\s+/)[0], true)
  }
  for (const line of prominentLines(pdf.lines).slice(0, 4)) consider(line, true)
  content.slice(0, 8).forEach((line, i) => {
    // "Ayşe Yılmaz   Frontend Geliştirici" ya da "Ayşe Yılmaz | İzmir": satırın ilk parçası
    consider(line.split(/\s{3,}|\s+[|·•]\s+/)[0], i < 4)
  })
  const parsed = heuristicImport({ text: maskedText, language }).personal.fullName
  if (parsed && !/⟦/.test(parsed)) consider(parsed, false)
  return { name: best, confident, candidates }
}

export interface PdfMasking {
  /** Sağlayıcıya gidecek maskeli metin */
  text: string
  /** Metinde geçen yer tutucu → asıl değer */
  map: Record<string, string>
  /** Metinden yerelde çıkarılan iletişim bilgileri (maskesiz; hiçbir yere gitmez) */
  contacts: ExtractedContacts
  /** En iyi ad adayı (emin olunmasa da) */
  name: string | null
  /** false: ad güvenle bulunamadı; metinde geçiyorsa maskelenmeden gidebilir (arayüz uyarır) */
  nameFound: boolean
}

const cache = new WeakMap<object, Map<CvLanguage, PdfMasking>>()

/** PDF metnini maskeler (aynı PDF ve dil için sonuç saklanır: "Ne gönderilir?" ile gönderim aynı veriyi kullanır). */
export function maskPdfText(pdf: Pick<PdfText, 'lines' | 'text'>, language: CvLanguage): PdfMasking {
  const cached = cache.get(pdf)?.get(language)
  if (cached) return cached
  const contacts = extractContacts(pdf.text)
  const contactMasked = maskContacts(pdf.text, contacts)
  const guess = guessPdfName(pdf, contacts, contactMasked.text, language)
  const references = referenceNames(contactMasked.text).map((name) => ({ name }))
  const masked = maskPersonal(contactMasked, {
    name: guess.name,
    extraNames: guess.candidates.filter((c) => c !== guess.name),
    location: contacts.location,
    references,
  })
  // Yalnız gönderilen metinde geçen yer tutucular geri konur (maskContacts ⟦EMAIL⟧'i metinde olmasa da ayırabilir).
  const map = Object.fromEntries(Object.entries(masked.map).filter(([p]) => masked.text.includes(p)))
  const result: PdfMasking = { text: masked.text, map, contacts, name: guess.name, nameFound: guess.confident }
  const byLanguage = cache.get(pdf) ?? new Map<CvLanguage, PdfMasking>()
  byLanguage.set(language, result)
  cache.set(pdf, byLanguage)
  return result
}
