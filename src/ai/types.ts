import { z } from 'zod'
import type { CvLanguage, Personal, SectionType } from '@/cv/schema'

/**
 * Yapay zekâ sözleşmesi. Arayüz yalnız bu tipleri bilir; hangi sağlayıcının
 * (örnek / gerçek) çalıştığını provider.ts seçer. Sunucu ile istemci aynı
 * şemaları kullanır:
 * - İSTEK şemaları (`*RequestSchema`, `EditPayloadSchema`) boyut sınırlarını
 *   taşır; istemci sınırı aşan isteği göndermeden durdurur (provider.ts →
 *   `checkedProvider`), sunucu da aynı şemayla doğrular (400/413).
 * - YANIT şemaları model çıktısını doğrular; şemaya uymayan yanıt kullanıcıya
 *   gösterilmez. İsteğe bağlı alanlarda `null` da kabul edilir (modeller boş
 *   alanı çoğunlukla null yazar); sınırı aşan liste validate.ts'te kırpılır.
 *
 * Gizlilik: sağlayıcıya giden her şey tarayıcıda kurulur (payload.ts,
 * translate.ts, pdfMask.ts, review.ts): yalnız seçili kapsam, ad hiç yok,
 * iletişim bilgileri yalnız kullanıcı açıkça seçerse, metin içindeki kişisel
 * bilgiler ⟦…⟧ yer tutucusuyla maskeli (yanıt gelince yerelde geri konur).
 */

export type AiScope =
  | { kind: 'all' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'item'; sectionId: string; itemId: string }

// ---------------------------------------------------------------- Sınırlar

/**
 * İstek ve yanıt sınırları (karakter). Sunucu gövde sınırını `requestChars`'a
 * göre (UTF-8'de en çok ~4 katı bayt) ayarlamalı.
 */
export const AI_LIMITS = {
  /** Bir isteğin JSON gövdesi (karakter) */
  requestChars: 200_000,
  prompt: 2_000,
  /** Tek alan değeri (zengin metin dahil) */
  field: 20_000,
  /** İçe aktarılan / incelenen PDF metni */
  pdfText: 120_000,
  jobAd: 20_000,
  sections: 60,
  itemsPerSection: 200,
  translateItems: 1_000,
  placeholders: 1_000,
  /** Yanıtta gösterilebilecek en çok düzenleme işlemi; fazlası "N öneri gösterilemedi" olur */
  operations: 40,
  /** İçe aktarma yanıtı */
  importSections: 40,
  importItems: 150,
  importBullets: 60,
} as const

/** İsteğe bağlı alan: yok ya da null (modeller boş alanı çoğunlukla null yazar). */
const opt = <T extends z.ZodType>(schema: T) => schema.nullish()

const LanguageSchema = z.enum(['tr', 'en'])
const SectionTypeSchema = z.enum([
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
])
const IdSchema = z.string().min(1).max(100)
const PlaceholdersSchema = z.array(z.string().max(40)).max(AI_LIMITS.placeholders)

export const AiScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('section'), sectionId: IdSchema }),
  z.object({ kind: z.literal('item'), sectionId: IdSchema, itemId: IdSchema }),
])

// ---------------------------------------------------------------- Düzenleme

/**
 * Bölümün yapay zekânın yazabileceği metin alanları: `set` ve `add` yalnız
 * bu adları kullanır. `rich: true` → kısıtlı HTML (p, ul/li, strong, em, a);
 * `rich: false` → düz metin, etiketsiz ve tek satır.
 */
export interface PayloadField {
  key: string
  rich: boolean
}

/** Sağlayıcıya giden CV parçası: kimlikler korunur, kişisel bilgiler maskeli. */
export interface EditPayload {
  language: CvLanguage
  prompt: string
  scope: AiScope
  /**
   * Unvan yalnız "Tüm CV" kapsamında; iletişim alanları (e-posta, telefon,
   * konum, site, LinkedIn, GitHub) yalnız kullanıcı "İletişim bilgilerimi de
   * gönder"i seçtiyse (özgün değerleriyle).
   */
  personal: Partial<Pick<Personal, 'headline' | 'email' | 'phone' | 'location' | 'website' | 'linkedin' | 'github'>>
  sections: {
    id: string
    type: SectionType
    title: string
    /** Bu bölümde yazılabilecek alanlar ve biçimleri (zengin/düz) */
    fields: PayloadField[]
    /** Kayıtlar: id + alan değerleri (+ salt bağlam için start/end/date) */
    items: ({ id: string } & Record<string, unknown>)[]
  }[]
  /** Metinlerde geçen maskeli değerlerin yer tutucuları (ör. ⟦EMAIL⟧); değerler gönderilmez. */
  placeholders: string[]
}

