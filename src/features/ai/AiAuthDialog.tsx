import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getAiProvider } from '@/ai/provider'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { m } from '@/paraglide/messages'
import { useAiAuth } from './aiAuth'
import { aiErrorCode, aiErrorMessage, isAiAbort } from './aiErrorMessage'

/**
 * Sayfa içi parola penceresi. Kökte bir kez durur; bir yapay zekâ çağrısı
 * 'unauthorized' ile dönünce aiAuth.ts açar. Parola sunucuya verilir
 * (karşılığında HttpOnly çerez), burada ya da tarayıcıda saklanmaz.
 */
export function AiAuthDialog() {
  const open = useAiAuth((s) => s.open)
  const settle = useAiAuth((s) => s.settle)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  /** Pencereyi kapatır; bir sonraki açılış boş alanla başlar. */
  const close = (ok: boolean) => {
    request.current?.abort()
    request.current = null
    setPassword('')
    setBusy(false)
    setError(null)
    settle?.(ok)
  }
  const cancel = () => close(false)

  const submit = async () => {
    const provider = getAiProvider()
    if (!password || busy || !provider.authenticate) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      await provider.authenticate(password, controller.signal)
      if (controller.signal.aborted) return
      request.current = null
      close(true)
      return
    } catch (e) {
      if (controller.signal.aborted || isAiAbort(e)) return
      setError(aiErrorCode(e) === 'unauthorized' ? m.ai_auth_wrong() : aiErrorMessage(e))
      setPassword('')
    }
    if (request.current === controller) request.current = null
    setBusy(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && cancel()}
      title={m.ai_auth_title()}
      description={m.ai_auth_desc()}
      className="w-[min(92vw,420px)]"
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            {m.common_cancel()}
          </Button>
          <Button variant="primary" type="submit" form="ai-auth-form" disabled={!password || busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? m.ai_auth_checking() : m.ai_auth_submit()}
          </Button>
        </>
      }
    >
      <form
        id="ai-auth-form"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label={m.ai_auth_label()} hint={m.ai_auth_note()}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              readOnly={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'ai-auth-error' : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {error && (
          <p id="ai-auth-error" role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger animate-fade-in">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
