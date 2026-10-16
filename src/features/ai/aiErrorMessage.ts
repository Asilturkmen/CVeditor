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

const MESSAGES: Record<Exclude<AiErrorCode, 'aborted' | 'unknown'>, () => string> = {
  invalid_response: () => m.ai2_error_invalid(),
  network: () => m.ai2_error_network(),
  rate_limited: () => m.ai2_error_rate(),
  unauthorized: () => m.ai2_error_unauthorized(),
  unavailable: () => m.ai2_error_unavailable(),
}

/**
 * Hataya uygun ileti. `fallback`: yapay zekâ dışı (ör. kaydetme) ya da
 * tanınmayan hatalarda gösterilecek bağlama özgü metin.
 */
export function aiErrorMessage(error: unknown, fallback?: string): string {
  const code = aiErrorCode(error)
  if (code === 'aborted' || code === 'unknown') return fallback ?? m.ai2_error_unknown()
  return MESSAGES[code]()
}
