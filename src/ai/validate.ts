import type { z } from 'zod'
import {
  AiError,
  EditResultSchema,
  ImportResultSchema,
  TranslateResultSchema,
  type EditResult,
  type ImportResult,
  type TranslateResult,
} from './types'

/**
 * Sağlayıcı yanıtlarının doğrulanması. Model çıktısı güvenilmez veridir:
 * şemaya uymayan yanıt kullanıcıya gösterilmez, AiError('invalid_response')
 * fırlatılır. Metin olarak gelen JSON (ör. kod bloğu içinde) de kabul edilir.
 */
function parse<S extends z.ZodType>(schema: S, raw: unknown, what: string): z.infer<S> {
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
  const result = schema.safeParse(value)
  if (!result.success) throw new AiError(`${what}: yanıt şemaya uymuyor`, 'invalid_response')
  return result.data
}

export const parseEditResult = (raw: unknown): EditResult => parse(EditResultSchema, raw, 'edit')
export const parseTranslateResult = (raw: unknown): TranslateResult => parse(TranslateResultSchema, raw, 'translate')
export const parseImportResult = (raw: unknown): ImportResult => parse(ImportResultSchema, raw, 'import')
