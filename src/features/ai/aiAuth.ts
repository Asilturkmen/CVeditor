import { create } from 'zustand'
import { getAiProvider } from '@/ai/provider'
import { AiError } from '@/ai/types'

/**
 * Parola akışı. Sunucu bir çağrıyı 'unauthorized' ile geri çevirirse sayfa
 * içi parola penceresi (AiAuthDialog) açılır; parola doğrulanınca çağrı bir
 * kez yenilenir. Aynı anda birden çok çağrı parola beklerse tek pencere açılır.
 * Tarayıcının prompt() penceresi kullanılmaz; parola hiçbir yerde saklanmaz.
 */

interface AiAuthState {
  open: boolean
  /** Pencere kapanınca çağrılır: true → parola doğrulandı */
  settle: ((ok: boolean) => void) | null
}

export const useAiAuth = create<AiAuthState>(() => ({ open: false, settle: null }))

let waiting: Promise<boolean> | null = null

/** Parola penceresini açar; doğrulanınca true, vazgeçilince false. */
export function requestAiPassword(): Promise<boolean> {
  waiting ??= new Promise<boolean>((resolve) => {
    useAiAuth.setState({
      open: true,
      settle: (ok) => {
        waiting = null
        useAiAuth.setState({ open: false, settle: null })
        resolve(ok)
      },
    })
  })
  return waiting
}

const abortError = () => Object.assign(new AiError('İstek durduruldu', 'aborted'), { name: 'AbortError' })

/**
 * Çağrıyı parola akışıyla sarar: 'unauthorized' gelirse ve sağlayıcı parola
 * kabul ediyorsa parola sorulur, doğrulanınca çağrı bir kez yenilenir.
 * Vazgeçilirse ilk hata (unauthorized) aynen fırlatılır.
 */
export async function withAiAuth<T>(call: () => Promise<T>, signal: AbortSignal): Promise<T> {
  try {
    return await call()
  } catch (error) {
    const provider = getAiProvider()
    if (!(error instanceof AiError) || error.code !== 'unauthorized') throw error
    if (!provider.requiresAuth || !provider.authenticate || signal.aborted) throw error
    const ok = await requestAiPassword()
    if (signal.aborted) throw abortError()
    if (!ok) throw error
    return call()
  }
}
