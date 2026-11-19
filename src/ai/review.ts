import type { Cv, CvLanguage } from '@/cv/schema'
import { htmlToText } from '@/review/text'
import type { KeywordMatch } from '@/review/keywords'
import { detectLanguage } from './importText'
import { strictRestorer } from './mask'
import { buildEditPayload } from './payload'
import { maskPdfText } from './pdfMask'
import type { PdfText } from './pdfText'
import type { KeywordMatchRequest, KeywordMatchResult, ReviewComment, ReviewRequest, ReviewResult } from './types'

/**
 * CV İnceleme sayfasının yapay zekâ istekleri (yorum ve anlamsal ilan
 * eşleşmesi). Gizlilik kuralları düzenlemeyle aynıdır:
 * - kendi CV'n: payload.ts'in "Tüm CV" kapsamı, istem boş → ad ve iletişim
 *   alanları (referanslarınki dahil) hiç gitmez, metinde geçenler maskeli;
 * - yüklenen PDF: içe aktarmayla AYNI işlev (pdfMask.ts `maskPdfText`): bütün
 *   e-posta/telefon/bağlantılar, tahmin edilen ad, konum, referans adları ve
 *   deseni olan kişisel bilgiler ⟦…⟧ ile maskeli. Ad tahmini en iyi çabadır:
 *   güvenle bulunamazsa `nameFound: false` döner, arayüz göndermeden önce uyarır.
 * Yanıttaki yer tutucular yalnız tarayıcıda geri konur; tanınmayan ya da
 * bozulmuş yer tutucusu olan (uydurma, "⟦İSİM⟧", "[EMAIL]") yorum/terim atılır.
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
  /** Sıkı geri koyma: tanınmayan/bozulmuş yer tutucuda null */
  restore: (text: string) => string | null
  /** Gönderilen bölüm/kayıt kimlikleri (yorum hedefi doğrulaması) */
  ids: { sections: Set<string>; items: Map<string, string> }
  /** Kişinin adı bulundu mu (PDF'te tahmin; bulunamadıysa ad maskelenmemiş olabilir) */
  nameFound: boolean
}

/** Kaynakta kişinin adı güvenle bulunabildi mi? Kendi CV'nde hep evet (ad alanından); PDF'te tahmine bağlı. */
export function reviewNameFound(input: ReviewSource): boolean {
  return input.kind === 'cv' || maskPdfText(input.pdf, input.language).nameFound
}

function maskSource(input: ReviewSource): MaskedSource {
  if (input.kind === 'cv') {
    const { payload, restore } = buildEditPayload(input.cv, { kind: 'all' }, '')
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
      restore,
      ids: { sections: new Set(payload.sections.map((s) => s.id)), items },
      nameFound: true,
    }
  }
  const { pdf, language } = input
  const masked = maskPdfText(pdf, language)
  return {
    source: { kind: 'text', text: masked.text },
    text: masked.text,
    cvLanguage: language,
    placeholders: Object.keys(masked.map),
    restore: strictRestorer(masked.map),
    ids: { sections: new Set(), items: new Map() },
    nameFound: masked.nameFound,
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
      const message = masked.restore(comment.message)
      // Tanınmayan ya da bozulmuş yer tutucu varsa yorum gösterilmez.
      if (message === null) return []
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
      const text = masked.restore(term)?.trim()
      const key = text?.toLocaleLowerCase(rule.language) ?? ''
      if (!text || seen.has(key)) return null
      seen.add(key)
      return text
    }
    const matched = result.matched.map(keep).filter((t): t is string => t !== null)
    const related = result.related.flatMap((r) => {
      const term = keep(r.term)
      const cvTerm = masked.restore(r.cvTerm)?.trim()
      return term && cvTerm ? [{ term, cvTerm }] : []
    })
    const missing = result.missing.map(keep).filter((t): t is string => t !== null)
    return { matched, missing, related }
  }
  return { request, finish, nameFound: masked.nameFound }
}