const PayloadItemSchema = z.object({ id: IdSchema }).catchall(z.string().max(AI_LIMITS.field))
const PayloadSectionSchema = z.object({
  id: IdSchema,
  type: SectionTypeSchema,
  title: z.string().max(500),
  fields: z.array(z.object({ key: z.string().max(40), rich: z.boolean() })).max(20),
  items: z.array(PayloadItemSchema).max(AI_LIMITS.itemsPerSection),
})
const PayloadPersonalSchema = z
  .object({
    headline: z.string().max(500),
    email: z.string().max(500),
    phone: z.string().max(500),
    location: z.string().max(500),
    website: z.string().max(500),
    linkedin: z.string().max(500),
    github: z.string().max(500),
  })
  .partial()
  .strict()

export const EditPayloadSchema = z.object({
  language: LanguageSchema,
  prompt: z.string().trim().min(1).max(AI_LIMITS.prompt),
  scope: AiScopeSchema,
  personal: PayloadPersonalSchema,
  sections: z.array(PayloadSectionSchema).max(AI_LIMITS.sections),
  placeholders: PlaceholdersSchema,
})

export const EditOperationSchema = z.discriminatedUnion('op', [
  /** Var olan bir alanı değiştir. target: kayıt id'si ya da 'personal' */
  z.object({ op: z.literal('set'), target: z.string(), field: z.string(), value: z.string(), reason: opt(z.string()) }),
  /** Bölüme yeni kayıt ekle (afterItemId null ya da yok → sona). Alan adları payload'daki `fields`'ten. */
  z.object({
    op: z.literal('add'),
    sectionId: z.string(),
    afterItemId: z.string().nullish(),
    fields: z.record(z.string(), z.string().nullable()),
    reason: opt(z.string()),
  }),
  /** Kaydı kaldır */
  z.object({ op: z.literal('remove'), sectionId: z.string(), itemId: z.string(), reason: opt(z.string()) }),
])
export type EditOperation = z.infer<typeof EditOperationSchema>

/** İşlem sayısı sınırı (AI_LIMITS.operations) şemada değil validate.ts'te: fazlası atılır ve sayılır. */
export const EditResultSchema = z.object({
  operations: z.array(EditOperationSchema),
  /** Modelin kullanıcıya kısa açıklaması (isteğe bağlı; arayüz bildirim olarak gösterir) */
  message: opt(z.string()),
})
export type EditResult = z.infer<typeof EditResultSchema>

// ---------------------------------------------------------------- Çeviri

export interface TranslateRequest {
  from: CvLanguage
  to: CvLanguage
  /**
   * key: arayüzün geri eşlemek için kullandığı anahtar (ör. `${itemId}:${field}`).
   * rich: true → kısıtlı HTML (yapı korunur); false → düz metin döner.
   */
  items: { key: string; text: string; rich: boolean }[]
}

export const TranslateRequestSchema = z.object({
  from: LanguageSchema,
  to: LanguageSchema,
  items: z
    .array(z.object({ key: z.string().max(200), text: z.string().max(AI_LIMITS.field), rich: z.boolean() }))
    .max(AI_LIMITS.translateItems),
})

export const TranslateResultSchema = z.object({
  items: z.array(z.object({ key: z.string().max(200), text: z.string().max(AI_LIMITS.field) })).max(AI_LIMITS.translateItems),
})
export type TranslateResult = z.infer<typeof TranslateResultSchema>

// ---------------------------------------------------------------- İçe aktarma

export interface ImportRequest {
  /** PDF'in metin katmanı (ad ve kişisel bilgiler maskeli; pdfMask.ts) */
  text: string
  language: CvLanguage
}

export const ImportRequestSchema = z.object({
  text: z.string().trim().min(1).max(AI_LIMITS.pdfText),
  language: LanguageSchema,
})

const importText = z.string().max(AI_LIMITS.field)

