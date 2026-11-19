import { useNavigate } from '@tanstack/react-router'
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
import { controlOnContentClass } from '@/components/ui/controlClass'
import { Field, Input } from '@/components/ui/Field'
import { InlineNotice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/toast'
import { useEditor } from '@/editor/store'
import { m } from '@/paraglide/messages'
import { withAiAuth } from '@/features/ai/aiAuth'
import { aiErrorMessage } from '@/features/ai/aiErrorMessage'
import { useChanged } from '@/lib/useChanged'
import { changedCount, initialReview, reviewValues, type ReviewState } from './reviewState'
import { DemoTranslateNote, TranslationReview } from './TranslationReview'

type Step = 'setup' | 'running' | 'review' | 'error'

/** Kontrol adımının penceresi: masaüstünde kenarlardan 24px, en çok 1200px genişlik; telefonda alt sayfa. */
const REVIEW_SHEET = 'bg-window sm:inset-x-6 sm:inset-y-6 sm:mx-auto sm:w-auto sm:max-w-[1200px] sm:max-h-none sm:translate-x-0 sm:translate-y-0'

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
      <Button size="lg" onClick={stop}>
        {m.tr8_translate_stop()}
      </Button>
    ) : reviewing ? (
      <>
        <Button size="lg" onClick={() => setStep('setup')}>
          {m.common_back()}
        </Button>
        <Button size="lg" variant="primary" loading={saving} onClick={() => void save()}>
          {m.tr8_translate_save()}
        </Button>
      </>
    ) : (
      <>
        <Button size="lg" onClick={onClose}>
          {m.common_cancel()}
        </Button>
        <Button size="lg" variant="primary" disabled={!name.trim()} onClick={() => void start()}>
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
      // Kontrol adımı neredeyse tam ekran: pencere zemini + beyaz gruplar, en çok 1200px, ortada.
      className={reviewing ? REVIEW_SHEET : undefined}
      footer={footer}
    >
      <div key={reviewing ? 'review' : 'setup'} className="flex flex-col gap-4 animate-rise-in">
        {provider.isDemo && step !== 'error' && <DemoTranslateNote />}

        {reviewing ? (
          entries.length === 0 ? (
            <p className="text-body text-fg">{m.tr8_translate_empty()}</p>
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
                  className={controlOnContentClass}
                  value={name}
                  disabled={step === 'running'}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim() && step !== 'running') void start()
                  }}
                />
              )}
            </Field>
            <p className="text-callout text-fg-2">{m.tr8_translate_rules()}</p>
            {step === 'running' && (
              <p role="status" className="flex animate-fade-in items-center gap-2 text-body text-fg">
                <Spinner />
                {m.tr8_translate_running()}
              </p>
            )}
            {step === 'error' && (
              <div role="alert">
                <InlineNotice tone="danger">{errorText || m.tr8_translate_error()}</InlineNotice>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
