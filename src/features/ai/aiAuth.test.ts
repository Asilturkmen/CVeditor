import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_FLAGS_KEY, resetMockSession } from '@/ai/mockProvider'
import { AiError, type AiErrorCode } from '@/ai/types'
import { requestAiPassword, useAiAuth, withAiAuth } from './aiAuth'
import { aiErrorCode, aiErrorMessage, isAiAbort } from './aiErrorMessage'

const unauthorized = () => new AiError('parola', 'unauthorized')
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('hata iletileri', () => {
  it('her hata kodunun kendi iletisi var; durdurma ayrı tutulur', () => {
    const codes: AiErrorCode[] = [
      'invalid_response',
      'network',
      'timeout',
      'rate_limited',
      'unauthorized',
      'unavailable',
      'too_large',
      'bad_request',
      'unprocessable',
      'unknown',
    ]
    const messages = codes.map((code) => aiErrorMessage(new AiError('x', code)))
    expect(new Set(messages).size).toBe(codes.length)
    expect(isAiAbort(new AiError('x', 'aborted'))).toBe(true)
    expect(isAiAbort(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true)
    expect(aiErrorCode(new TypeError('x'))).toBe('unknown')
  })

  it('429 bekleme süresi ve parola sonrası yine 401 ayrı ileti alır', () => {
    expect(aiErrorMessage(new AiError('x', 'rate_limited', { retryAfter: 30 }))).toContain('30')
    expect(aiErrorMessage(new AiError('x', 'unauthorized', { afterAuth: true }))).not.toBe(aiErrorMessage(new AiError('x', 'unauthorized')))
  })

  it('yapay zekâ dışı hatada bağlama özgü metin gösterilir', () => {
    expect(aiErrorMessage(new Error('db'), 'Çeviri yapılamadı')).toBe('Çeviri yapılamadı')
    expect(aiErrorMessage(new AiError('x', 'network'), 'Çeviri yapılamadı')).not.toBe('Çeviri yapılamadı')
  })
})

describe('parola akışı', () => {
  afterEach(() => {
    useAiAuth.getState().settle?.(false)
    localStorage.removeItem(MOCK_FLAGS_KEY)
    resetMockSession()
  })

  it('sağlayıcı parola istemiyorsa unauthorized olduğu gibi döner, pencere açılmaz', async () => {
    const call = vi.fn().mockRejectedValue(unauthorized())
    await expect(withAiAuth(call, new AbortController().signal)).rejects.toMatchObject({ code: 'unauthorized' })
    expect(useAiAuth.getState().open).toBe(false)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('parola doğrulanınca çağrı bir kez yenilenir', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const call = vi.fn().mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce('tamam')
    const pending = withAiAuth(call, new AbortController().signal)
    await tick()
    expect(useAiAuth.getState().open).toBe(true)
    useAiAuth.getState().settle!(true)
    await expect(pending).resolves.toBe('tamam')
    expect(call).toHaveBeenCalledTimes(2)
    expect(useAiAuth.getState().open).toBe(false)
  })

  it('vazgeçilirse ilk hata (unauthorized) döner', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const call = vi.fn().mockRejectedValue(unauthorized())
    const pending = withAiAuth(call, new AbortController().signal)
    await tick()
    useAiAuth.getState().settle!(false)
    await expect(pending).rejects.toMatchObject({ code: 'unauthorized' })
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('aynı anda bekleyen istekler tek pencereyi paylaşır', async () => {
    const a = requestAiPassword()
    const b = requestAiPassword()
    expect(a).toBe(b)
    useAiAuth.getState().settle!(true)
    await expect(Promise.all([a, b])).resolves.toEqual([true, true])
  })

  it("parola doğrulanmadan önce gönderilen isteğin geç gelen 401'i pencereyi yeniden açmaz; istek yenilenir", async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    let rejectLate!: (e: unknown) => void
    const late = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_, reject) => (rejectLate = reject)))
      .mockResolvedValueOnce('geç tamam')
    const first = vi.fn().mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce('ilk tamam')
    const pendingLate = withAiAuth(late, new AbortController().signal)
    const pendingFirst = withAiAuth(first, new AbortController().signal)
    await tick()
    expect(useAiAuth.getState().open).toBe(true)
    useAiAuth.getState().settle!(true)
    await expect(pendingFirst).resolves.toBe('ilk tamam')
    // Eski istek şimdi 401 döner: pencere açılmaz, yeni oturumla bir kez yenilenir.
    rejectLate(unauthorized())
    await tick()
    expect(useAiAuth.getState().open).toBe(false)
    await expect(pendingLate).resolves.toBe('geç tamam')
  })

  it('bekleyen bileşen kalkınca (iptal) pencere kapanır; başka bekleyen varsa açık kalır', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const a = new AbortController()
    const b = new AbortController()
    const pa = withAiAuth(vi.fn().mockRejectedValue(unauthorized()), a.signal)
    const pb = withAiAuth(vi.fn().mockRejectedValue(unauthorized()), b.signal)
    await tick()
    expect(useAiAuth.getState().open).toBe(true)
    a.abort()
    await expect(pa).rejects.toMatchObject({ code: 'aborted' })
    expect(useAiAuth.getState().open).toBe(true)
    b.abort()
    await expect(pb).rejects.toMatchObject({ code: 'aborted' })
    expect(useAiAuth.getState().open).toBe(false)
  })

  it('parola doğrulandığı hâlde yenilenen istek yine 401 alırsa döngü yok; çerez iletisi', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const call = vi.fn().mockRejectedValue(unauthorized())
    const pending = withAiAuth(call, new AbortController().signal)
    await tick()
    useAiAuth.getState().settle!(true)
    const error = await pending.catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'unauthorized', afterAuth: true })
    expect(call).toHaveBeenCalledTimes(2)
    expect(useAiAuth.getState().open).toBe(false)
    expect(aiErrorMessage(error)).toBe(aiErrorMessage(new AiError('x', 'unauthorized', { afterAuth: true })))
  })

  it('diğer hatalar parola sormaz', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const call = vi.fn().mockRejectedValue(new AiError('x', 'rate_limited'))
    await expect(withAiAuth(call, new AbortController().signal)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(useAiAuth.getState().open).toBe(false)
  })
})