/** Modelin PDF metninden çıkardığı kayıtlar; alanlar düz metin, açıklamalar madde dizisi. */
export const ImportResultSchema = z.object({
  personal: z
    .object({
      fullName: opt(importText),
      headline: opt(importText),
      email: opt(importText),
      phone: opt(importText),
      location: opt(importText),
      website: opt(importText),
      linkedin: opt(importText),
      github: opt(importText),
    })
    .nullish()
    .transform((v) => v ?? {}),
  sections: z
    .array(
      z.object({
        type: SectionTypeSchema,
        title: z.string().max(500).nullish(),
        items: z
          .array(
            z.object({
              fields: z
                .record(z.string(), importText.nullable())
                .nullish()
                .transform((v) => Object.fromEntries(Object.entries(v ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'))),
              /** "2024-02", "2024", "present" gibi */
              start: opt(z.string().max(40)),
              end: opt(z.string().max(40)),
              bullets: opt(z.array(importText).max(AI_LIMITS.importBullets)),
            }),
          )
          .max(AI_LIMITS.importItems),
      }),
    )
    .max(AI_LIMITS.importSections),
})
export type ImportResult = z.infer<typeof ImportResultSchema>

// ---------------------------------------------------------------- İnceleme yorumu

/**
 * CV İnceleme sayfasındaki yapay zekâ yorumu isteği. Kaynak ya kendi CV'n
 * (yapılandırılmış, payload.ts ile aynı kurallarla maskeli: ad yok, iletişim
 * yok) ya da yüklenen PDF'in metni (ad ve iletişim bilgileri maskeli).
 */
export interface ReviewRequest {
  /** Yorumların yazılacağı dil (arayüz dili) */
  language: CvLanguage
  /** CV'nin dili */
  cvLanguage: CvLanguage
  source:
    | { kind: 'cv'; personal: EditPayload['personal']; sections: EditPayload['sections'] }
    | { kind: 'text'; text: string }
  /** Yapıştırılan iş ilanı (isteğe bağlı) */
  jobAd?: string
  /** Metinlerde geçen yer tutucular (ör. ⟦EMAIL⟧); değerler gönderilmez. */
  placeholders: string[]
}

export const ReviewRequestSchema = z.object({
  language: LanguageSchema,
  cvLanguage: LanguageSchema,
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('cv'), personal: PayloadPersonalSchema, sections: z.array(PayloadSectionSchema).max(AI_LIMITS.sections) }),
    z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(AI_LIMITS.pdfText) }),
  ]),
  jobAd: z.string().max(AI_LIMITS.jobAd).optional(),
  placeholders: PlaceholdersSchema,
})

/**
 * Yorum türü: güçlü yan, geliştirilecek yer, ilana uygunluk. Puan, yüzde ya
 * da not yoktur; şemada olmayan alanlar (ör. "score") doğrulamada atılır.
 */
export const ReviewCommentKindSchema = z.enum(['strength', 'improve', 'job_fit'])
export type ReviewCommentKind = z.infer<typeof ReviewCommentKindSchema>

export const ReviewCommentSchema = z.object({
  kind: ReviewCommentKindSchema,
  message: z.string().trim().min(1).max(600),
  /** Yalnız kendi CV'nde: yorumun ilgili olduğu bölüm/kayıt (gönderilen kimliklerden) */
  target: z.object({ sectionId: z.string(), itemId: z.string().optional() }).optional(),
})
export type ReviewComment = z.infer<typeof ReviewCommentSchema>

export const ReviewResultSchema = z.object({
  comments: z.array(ReviewCommentSchema).max(20),
})
export type ReviewResult = z.infer<typeof ReviewResultSchema>

// ---------------------------------------------------------------- İlan ↔ CV anlamsal eşleşme

/**
 * İlan ile CV'nin anlamına göre karşılaştırılması. Kurala dayalı eşleşmenin
 * (review/keywords.ts) sonucu da gider; model onu genişletir (eş anlamlı,
 * kısaltma, üst/alt kavram). İlan metni olduğu gibi, CV metni maskeli gider.
 */
export interface KeywordMatchRequest {
  /** İlanın dili */
  language: CvLanguage
  jobAd: string
  /** CV'nin düz metni (ad ve iletişim bilgileri maskeli) */
  cvText: string
  /** Kurallı karşılaştırmanın bulduğu terimler */
  ruleKeywords: { present: string[]; missing: string[] }
  placeholders: string[]
}

