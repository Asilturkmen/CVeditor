import type { z } from 'zod'
import {
  AI_LIMITS,
  AiError,
  EditPayloadSchema,
  EditResultSchema,
  ImportRequestSchema,
  ImportResultSchema,
  KeywordMatchRequestSchema,
  KeywordMatchResultSchema,
  ReviewRequestSchema,
  ReviewResultSchema,
  TranslateRequestSchema,
  TranslateResultSchema,
  type EditResult,
  type ImportResult,
  type KeywordMatchResult,
  type ReviewResult,
  type TranslateResult,
} from './types'

/**
 * Sağlayıcı yanıtlarının doğrulanması. Model çıktısı güvenilmez veridir:
 * şemaya uymayan yanıt kullanıcıya gösterilmez, AiError('invalid_response')
 * fırlatılır. Metin olarak gelen JSON (ör. kod bloğu içinde) de kabul edilir.
 *
 * Sınırı biraz aşan gerçek model çıktısı bütünüyle reddedilmesin diye katı
 * doğrulamadan önce listeler kırpılır (fazlası sayılır ya da atılır), sınırdan
 * uzun tekil değer atılır; biçim (tür, alan adları) yine katı denetlenir.
 */
function parse<S extends z.ZodType>(schema: S, raw: unknown, what: string, prepare: (value: unknown) => unknown = (v) => v): z.infer<S> {
  let value = raw
  if (typeof raw === 'string') {
    const text = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    try {
      value = JSON.parse(text)
    } catch {
      throw new AiError(`${what}: yanıt JSON değil`, 'invalid_response')
    }
  }
  const result = schema.safeParse(prepare(value))
  if (!result.success) throw new AiError(`${what}: yanıt şemaya uymuyor`, 'invalid_response')
  return result.data
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const fitsText = (v: unknown, max: number = AI_LIMITS.field) => typeof v !== 'string' || v.length <= max

// ---------------------------------------------------------------- Düzenleme

export interface ParsedEditResult extends EditResult {
  /** Sınırın (AI_LIMITS.operations) ötesinde kalıp gösterilemeyen işlem sayısı */
  overflow: number
}

export function parseEditResult(raw: unknown): ParsedEditResult {
  let overflow = 0
  const result = parse(EditResultSchema, raw, 'edit', (value) => {
    if (!isRecord(value) || !Array.isArray(value.operations)) return value
    overflow = Math.max(0, value.operations.length - AI_LIMITS.operations)
    return { ...value, operations: value.operations.slice(0, AI_LIMITS.operations) }
  })
  return { ...result, overflow }
}

// ---------------------------------------------------------------- Çeviri ve içe aktarma

/** Sınırdan uzun çeviri atılır (o alan kaynak metinle kalır ve işaretlenir); liste kırpılır. */
function prepareTranslate(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.items)) return value
  const items = value.items.filter((i: unknown) => !isRecord(i) || fitsText(i.text)).slice(0, AI_LIMITS.translateItems)
  return { ...value, items }
}

/** İçe aktarma: fazla bölüm/kayıt/madde kırpılır, sınırdan uzun değer atılır (kullanıcı önizlemede görür). */
function prepareImport(value: unknown): unknown {
  if (!isRecord(value)) return value
  const fields = (f: unknown) => (isRecord(f) ? Object.fromEntries(Object.entries(f).filter(([, v]) => fitsText(v))) : f)
  const item = (i: unknown) =>
    isRecord(i)
      ? {
          ...i,
          fields: fields(i.fields),
          ...(Array.isArray(i.bullets) ? { bullets: i.bullets.filter((b: unknown) => fitsText(b)).slice(0, AI_LIMITS.importBullets) } : {}),
        }
      : i
  const section = (s: unknown) =>
    isRecord(s) && Array.isArray(s.items) ? { ...s, items: s.items.slice(0, AI_LIMITS.importItems).map(item) } : s
  const personal = isRecord(value.personal) ? fields(value.personal) : value.personal
  const sections = Array.isArray(value.sections) ? value.sections.slice(0, AI_LIMITS.importSections).map(section) : value.sections
  return { ...value, personal, sections }
}

export const parseTranslateResult = (raw: unknown): TranslateResult => parse(TranslateResultSchema, raw, 'translate', prepareTranslate)
export const parseImportResult = (raw: unknown): ImportResult => parse(ImportResultSchema, raw, 'import', prepareImport)
export const parseReviewResult = (raw: unknown): ReviewResult => parse(ReviewResultSchema, raw, 'review', prepareReview)
export const parseKeywordMatchResult = (raw: unknown): KeywordMatchResult => parse(KeywordMatchResultSchema, raw, 'keywords', prepareKeywords)

