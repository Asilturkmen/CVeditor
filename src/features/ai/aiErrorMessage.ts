import { AiError, type AiErrorCode } from '@/ai/types'
import { m } from '@/paraglide/messages'

/**
 * Yapay zekâ hatalarının tek iletisi: düzenleme, çeviri, içe aktarma ve CV
 * İnceleme aynı metni gösterir. Her kodun kendi iletisi vardır; 'aborted'
 * kullanıcının kendi eylemidir, ileti gösterilmez (bkz. isAiAbort).
 */

export function aiErrorCode(error: unknown): AiErrorCode {
  if (error instanceof AiError) return error.code
  if (error instanceof Error && error.name === 'AbortError') return 'aborted'
  return 'unknown'
}

export const isAiAbort = (error: unknown) => aiErrorCode(error) === 'aborted'

const MESSAGES: Record<Exclude<AiErrorCode, 'aborted' | 'unknown'>, (error: AiError) => string> = {
  invalid_response: () => m.ai2_error_invalid(),
  network: () => m.ai2_error_network(),
  timeout: () => m.ai2_error_timeout(),
  rate_limited: (e) => (e.retryAfter ? m.ai2_error_rate_wait({ seconds: e.retryAfter }) : m.ai2_error_rate()),
  // Parola az önce doğrulandığı hâlde yenilenen istek yine reddedildiyse sorun çerezdedir.
  unauthorized: (e) => (e.afterAuth ? m.ai2_error_unauthorized_retry() : m.ai2_error_unauthorized()),
  unavailable: () => m.ai2_error_unavailable(),
  too_large: () => m.ai2_error_too_large(),
  bad_request: () => m.ai2_error_bad_request(),
  unprocessable: () => m.ai2_error_unprocessable(),
}

/**
 * Hataya uygun ileti. `fallback`: yapay zekâ dışı (ör. kaydetme) ya da
 * tanınmayan hatalarda gösterilecek bağlama özgü metin.
 */
export function aiErrorMessage(error: unknown, fallback?: string): string {
  const code = aiErrorCode(error)
  if (code === 'aborted' || code === 'unknown' || !(error instanceof AiError)) return fallback ?? m.ai2_error_unknown()
  return MESSAGES[code](error)
}
