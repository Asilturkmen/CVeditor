import { AiError, type AiErrorCode, type AiProvider } from './types'

/**
 * GERÇEK sağlayıcı: aynı kökteki küçük sunucunun `/api/ai/*` uçlarına yalnız
 * `fetch` ile gider. Model, SDK ve API anahtarı sunucudadır; tarayıcıya hiçbir
 * anahtar gelmez. Parola bir kez `/api/ai/auth`'a verilir, karşılığında sunucu
 * HttpOnly oturum çerezi koyar; sonraki istekler çerezi `credentials:
 * 'same-origin'` ile taşır (parola tarayıcıda saklanmaz).
 *
 * Seçim: derlemede `VITE_AI_PROVIDER=http` (provider.ts); varsayılan örnek sağlayıcı.
 *
 * Uçlar (hepsi POST, JSON; şemalar types.ts):
 *   /api/ai/auth      { password }            → 204 + Set-Cookie (HttpOnly; Secure; SameSite=Strict)
 *   /api/ai/edit      EditPayload             → EditResult
 *   /api/ai/translate TranslateRequest        → TranslateResult
 *   /api/ai/import    ImportRequest           → ImportResult
 *   /api/ai/review    ReviewRequest           → ReviewResult
 *   /api/ai/keywords  KeywordMatchRequest     → KeywordMatchResult
 *
 * HTTP durumu → AiError kodu (arayüzde her birinin kendi iletisi var):
 *   401 unauthorized · 429 rate_limited (+ Retry-After) · 503 unavailable
 *   400 bad_request · 413 too_large · 422 unprocessable · 408/504 timeout
 *   fetch hatası network · süre aşımı timeout · kullanıcı iptali aborted
 * Yanıt gövdesi olduğu gibi döner; arayüz validate.ts ile Zod'dan geçirir.
 */

const BASE = '/api/ai'

/** Uç başına süre sınırı (ms): uzun CV çevirisi ve içe aktarma daha uzun sürebilir. */
export const HTTP_TIMEOUTS = {
  auth: 15_000,
  edit: 60_000,
  translate: 120_000,
  import: 120_000,
  review: 60_000,
  keywords: 45_000,
} as const

type Endpoint = keyof typeof HTTP_TIMEOUTS

/** İptal: AiError('aborted'), adı AbortError (iki denetim de tutar; arayüz ileti göstermez). */
function abortError(): AiError {
  const error = new AiError('İstek durduruldu', 'aborted')
  error.name = 'AbortError'
  return error
}

/** Retry-After: saniye ya da HTTP tarihi → saniye (bilinmiyorsa undefined) */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  const at = Date.parse(trimmed)
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000))
}

const STATUS_CODES: Record<number, AiErrorCode> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'unauthorized',
  408: 'timeout',
  413: 'too_large',
  422: 'unprocessable',
  429: 'rate_limited',
  502: 'unavailable',
  503: 'unavailable',
  504: 'timeout',
}

/** HTTP yanıtını AiError'a çevirir (gövde okunmaz: sunucunun hata metni kullanıcıya gösterilmez). */
export function statusError(response: Pick<Response, 'status' | 'headers'>, endpoint: string): AiError {
  const code = STATUS_CODES[response.status] ?? 'unknown'
  const retryAfter = code === 'rate_limited' || code === 'unavailable' ? parseRetryAfter(response.headers.get('Retry-After')) : undefined
  return new AiError(`${endpoint}: HTTP ${response.status}`, code, { retryAfter })
}

async function post(endpoint: Endpoint, body: unknown, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw abortError()
  const controller = new AbortController()
  let timedOut = false
  const onAbort = () => controller.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, HTTP_TIMEOUTS[endpoint])
  // Ağ/iptal/süre hatası: hangisi olduğu çağıranın sinyalinden ve zamanlayıcıdan anlaşılır.
  const failure = () => {
    if (signal.aborted) return abortError()
    if (timedOut) return new AiError(`${endpoint}: süre doldu`, 'timeout')
    return new AiError(`${endpoint}: sunucuya ulaşılamadı`, 'network')
  }
  try {
    let response: Response
    try {
      response = await fetch(`${BASE}/${endpoint}`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      throw failure()
    }
    if (!response.ok) throw statusError(response, endpoint)
    if (response.status === 204) return undefined
    let text: string
    try {
      text = await response.text()
    } catch {
      throw failure()
    }
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new AiError(`${endpoint}: yanıt JSON değil`, 'invalid_response')
    }
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

export const httpProvider: AiProvider = {
  id: 'http',
  isDemo: false,
  requiresAuth: true,
  authenticate: async (password, signal) => {
    await post('auth', { password }, signal)
  },
  edit: (payload, signal) => post('edit', payload, signal) as never,
  translate: (request, signal) => post('translate', request, signal) as never,
  parseImport: (request, signal) => post('import', request, signal) as never,
  review: (request, signal) => post('review', request, signal) as never,
  matchKeywords: (request, signal) => post('keywords', request, signal) as never,
}