// ---------------------------------------------------------------- İnceleme

const MAX_COMMENTS = 20
const MAX_MESSAGE = 600
const MAX_TERMS = 60
const MAX_TERM = 80

function shorten(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** "82/100", "8/10", "4.5/5", "10 üzerinden 8", "8 out of 10" */
const RATIO_SCORE =
  /(?<![\p{L}\p{N}.,/])\d{1,3}(?:[.,]\d)?\s*\/\s*(?:5|10|100)(?![\p{N}/])|(?<![\p{L}\p{N}])(?:\d{1,3}\s*(?:out\s+of|over)\s*(?:5|10|100)|(?:5|10|100)\s+üzerinden\s+\d{1,3})(?![\p{N}])/iu
/** Yüzde: "%87", "87%", "% 87" */
const PERCENT = /%\s?\d{1,3}|\d{1,3}(?:[.,]\d+)?\s?%/u
/** Puan bildiren sözcükler (yüzdeyle aynı cümlede): "ATS uyumu %87", "match: 87%" */
const SCORE_WORD = /(?<![\p{L}])(?:puan|skor|score|uyum|eşleş|eslesm|örtüş|match|overlap|uygunluk|benzerlik|similar|rating|compatib|ats|şans|chance|olasılık|probab)/iu
/** "Puan: 82", "Score 8", "Notum: 7" biçimi */
const LABELED_SCORE = /(?<![\p{L}])(?:puan(?:ı|in|ın)?|skor(?:u)?|score|rating|not(?:u|un))\s*[:：=]?\s*\d{1,3}(?![\p{N}])/iu

/**
 * Yorumdaki puan/yüzde kalıplarını (ürün kararı: puan, yüzde, not yok) cümle
 * cümle ayıklar. CV'nin kendi sayıları ("yükleme süresini %30 kısalttın")
 * puan sözcüğüyle birlikte geçmedikçe kalır. Geriye bir şey kalmazsa boş döner.
 */
export function stripScores(message: string): string {
  const sentences = message.split(/(?<=[.!?…])\s+/)
  return sentences
    .filter((s) => !RATIO_SCORE.test(s) && !LABELED_SCORE.test(s) && !(PERCENT.test(s) && SCORE_WORD.test(s)))
    .join(' ')
    .trim()
}

function prepareReview(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.comments)) return value
  const comments = value.comments
    .map((c: unknown) => (isRecord(c) && typeof c.message === 'string' ? { ...c, message: shorten(stripScores(c.message), MAX_MESSAGE) } : c))
    // Yalnız puandan oluşan yorum atılır
    .filter((c: unknown) => !isRecord(c) || typeof c.message !== 'string' || c.message.trim() !== '')
    .slice(0, MAX_COMMENTS)
  return { ...value, comments }
}

function prepareKeywords(value: unknown): unknown {
  if (!isRecord(value)) return value
  const fits = (t: unknown) => typeof t !== 'string' || t.trim().length <= MAX_TERM
  const terms = (list: unknown) => (Array.isArray(list) ? list.filter(fits).slice(0, MAX_TERMS) : list)
  const related = Array.isArray(value.related)
    ? value.related.filter((r: unknown) => !isRecord(r) || (fits(r.term) && fits(r.cvTerm))).slice(0, MAX_TERMS)
    : value.related
  return { ...value, matched: terms(value.matched), missing: terms(value.missing), related }
}

// ---------------------------------------------------------------- İstekler

const REQUEST_SCHEMAS = {
  edit: EditPayloadSchema,
  translate: TranslateRequestSchema,
  import: ImportRequestSchema,
  review: ReviewRequestSchema,
  keywords: KeywordMatchRequestSchema,
} as const

export type AiRequestKind = keyof typeof REQUEST_SCHEMAS

/**
 * İsteği göndermeden önce denetler (sunucu da aynı şemayla doğrular): boyut
 * sınırını aşan istek AiError('too_large'), biçim hatası AiError('bad_request').
 * İstek değiştirilmeden döner.
 */
export function checkRequest<T>(kind: AiRequestKind, request: T): T {
  const size = JSON.stringify(request).length
  if (size > AI_LIMITS.requestChars) throw new AiError(`${kind}: istek çok büyük (${size} karakter)`, 'too_large')
  const result = REQUEST_SCHEMAS[kind].safeParse(request)
  if (!result.success) {
    const tooBig = result.error.issues.some((issue) => issue.code === 'too_big')
    throw new AiError(`${kind}: istek sözleşmeye uymuyor`, tooBig ? 'too_large' : 'bad_request')
  }
  return request
}
