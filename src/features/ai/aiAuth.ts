import { create } from 'zustand'
import { getAiProvider } from '@/ai/provider'
import { AiError } from '@/ai/types'

/**
 * Parola akışı. Sunucu bir çağrıyı 'unauthorized' ile geri çevirirse sayfa
 * içi parola penceresi (AiAuthDialog) açılır; parola doğrulanınca (sunucu
 * HttpOnly çerez koyar) çağrı bir kez yenilenir. Aynı anda birden çok çağrı
 * parola beklerse tek pencere açılır. Tarayıcının prompt() penceresi
 * kullanılmaz; parola hiçbir yerde saklanmaz.
 *
 * Yarış durumları:
 * - Parola doğrulanmadan ÖNCE gönderilmiş bir isteğin 401'i doğrulamadan
 *   SONRA gelirse pencere yeniden açılmaz: istek yeni oturumla bir kez yenilenir.
 * - Bekleyen bileşen kalkarsa (ya da isteğini iptal ederse) ve pencereyi
 *   bekleyen başka istek kalmadıysa pencere kapanır.
 * - Parola doğrulandığı hâlde yenilenen istek yine 401 alırsa (çerez
 *   saklanamadı) pencere döngüye girmez; hata `afterAuth` ile döner ve arayüz
 *   çerez iletisini gösterir.
 */

interface AiAuthState {
  open: boolean
  /** Pencere kapanınca çağrılır: true → parola doğrulandı */
  settle: ((ok: boolean) => void) | null
}

export const useAiAuth = create<AiAuthState>(() => ({ open: false, settle: null }))

/** Başarılı her parola doğrulamasında artar: istek başladıktan sonra oturum yenilendi mi? */
let authGeneration = 0

interface Pending {
  promise: Promise<boolean>
  /** Pencereyi bekleyen ve iptal edilebilen istekler */
  waiters: number
}

let pending: Pending | null = null

/**
 * Parola penceresini açar; doğrulanınca true, vazgeçilince false. `signal`
 * iptal edilirse bu bekleyen false alır; pencereyi bekleyen kimse kalmadıysa
 * pencere kapanır.
 */
export function requestAiPassword(signal?: AbortSignal): Promise<boolean> {
  if (!pending) {
    let resolve!: (ok: boolean) => void
    const promise = new Promise<boolean>((r) => (resolve = r))
    const current: Pending = { promise, waiters: 0 }
    let done = false
    const settle = (ok: boolean) => {
      if (done) return
      done = true
      if (pending === current) pending = null
      if (ok) authGeneration++
      // Geç gelen eski bir settle, sonradan açılmış başka pencereyi kapatmasın.
      if (useAiAuth.getState().settle === settle) useAiAuth.setState({ open: false, settle: null })
      resolve(ok)
    }
    pending = current
    useAiAuth.setState({ open: true, settle })
  }
  const current = pending
  if (!signal) return current.promise
  current.waiters++
  return new Promise<boolean>((resolve) => {
    let finished = false
    const onAbort = () => {
      if (finished) return
      finished = true
      current.waiters--
      if (current.waiters <= 0 && pending === current) useAiAuth.getState().settle?.(false)
      resolve(false)
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void current.promise.then((ok) => {
      signal.removeEventListener('abort', onAbort)
      if (finished) return
      finished = true
      resolve(ok)
    })
  })
}

const abortError = () => Object.assign(new AiError('İstek durduruldu', 'aborted'), { name: 'AbortError' })
const isUnauthorized = (error: unknown) => error instanceof AiError && error.code === 'unauthorized'

/** Parola doğrulandıktan sonra yenilenen istek: yine 401 ise döngü yok, hata `afterAuth` ile döner. */
async function retryAfterAuth<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (isUnauthorized(error)) throw new AiError((error as AiError).message, 'unauthorized', { afterAuth: true })
    throw error
  }
}

/**
 * Çağrıyı parola akışıyla sarar: 'unauthorized' gelirse ve sağlayıcı parola
 * kabul ediyorsa parola sorulur, doğrulanınca çağrı bir kez yenilenir.
 * Vazgeçilirse ilk hata (unauthorized) aynen fırlatılır.
 */
export async function withAiAuth<T>(call: () => Promise<T>, signal: AbortSignal): Promise<T> {
  const startedAt = authGeneration
  try {
    return await call()
  } catch (error) {
    const provider = getAiProvider()
    if (!isUnauthorized(error)) throw error
    if (!provider.requiresAuth || !provider.authenticate || signal.aborted) throw error
    // İstek uçtayken parola başka bir istek için doğrulandı: eski 401, pencere açılmaz.
    if (authGeneration !== startedAt) return retryAfterAuth(call)
    const ok = await requestAiPassword(signal)
    if (signal.aborted) throw abortError()
    if (!ok) throw error
    return retryAfterAuth(call)
  }
}