export const KeywordMatchRequestSchema = z.object({
  language: LanguageSchema,
  jobAd: z.string().trim().min(1).max(AI_LIMITS.jobAd),
  cvText: z.string().max(AI_LIMITS.pdfText),
  ruleKeywords: z.object({ present: z.array(z.string().max(200)).max(500), missing: z.array(z.string().max(200)).max(500) }),
  placeholders: PlaceholdersSchema,
})

export const KeywordMatchResultSchema = z.object({
  /** İlandaki terim CV'de (aynı ya da çok yakın yazımla) geçiyor */
  matched: z.array(z.string().trim().min(1).max(80)).max(60),
  /** İlandaki terim CV'de hiç karşılık bulmuyor */
  missing: z.array(z.string().trim().min(1).max(80)).max(60),
  /** İlandaki terim CV'de başka bir adla geçiyor (ör. "takım çalışması" ↔ "ekip çalışması") */
  related: z
    .array(z.object({ term: z.string().trim().min(1).max(80), cvTerm: z.string().trim().min(1).max(80) }))
    .max(60),
})
export type KeywordMatchResult = z.infer<typeof KeywordMatchResultSchema>

// ---------------------------------------------------------------- Sağlayıcı

export interface AiProvider {
  id: string
  /** Örnek sağlayıcı: arayüz "Örnek" rozeti ve açıklama gösterir */
  isDemo: boolean
  /**
   * Uçlar parolayla korunuyor mu. true ise bir çağrı AiError('unauthorized')
   * ile dönebilir; arayüz sayfa içi parola penceresini açar, `authenticate`
   * başarılı olunca isteği bir kez yeniler.
   */
  requiresAuth: boolean
  /**
   * Parolayı sunucuya verir (karşılığında HttpOnly çerez gelir; parola
   * tarayıcıda saklanmaz). Yanlış parolada AiError('unauthorized').
   */
  authenticate?(password: string, signal: AbortSignal): Promise<void>
  edit(payload: EditPayload, signal: AbortSignal): Promise<EditResult>
  translate(request: TranslateRequest, signal: AbortSignal): Promise<TranslateResult>
  parseImport(request: ImportRequest, signal: AbortSignal): Promise<ImportResult>
  review(request: ReviewRequest, signal: AbortSignal): Promise<ReviewResult>
  matchKeywords(request: KeywordMatchRequest, signal: AbortSignal): Promise<KeywordMatchResult>
}

/**
 * Hata kodları; arayüz her birine ayrı ileti gösterir (features/ai/aiErrorMessage.ts).
 * - aborted: kullanıcı durdurdu (ileti gösterilmez)
 * - invalid_response: yanıt şemaya uymadı
 * - network: sunucuya ulaşılamadı
 * - timeout: yanıt süresinde gelmedi (httpProvider)
 * - rate_limited: kısa sürede çok istek (HTTP 429; `retryAfter` saniye)
 * - unauthorized: parola gerekli ya da yanlış (HTTP 401)
 * - unavailable: hizmet geçici olarak kapalı ya da günlük sınır doldu (HTTP 503)
 * - too_large: istek boyut sınırını aşıyor (istemci denetimi ya da HTTP 413)
 * - bad_request: istek biçimi sunucuca reddedildi (HTTP 400)
 * - unprocessable: istek anlaşıldı ama işlenemedi (HTTP 422; ör. metin CV'ye benzemiyor)
 */
export type AiErrorCode =
  | 'aborted'
  | 'invalid_response'
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'unavailable'
  | 'too_large'
  | 'bad_request'
  | 'unprocessable'
  | 'unknown'

export interface AiErrorOptions {
  /** 429: kaç saniye sonra yeniden denenebilir (Retry-After) */
  retryAfter?: number
  /** 401: parola az önce doğrulandığı hâlde yenilenen istek yine reddedildi (çerez saklanamadı) */
  afterAuth?: boolean
}

export class AiError extends Error {
  readonly code: AiErrorCode
  readonly retryAfter?: number
  readonly afterAuth?: boolean
  constructor(message: string, code: AiErrorCode, options: AiErrorOptions = {}) {
    super(message)
    this.code = code
    this.retryAfter = options.retryAfter
    this.afterAuth = options.afterAuth
  }
}
