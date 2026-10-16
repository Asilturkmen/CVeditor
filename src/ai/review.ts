import type { Cv, CvLanguage } from '@/cv/schema'
import { htmlToText } from '@/review/text'
import type { KeywordMatch } from '@/review/keywords'
import { heuristicImport, looksLikeName, referenceNames } from './importHeuristics'
import { detectLanguage, extractContacts, maskContacts, maskPersonal, restoreText, type MaskedText } from './importText'
import { hasPlaceholder } from './mask'
import { buildEditPayload } from './payload'
import { largestLine, type PdfText } from './pdfText'
import type { KeywordMatchRequest, KeywordMatchResult, ReviewComment, ReviewRequest, ReviewResult } from './types'

/**
 * CV İnceleme sayfasının yapay zekâ istekleri (yorum ve anlamsal ilan
 * eşleşmesi). Gizlilik kuralları düzenlemeyle aynıdır:
 * - kendi CV'n: payload.ts'in "Tüm CV" kapsamı, istem boş → ad ve iletişim
 *   alanları (referanslarınki dahil) hiç gitmez, metinde geçenler maskeli;
 * - yüklenen PDF: içe aktarmadaki gibi bütün e-posta/telefon/LinkedIn/GitHub
 *   bağlantıları; ayrıca tahmin edilen ad, PDF'in başındaki konum (parçalarıyla,
 *   metnin her yerinde) ve "Referanslar" bölümündeki kişi adları düzenlemedeki
 *   kurallarla (mask.ts) ⟦…⟧ yer tutucusuyla maskeli. Ad tahmini en iyi çabadır:
 *   bulunamazsa `nameFound: false` döner, arayüz göndermeden önce uyarır.
 * Yanıttaki yer tutucular yalnız tarayıcıda geri konur; geri konamayan
 * (uydurma) yer tutucusu kalan yorum/terim atılır.
 */

export type ReviewSource = { kind: 'cv'; cv: Cv } | { kind: 'pdf'; pdf: PdfText; language: CvLanguage }

/** İncelenen kaynak: kendi CV'n ya da okunmuş PDF (dili metinden, emin değilse `fallback`). */
export function reviewSource(cv: Cv | null, pdf: PdfText | null, fallback: CvLanguage): ReviewSource | null {
  if (cv) return { kind: 'cv', cv }
  if (!pdf) return null
  const detected = detectLanguage(pdf.text)
  return { kind: 'pdf', pdf, language: detected.confidence >= 0.6 ? detected.language : fallback }
}

interface MaskedSource {
  source: ReviewRequest['source']
  /** Kaynağın düz metni (maskeli); anahtar kelime eşleşmesi için */
  text: string
  cvLanguage: CvLanguage
  placeholders: string[]
  unmask: (text: string) => string
  /** Gönderilen bölüm/kayıt kimlikleri (yorum hedefi doğrulaması) */
  ids: { sections: Set<string>; items: Map<string, string> }
  /** Kişinin adı bulundu mu (PDF'te tahmin; bulunamadıysa ad maskelenmemiş olabilir) */
  nameFound: boolean
}

interface PdfMasking {
  contactMasked: MaskedText
  contacts: ReturnType<typeof extractContacts>
  name: string | null
}

/** PDF'te kişinin adı: en büyük yazılı satır, yoksa kurallı ayrıştırıcının bulduğu (yer tutucu değilse). */
function pdfMasking(pdf: PdfText, language: CvLanguage): PdfMasking {
  const contacts = extractContacts(pdf.text)
  const largest = largestLine(pdf.lines)
  const nameHint = largest && looksLikeName(largest) ? largest : null
  const contactMasked = maskContacts(pdf.text, contacts)
  const guess = nameHint ?? heuristicImport({ text: contactMasked.text, language }).personal.fullName
  const name = guess?.trim() && !/⟦/.test(guess) ? guess.trim() : null
  return { contactMasked, contacts, name }
}

/** Kaynakta kişinin adı bulunabildi mi? Kendi CV'nde hep evet (ad alanından); PDF'te tahmine bağlı. */
export function reviewNameFound(input: ReviewSource): boolean {
  return input.kind === 'cv' || pdfMasking(input.pdf, input.language).name !== null
}

