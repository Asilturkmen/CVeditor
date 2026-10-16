import type { z } from 'zod'
import {
  AiError,
  EditResultSchema,
  ImportResultSchema,
  KeywordMatchResultSchema,
  ReviewResultSchema,
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

export const parseEditResult = (raw: unknown): EditResult => parse(EditResultSchema, raw, 'edit')
export const parseTranslateResult = (raw: unknown): TranslateResult => parse(TranslateResultSchema, raw, 'translate')
export const parseImportResult = (raw: unknown): ImportResult => parse(ImportResultSchema, raw, 'import')
export const parseReviewResult = (raw: unknown): ReviewResult => parse(ReviewResultSchema, raw, 'review', prepareReview)
export const parseKeywordMatchResult = (raw: unknown): KeywordMatchResult => parse(KeywordMatchResultSchema, raw, 'keywords', prepareKeywords)

// Sınırı biraz aşan gerçek model çıktısı bütünüyle reddedilmesin: katı doğrulamadan önce
// fazla yorum/terim kesilir, uzun yorum kısaltılır, sınırdan uzun terim atılır (yarım terim
// anlamsızdır). Biçim (tür, alan adları) yine katı denetlenir.
const MAX_COMMENTS = 20
const MAX_MESSAGE = 600
const MAX_TERMS = 60
const MAX_TERM = 80

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function shorten(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function prepareReview(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.comments)) return value
  const comments = value.comments.slice(0, MAX_COMMENTS).map((c: unknown) =>
    isRecord(c) && typeof c.message === 'string' ? { ...c, message: shorten(c.message, MAX_MESSAGE) } : c,
  )
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
