import { mockProvider } from './mockProvider'
import type { AiProvider } from './types'

/**
 * Etkin yapay zekâ sağlayıcısı. Şimdilik örnek sağlayıcı (istek atmaz).
 *
 * Gerçek bağlantı için yapılacak tek değişiklik: `httpProvider.ts` yazıp
 * burada döndürmek. Arayüzün hiçbir yeri değişmez. httpProvider, types.ts'teki
 * `AiProvider` sözleşmesinin tamamını uygular:
 *
 *   id: 'http', isDemo: false        → "Örnek" rozetleri ve notları kendiliğinden kalkar
 *   requiresAuth: true               → 401 gelince sayfa içi parola penceresi açılır
 *   authenticate(password, signal)   → POST /api/ai/auth     { password } → 204 + HttpOnly çerez
 *   edit(payload, signal)            → POST /api/ai/edit     EditPayload         → EditResult
 *   translate(request, signal)       → POST /api/ai/translate TranslateRequest   → TranslateResult
 *   parseImport(request, signal)     → POST /api/ai/import   ImportRequest       → ImportResult
 *   review(request, signal)          → POST /api/ai/review   ReviewRequest       → ReviewResult
 *   matchKeywords(request, signal)   → POST /api/ai/keywords KeywordMatchRequest → KeywordMatchResult
 *
 * Her çağrı: `fetch(url, { method: 'POST', credentials: 'same-origin', signal })`.
 * Yanıt gövdesini döndürmek yeter; arayüz validate.ts ile Zod'dan geçirir
 * (httpProvider de geçirebilir). HTTP durumları AiError koduna çevrilir:
 *   401 → 'unauthorized' (parola penceresi, doğrulanınca istek bir kez yenilenir)
 *   429 → 'rate_limited'   503 → 'unavailable' (günlük sınır / bakım)
 *   fetch hatası → 'network'   AbortError → 'aborted'   diğerleri → 'unknown'
 * API anahtarı tarayıcıya hiç gelmez; yalnız sunucuda durur.
 */
export function getAiProvider(): AiProvider {
  return mockProvider
}