function maskSource(input: ReviewSource): MaskedSource {
  if (input.kind === 'cv') {
    const { payload, unmask } = buildEditPayload(input.cv, { kind: 'all' }, '')
    const items = new Map<string, string>()
    const lines: string[] = []
    if (payload.personal.headline) lines.push(payload.personal.headline)
    for (const section of payload.sections) {
      lines.push('', section.title)
      for (const item of section.items) {
        items.set(item.id, section.id)
        for (const [key, value] of Object.entries(item)) {
          if (key === 'id' || key === 'start' || key === 'end' || key === 'date' || typeof value !== 'string') continue
          const text = htmlToText(value)
          if (text) lines.push(text)
        }
      }
    }
    return {
      source: { kind: 'cv', personal: payload.personal, sections: payload.sections },
      text: lines.join('\n').trim(),
      cvLanguage: input.cv.language,
      placeholders: payload.placeholders,
      unmask,
      ids: { sections: new Set(payload.sections.map((s) => s.id)), items },
      nameFound: true,
    }
  }
  const { pdf, language } = input
  const { contactMasked, contacts, name } = pdfMasking(pdf, language)
  const references = referenceNames(contactMasked.text).map((n) => ({ name: n }))
  const masked = maskPersonal(contactMasked, { name, location: contacts.location, references })
  // Yalnız gönderilen metinde geçen yer tutucular geri konur (maskContacts ⟦EMAIL⟧'i metinde olmasa da ayırabilir).
  const sent = Object.fromEntries(Object.entries(masked.map).filter(([p]) => masked.text.includes(p)))
  return {
    source: { kind: 'text', text: masked.text },
    text: masked.text,
    cvLanguage: language,
    placeholders: Object.keys(sent),
    // Bilinmeyen yer tutucu olduğu gibi kalır: uydurma olan yorum/terim aşağıda atılır.
    unmask: (text) => restoreText(text, sent),
    ids: { sections: new Set(), items: new Map() },
    nameFound: name !== null,
  }
}

export interface PreparedReview {
  request: ReviewRequest
  /** false: PDF'te ad bulunamadı; metinde geçiyorsa maskelenmeden gider (arayüz uyarır) */
  nameFound: boolean
  /** Yanıtı doğrulanmış yorumlara çevirir: yer tutucular geri konur, bilinmeyen hedef atılır. */
  finish: (result: ReviewResult) => ReviewComment[]
}

export function buildReviewRequest(input: ReviewSource, jobAd: string, language: CvLanguage): PreparedReview {
  const masked = maskSource(input)
  const ad = jobAd.trim()
  const request: ReviewRequest = {
    language,
    cvLanguage: masked.cvLanguage,
    source: masked.source,
    ...(ad ? { jobAd: ad } : {}),
    placeholders: masked.placeholders,
  }
  const finish = (result: ReviewResult): ReviewComment[] =>
    result.comments.flatMap((comment) => {
      const message = masked.unmask(comment.message)
      // Geri konamayan (uydurma) yer tutucu kaldıysa yorum gösterilmez.
      if (hasPlaceholder(message)) return []
      return [{ kind: comment.kind, message, ...(validTarget(comment.target, masked.ids) ?? {}) }]
    })
  return { request, finish, nameFound: masked.nameFound }
}

function validTarget(target: ReviewComment['target'], ids: MaskedSource['ids']): Pick<ReviewComment, 'target'> | null {
  if (!target || !ids.sections.has(target.sectionId)) return null
  if (target.itemId && ids.items.get(target.itemId) !== target.sectionId) return { target: { sectionId: target.sectionId } }
  return { target }
}

export interface PreparedKeywordMatch {
  request: KeywordMatchRequest
  /** false: PDF'te ad bulunamadı (bkz. PreparedReview) */
  nameFound: boolean
  /** Yanıttaki yer tutucuları geri koyar; geri konamayan terim atılır. Tekrarlar birleşir. */
  finish: (result: KeywordMatchResult) => KeywordMatchResult
}

export function buildKeywordMatchRequest(input: ReviewSource, jobAd: string, rule: KeywordMatch): PreparedKeywordMatch {
  const masked = maskSource(input)
  const request: KeywordMatchRequest = {
    language: rule.language,
    jobAd: jobAd.trim(),
    cvText: masked.text,
    ruleKeywords: { present: rule.present.map((k) => k.term), missing: rule.missing.map((k) => k.term) },
    placeholders: masked.placeholders,
  }
  const finish = (result: KeywordMatchResult): KeywordMatchResult => {
    const seen = new Set<string>()
    const keep = (term: string) => {
      const text = masked.unmask(term).trim()
      const key = text.toLocaleLowerCase(rule.language)
      if (!text || hasPlaceholder(text) || seen.has(key)) return null
      seen.add(key)
      return text
    }
    const matched = result.matched.map(keep).filter((t): t is string => t !== null)
    const related = result.related.flatMap((r) => {
      const term = keep(r.term)
      const cvTerm = masked.unmask(r.cvTerm).trim()
      return term && cvTerm && !hasPlaceholder(cvTerm) ? [{ term, cvTerm }] : []
    })
    const missing = result.missing.map(keep).filter((t): t is string => t !== null)
    return { matched, missing, related }
  }
  return { request, finish, nameFound: masked.nameFound }
}
