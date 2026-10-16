import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getAiProvider } from '@/ai/provider'
import {
  buildTranslateRequest,
  collectCvTexts,
  createTranslatedCv,
  mergeTranslations,
  otherLanguage,
  suggestTranslatedName,
  type TranslatedEntry,
} from '@/ai/translate'
import { maskSourceOf } from '@/ai/mask'
import { parseTranslateResult } from '@/ai/validate'
import type { Cv } from '@/cv/schema'
import { saveCv } from '@/db/repo'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/toast'
import { useEditor } from '@/editor/store'
import { m } from '@/paraglide/messages'
import { withAiAuth } from '@/features/ai/aiAuth'
import { aiErrorMessage } from '@/features/ai/aiErrorMessage'
import { useChanged } from '@/lib/useChanged'
import { changedCount, initialReview, reviewValues, type ReviewState } from './reviewState'
import { DemoTranslateNote, TranslationReview } from './TranslationReview'

type Step = 'setup' | 'running' | 'review' | 'error'

/**
 * "Diğer dile çevir": CV'nin öbür dilde kopyasını oluşturur. Kaynak CV
 * değişmez. Çeviri her zaman önce gösterilir; onaylanınca kaydedilir.
 */
export function TranslateCvDialog({ cv, open, onClose }: { cv: Cv; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const provider = getAiProvider()
  const to = otherLanguage(cv.language)
  const [step, setStep] = useState<Step>('setup')
  const [name, setName] = useState('')
  const [entries, setEntries] = useState<TranslatedEntry[]>([])
  const [review, setReview] = useState<ReviewState>({})
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const controller = useRef<AbortController | null>(null)
  /** Çeviri başladığı andaki CV: onaylanınca bu kopya üzerine uygulanır */
  const [snapshot, setSnapshot] = useState<Cv | null>(null)

  // Her açılışta baştan başlanır (ad, açıldığı andaki CV adından önerilir).
  if (useChanged(open, false) && open) {
    setStep('setup')
    setName(suggestTranslatedName(cv.name, to))
    setEntries([])
    setReview({})
    setSaving(false)
  }

  // Kapanınca (ya da sayfa değişince) süren istek iptal edilir
  useEffect(() => {
    if (!open) controller.current?.abort()
    return () => controller.current?.abort()
  }, [open])

  const fieldCount = useMemo(() => (open ? collectCvTexts(cv).length : 0), [open, cv])

  const start = async () => {
    await useEditor.getState().flush()
    const source = structuredClone(useEditor.getState().cv ?? cv)
    setSnapshot(source)
    const collected = collectCvTexts(source)
    if (collected.length === 0) {
      setEntries([])
      setReview({})
      setStep('review')
      return
    }
    const abort = new AbortController()
    controller.current = abort
    setStep('running')
    try {
      const prepared = buildTranslateRequest(source.language, to, collected, maskSourceOf(source))
      const result = parseTranslateResult(
        await withAiAuth(() => provider.translate(prepared.request, abort.signal), abort.signal),
      )
      if (abort.signal.aborted) return
      const merged = mergeTranslations(collected, result, prepared)
      setEntries(merged)
      setReview(initialReview(merged))
      setStep('review')
    } catch (error) {
      if (abort.signal.aborted) return
      console.error(error)
      setErrorText(aiErrorMessage(error, m.tr8_translate_error()))
      setStep('error')
    } finally {
      if (controller.current === abort) controller.current = null
    }
  }

  const stop = () => {
    controller.current?.abort()
    setStep('setup')
  }

  const save = async () => {
    const source = snapshot
    if (!source || saving) return
    setSaving(true)
    try {
      const created = createTranslatedCv(source, reviewValues(entries, review), {
        name: name.trim() || suggestTranslatedName(source.name, to),
        language: to,
      })
      await saveCv(created)
      toast({ message: m.tr8_translate_created({ name: created.name }) })
      onClose()
      void navigate({ to: '/editor/$cvId', params: { cvId: created.id } })
    } catch (error) {
      console.error(error)
      setSaving(false)
      setErrorText(m.tr8_translate_error())
      setStep('error')
    }
  }

  const title = to === 'en' ? m.tr8_translate_title_en() : m.tr8_translate_title_tr()
  const reviewing = step === 'review'

  const footer =
    step === 'running' ? (
      <Button variant="ghost" onClick={stop}>
        {m.tr8_translate_stop()}
      </Button>
    ) : reviewing ? (
      <>
        <Button variant="ghost" onClick={() => setStep('setup')}>
          {m.common_back()}
        </Button>
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {m.tr8_translate_save()}
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={onClose}>
          {m.common_cancel()}
        </Button>
        <Button variant="primary" disabled={!name.trim()} onClick={() => void start()}>
          {step === 'error' ? m.tr8_translate_retry() : m.tr8_translate_start()}
        </Button>
      </>
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={reviewing ? m.tr8_translate_review_title() : title}
      description={
        reviewing && entries.length > 0
          ? m.tr8_translate_review_desc({ changed: changedCount(entries, review), total: entries.length })
          : to === 'en'
            ? m.tr8_translate_intro_en()
            : m.tr8_translate_intro_tr()
      }
      className={reviewing ? 'w-[min(94vw,720px)]' : undefined}
      footer={footer}
    >
      <div key={reviewing ? 'review' : 'setup'} className="flex flex-col gap-4 animate-rise-in">
        {provider.isDemo && step !== 'error' && <DemoTranslateNote />}

        {reviewing ? (
          entries.length === 0 ? (
            <p className="text-sm text-muted">{m.tr8_translate_empty()}</p>
          ) : (
            <TranslationReview
              entries={entries}
              state={review}
              onChange={setReview}
              from={snapshot?.language ?? cv.language}
              to={to}
              source={snapshot}
            />
          )
        ) : (
          <>
            <Field label={m.tr8_translate_name()} hint={m.tr8_translate_count({ count: fieldCount })}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  disabled={step === 'running'}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim() && step !== 'running') void start()
                  }}
                />
              )}
            </Field>
            <p className="text-[13px] text-muted">{m.tr8_translate_rules()}</p>
            {step === 'running' && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted animate-fade-in">
                <Loader2 className="size-4 animate-spin text-accent" />
                {m.tr8_translate_running()}
              </p>
            )}
            {step === 'error' && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {errorText || m.tr8_translate_error()}
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
