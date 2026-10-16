import { z } from 'zod'
import type { CvLanguage, Personal, SectionType } from '@/cv/schema'

/**
 * Yapay zekâ sözleşmesi. Arayüz yalnız bu tipleri bilir; hangi sağlayıcının
 * (örnek / gerçek) çalıştığını provider.ts seçer. Gerçek sağlayıcı bağlanınca
 * (V3) model çıktısı aşağıdaki Zod şemalarıyla doğrulanır; şemaya uymayan
 * yanıt kullanıcıya gösterilmez.
 *
 * Gizlilik: sağlayıcıya giden her şey payload.ts'te kurulur: yalnız seçili
 * kapsam, iletişim bilgileri gerekmedikçe yok, metin içindeki iletişim
 * bilgileri yer tutucuyla maskeli (yanıt gelince yerelde geri konur).
 */

export type AiScope =
  | { kind: 'all' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'item'; sectionId: string; itemId: string }

// ---------------------------------------------------------------- Düzenleme

/** Sağlayıcıya giden CV parçası: kimlikler korunur, iletişim maskeli. */
export interface EditPayload {
  language: CvLanguage
  prompt: string
  scope: AiScope
  personal: Partial<Pick<Personal, 'headline' | 'email' | 'phone' | 'location' | 'website' | 'linkedin' | 'github'>>
  sections: {
    id: string
    type: SectionType
    title: string
    items: ({ id: string } & Record<string, unknown>)[]
  }[]
  /** Metinlerde geçen maskeli değerlerin yer tutucuları (ör. ⟦EMAIL⟧); değerler gönderilmez. */
  placeholders: string[]
}

export const EditOperationSchema = z.discriminatedUnion('op', [
  /** Var olan bir alanı değiştir. target: kayıt id'si ya da 'personal' */
  z.object({ op: z.literal('set'), target: z.string(), field: z.string(), value: z.string(), reason: z.string().optional() }),
  /** Bölüme yeni kayıt ekle (afterItemId null → sona) */
  z.object({
    op: z.literal('add'),
    sectionId: z.string(),
    afterItemId: z.string().nullable(),
    fields: z.record(z.string(), z.string()),
    reason: z.string().optional(),
  }),
  /** Kaydı kaldır */
  z.object({ op: z.literal('remove'), sectionId: z.string(), itemId: z.string(), reason: z.string().optional() }),
])
export type EditOperation = z.infer<typeof EditOperationSchema>

export const EditResultSchema = z.object({
  operations: z.array(EditOperationSchema).max(40),
  /** Modelin kullanıcıya kısa açıklaması (isteğe bağlı) */
  message: z.string().optional(),
})
export type EditResult = z.infer<typeof EditResultSchema>

// ---------------------------------------------------------------- Çeviri

export interface TranslateRequest {
  from: CvLanguage
  to: CvLanguage
  /** key: arayüzün geri eşlemek için kullandığı anahtar (ör. `${itemId}:${field}`) */
  items: { key: string; text: string; rich: boolean }[]
}

export const TranslateResultSchema = z.object({
  items: z.array(z.object({ key: z.string(), text: z.string() })),
})
export type TranslateResult = z.infer<typeof TranslateResultSchema>

// ---------------------------------------------------------------- İçe aktarma

export interface ImportRequest {
  /** PDF'in metin katmanı (iletişim bilgileri maskeli olabilir) */
  text: string
  language: CvLanguage
}

/** Modelin PDF metninden çıkardığı kayıtlar; alanlar düz metin, açıklamalar madde dizisi. */
export const ImportResultSchema = z.object({
  personal: z
    .object({
      fullName: z.string().optional(),
      headline: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      website: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
    })
    .default({}),
  sections: z.array(
    z.object({
      type: z.enum([
        'summary',
        'experience',
        'education',
        'projects',
        'skills',
        'languages',
        'certificates',
        'awards',
        'volunteer',
        'references',
        'custom',
      ]),
      title: z.string().nullable().optional(),
      items: z.array(
        z.object({
          fields: z.record(z.string(), z.string()).default({}),
          /** "2024-02", "2024", "present" gibi */
          start: z.string().optional(),
          end: z.string().optional(),
          bullets: z.array(z.string()).optional(),
        }),
      ),
    }),
  ),
})
export type ImportResult = z.infer<typeof ImportResultSchema>

// ---------------------------------------------------------------- Sağlayıcı

export interface AiProvider {
  id: string
  /** Örnek sağlayıcı: arayüz "Örnek" rozeti ve açıklama gösterir */
  isDemo: boolean
  edit(payload: EditPayload, signal: AbortSignal): Promise<EditResult>
  translate(request: TranslateRequest, signal: AbortSignal): Promise<TranslateResult>
  parseImport(request: ImportRequest, signal: AbortSignal): Promise<ImportResult>
}

export type AiErrorCode = 'aborted' | 'invalid_response' | 'network' | 'rate_limited' | 'unknown'

export class AiError extends Error {
  readonly code: AiErrorCode
  constructor(message: string, code: AiErrorCode) {
    super(message)
    this.code = code
  }
}
