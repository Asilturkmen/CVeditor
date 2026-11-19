import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HTTP_TIMEOUTS, httpProvider, parseRetryAfter } from './httpProvider'
import { AiError } from './types'

/** fetch taklidi: gerçek ağa çıkılmaz. */

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const signal = () => new AbortController().signal
const request = { text: 'Deneyim\n• Rapor hazırladım', language: 'tr' as const }

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(AiError)
  return error as AiError
}

describe('httpProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('aynı kökteki /api/ai/* ucuna POST eder; çerezli (same-origin), JSON gövde; yanıt olduğu gibi döner', async () => {
    fetchMock.mockResolvedValue(json({ personal: {}, sections: [] }))
    await expect(httpProvider.parseImport(request, signal())).resolves.toEqual({ personal: {}, sections: [] })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/ai/import')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' })
    expect(JSON.parse(init.body as string)).toEqual(request)
    expect(httpProvider).toMatchObject({ id: 'http', isDemo: false, requiresAuth: true })
  })

  it('her uç kendi yoluna gider; parola 204 ile kabul edilir', async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/auth') ? new Response(null, { status: 204 }) : json({})))
    await httpProvider.authenticate!('deneme', signal())
    await httpProvider.edit({} as never, signal())
    await httpProvider.translate({} as never, signal())
    await httpProvider.review({} as never, signal())
    await httpProvider.matchKeywords({} as never, signal())
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/ai/auth', '/api/ai/edit', '/api/ai/translate', '/api/ai/review', '/api/ai/keywords'])
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ password: 'deneme' })
  })

  it.each([
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [413, 'too_large'],
    [422, 'unprocessable'],
    [429, 'rate_limited'],
    [503, 'unavailable'],
    [504, 'timeout'],
    [500, 'unknown'],
  ])('HTTP %i → %s', async (status, code) => {
    fetchMock.mockResolvedValue(json({ error: 'gizli sunucu iletisi' }, status))
    expect((await codeOf(httpProvider.parseImport(request, signal()))).code).toBe(code)
  })

  it('429 Retry-After saniye ve tarih olarak okunur', async () => {
    fetchMock.mockResolvedValue(json({}, 429, { 'Retry-After': '30' }))
    expect((await codeOf(httpProvider.review({} as never, signal()))).retryAfter).toBe(30)
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:30 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(30)
    expect(parseRetryAfter('yarın')).toBeUndefined()
    expect(parseRetryAfter(null)).toBeUndefined()
  })

  it('ağ hatası network, JSON olmayan yanıt invalid_response', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await codeOf(httpProvider.edit({} as never, signal()))).code).toBe('network')
    fetchMock.mockResolvedValue(new Response('<html>hata</html>', { status: 200 }))
    expect((await codeOf(httpProvider.edit({} as never, signal()))).code).toBe('invalid_response')
  })

  it('kullanıcı iptali aborted (adı AbortError); önceden iptal edilmişse fetch çağrılmaz', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    )
    const controller = new AbortController()
    const pending = httpProvider.translate({} as never, controller.signal)
    controller.abort()
    const error = await codeOf(pending)
    expect(error.code).toBe('aborted')
    expect(error.name).toBe('AbortError')

    fetchMock.mockClear()
    const done = new AbortController()
    done.abort()
    expect((await codeOf(httpProvider.translate({} as never, done.signal))).code).toBe('aborted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('süre dolunca timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    )
    const pending = codeOf(httpProvider.edit({} as never, signal()))
    await vi.advanceTimersByTimeAsync(HTTP_TIMEOUTS.edit + 1)
    expect((await pending).code).toBe('timeout')
  })
})
