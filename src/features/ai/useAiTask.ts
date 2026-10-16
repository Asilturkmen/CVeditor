import { useCallback, useEffect, useRef, useState } from 'react'
import { withAiAuth } from './aiAuth'
import { aiErrorMessage, isAiAbort } from './aiErrorMessage'

export type AiTaskState<T> =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; value: T }
  | { status: 'error'; message: string }

/**
 * Düğmeyle başlayan tek bir yapay zekâ isteği: yükleniyor / iptal / hata /
 * sonuç. Parola gerekirse aiAuth akışı devreye girer. Bileşen kalkınca ya da
 * yeni istek başlayınca süren istek iptal edilir.
 */
export function useAiTask<T>() {
  const [state, setState] = useState<AiTaskState<T>>({ status: 'idle' })
  const current = useRef<AbortController | null>(null)

  useEffect(() => () => current.current?.abort(), [])

  const run = useCallback(async (call: (signal: AbortSignal) => Promise<T>) => {
    current.current?.abort()
    const controller = new AbortController()
    current.current = controller
    setState({ status: 'running' })
    try {
      const value = await withAiAuth(() => call(controller.signal), controller.signal)
      if (!controller.signal.aborted) setState({ status: 'done', value })
    } catch (error) {
      if (controller.signal.aborted || isAiAbort(error)) return
      console.warn('[yapay zekâ]', error)
      setState({ status: 'error', message: aiErrorMessage(error) })
    } finally {
      if (current.current === controller) current.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    current.current?.abort()
    current.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, run, cancel }
}
