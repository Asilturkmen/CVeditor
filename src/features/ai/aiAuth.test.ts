import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_FLAGS_KEY, resetMockSession } from '@/ai/mockProvider'
import { AiError, type AiErrorCode } from '@/ai/types'
import { requestAiPassword, useAiAuth, withAiAuth } from './aiAuth'
import { aiErrorCode, aiErrorMessage, isAiAbort } from './aiErrorMessage'

const unauthorized = () => new AiError('parola', 'unauthorized')
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('hata iletileri', () => {
  it('her hata kodunun kendi iletisi var; durdurma ayrı tutulur', () => {
    const codes: AiErrorCode[] = ['invalid_response', 'network', 'rate_limited', 'unauthorized', 'unavailable', 'unknown']
    const messages = codes.map((code) => aiErrorMessage(new AiError('x', code)))
    expect(new Set(messages).size).toBe(codes.length)
    expect(isAiAbort(new AiError('x', 'aborted'))).toBe(true)
    expect(isAiAbort(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true)
    expect(aiErrorCode(new TypeError('x'))).toBe('unknown')
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

  it('diğer hatalar parola sormaz', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const call = vi.fn().mockRejectedValue(new AiError('x', 'rate_limited'))
    await expect(withAiAuth(call, new AbortController().signal)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(useAiAuth.getState().open).toBe(false)
  })
})
