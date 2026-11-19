import type { EditPayload, ImportRequest, KeywordMatchRequest, ReviewRequest, TranslateRequest } from '@/ai/types'

/**
 * ============================================================================================
 *  YAPAY ZEKÂYI BAĞLAMAK İÇİN BURAYI DOLDUR (kalan tek iş; ayrıntı: docs/YAPAY-ZEKA.md)
 * ============================================================================================
 *
 * Bu fonksiyona gelen her istek zaten:
 *   - parolayla açılmış geçerli bir oturumdan (HttpOnly çerez) gelir,
 *   - kendi sitemizden gelir (Origin denetimi),
 *   - IP/oturum başına istek sınırından ve günlük harcama tavanından geçmiştir,
 *   - `src/ai/types.ts`'teki Zod istek şemasıyla ve AI_LIMITS sınırlarıyla doğrulanmıştır.
 * Döndürdüğün `result` istemciye gitmeden önce aynı dosyadaki yanıt şemasıyla denetlenir
 * (uymazsa 502); `costUsd` günlük sayaca eklenir (AI_DAILY_COST_CAP_USD).
 *
 * Yapılacak: sağlayıcıyı seç, AI SDK ile yapılandırılmış çıktı iste, `{ ok: true, result, costUsd }`
 * döndür. Anahtar `process.env.AI_API_KEY`, model `process.env.AI_MODEL`; ikisi de yalnız sunucuda
 * (.env), tarayıcıya asla gitmez.
 *
 * Örnek (AI SDK; `npm install ai @ai-sdk/<sağlayıcı>`; API'yi kurduğun sürümün
 * node_modules/ai/docs belgesinde doğrula, 2026-11'de geçerli biçim):
 *
 *   import { generateText, Output } from 'ai'
 *   import { createAnthropic } from '@ai-sdk/anthropic'   // ya da @ai-sdk/openai, @ai-sdk/google…
 *   import { EditResultSchema } from '@/ai/types'
 *
 *   const model = createAnthropic({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
 *   const { output, usage } = await generateText({
 *     model,
 *     output: Output.object({ schema: EditResultSchema }),
 *     system: `${SYSTEM_RULES.common}\n${SYSTEM_RULES.edit}`,
 *     prompt: JSON.stringify(task.request),
 *     abortSignal: context.signal,
 *   })
 *   // usage.inputTokens / usage.outputTokens × sağlayıcının token fiyatı
 *   return { ok: true, result: output, costUsd: priceOf(usage) }
 *
 * Hata eşlemesi: model zaman aşımı → { ok:false, status:504, error:'timeout' } · sağlayıcı
 * kapalı/kota → 503 (+ retryAfter) · içerik işlenemedi (ör. metin CV'ye benzemiyor) → 422 ·
 * beklenmeyen yanıt → 502.
 *
 * MODEL TALİMATINDA OLMASI GEREKEN KURALLAR (aşağıdaki SYSTEM_RULES'a yazıldı; gerekirse geliştir):
 *  1. Yalnız verilen kimliklere dokun. `add`/`set` yalnız bölümün `fields` listesindeki alan
 *     adlarını kullanır; `rich: true` alan kısıtlı HTML'dir (p, ul/li, strong, em, a),
 *     `rich: false` alan düz, tek satır metindir.
 *  2. ⟦EMAIL⟧ gibi ⟦…⟧ yer tutuculara dokunma, birebir koru (⟦RAW⟧ dahil); yeni yer tutucu uydurma.
 *  3. Çeviri: kişi adları, şirket adları ve bağlantılar çevrilmez; okul resmî adıyla yazılır;
 *     gelen anahtar kümesi aynen korunur (anahtar eklenmez, silinmez).
 *  4. İnceleme: puan, yüzde ya da not verme; yorumu istekteki `language` dilinde yaz; en çok 20 yorum.
 *  5. Düzenleme: en çok 40 işlem; isteğe bağlı kısa `message`. Boş isteğe bağlı alan atlanabilir ya da null.
 * ============================================================================================
 */

export type AiTask =
  | { kind: 'edit'; request: EditPayload }
  | { kind: 'translate'; request: TranslateRequest }
  | { kind: 'import'; request: ImportRequest }
  | { kind: 'review'; request: ReviewRequest }
  | { kind: 'keywords'; request: KeywordMatchRequest }

export type AiTaskKind = AiTask['kind']

export interface AiTaskContext {
  /** İstemci bağlantıyı kapatınca ya da AI_UPSTREAM_TIMEOUT_MS dolunca iptal edilir */
  signal: AbortSignal
}

export type AiOutcome =
  | { ok: true; result: unknown; costUsd: number }
  | { ok: false; status: 422 | 502 | 503 | 504; error: string; retryAfter?: number }

/** Model talimatının parçaları: `common` her isteğe, diğeri uca göre eklenir. */
export const SYSTEM_RULES = {
  common: [
    'You edit CV data for the user. Return ONLY JSON that matches the given schema.',
    'Never invent facts, numbers, employers, dates or achievements that are not in the input.',
    'Placeholders in the form ⟦…⟧ (for example ⟦EMAIL⟧, ⟦PHONE⟧, ⟦RAW⟧) must be kept exactly as they are; never create new ones.',
    'Rich text fields may only use <p>, <ul>, <li>, <strong>, <em> and <a>. Plain fields are a single line without HTML.',
  ].join('\n'),
  edit: [
    'Touch only the ids that appear in the request. For add/set use only field names listed in that section’s "fields".',
    'At most 40 operations. You may add a short "message" for the user.',
  ].join('\n'),
  translate: [
    'Translate into the target language. Do not translate personal names, company names or links.',
    'Write school names with their official name. Keep exactly the same set of keys as the input.',
  ].join('\n'),
  import: 'Split the given CV text into sections and entries. Keep the original wording; do not summarise or improve it.',
  review: 'Give concrete review comments. Never give a score, percentage or grade. Write in the language given in "language". At most 20 comments.',
  keywords: 'Compare the job ad terms with the CV. Report matched, missing and related terms only; no scores or percentages.',
} as const

/**
 * Tek bağlantı noktası. Şimdilik yapılandırılmamış: bütün yapay zekâ uçları
 * `503 { error: 'not_configured' }` döner ve arayüz "hizmet şu an kullanılamıyor" iletisini gösterir.
 */
export async function runAiTask(task: AiTask, context: AiTaskContext): Promise<AiOutcome> {
  void task
  void context
  return { ok: false, status: 503, error: 'not_configured' }
}
