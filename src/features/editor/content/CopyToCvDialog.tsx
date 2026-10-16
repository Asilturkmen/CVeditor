import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Link2, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getAiProvider } from '@/ai/provider'
import { applyToItem, buildTranslateRequest, collectItemTexts, mergeTranslations, type TranslatedEntry } from '@/ai/translate'
import type { AnyItem, Cv, SectionType } from '@/cv/schema'
import { db } from '@/db/db'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { toast } from '@/components/ui/Toaster'
import { copyItemToCv } from '@/editor/actions'
import { useEditor } from '@/editor/store'
import { findLinkedItem, replaceLinkedItem } from '@/features/translate/linkedItems'
import {
  DemoTranslateNote,
  initialReview,
  reviewValues,
  TranslationReview,
  type ReviewState,
} from '@/features/translate/TranslationReview'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { itemLabel } from '../labels'

type Step = 'pick' | 'running' | 'review' | 'error'

/**
 * Kaydı başka bir CV'ye ekler; çeviri bağı (translationGroupId) korunur.
 * Hedef CV başka dildeyse "Çevirerek ekle" varsayılandır: çeviri önce
 * gösterilir, onaylanınca eklenir. Hedefte bağlı kayıt varsa o kayıt
 * güncellenebilir ya da yeni kayıt eklenebilir.
 */
export function CopyToCvDialog({
  currentCvId,
  payload,
  onClose,
}: {
  currentCvId: string
  payload: { type: SectionType; item: AnyItem } | null
  onClose: () => void
}) {
  const others = useLiveQuery(
    () => db.cvs.orderBy('updatedAt').reverse().filter((c) => c.id !== currentCvId).toArray(),
    [currentCvId],
    [] as Cv[],
  )
  const fromLanguage = useEditor((s) => s.cv?.language ?? 'tr')
  const provider = getAiProvider()
  const [target, setTarget] = useState<string | null>(null)
  const [translate, setTranslate] = useState(true)
  const [linkMode, setLinkMode] = useState<'update' | 'new'>('update')
  const [step, setStep] = useState<Step>('pick')
  const [entries, setEntries] = useState<TranslatedEntry[]>([])
  const [review, setReview] = useState<ReviewState>({})
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!payload) {
      controller.current?.abort()
      return
    }
    setStep('pick')
    setTranslate(true)
    setLinkMode('update')
    setBusy(false)
    setEntries([])
  }, [payload])

  useEffect(() => {
    if (payload && (!target || !others.some((c) => c.id === target))) setTarget(others[0]?.id ?? null)
  }, [payload, others]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => controller.current?.abort(), [])

  const label = payload ? itemLabel(payload.type, payload.item) || m.editor_untitled() : ''
  const targetCv = others.find((c) => c.id === target) ?? null
  const linkedOf = (cv: Cv) => (payload ? findLinkedItem(cv, payload.type, payload.item.translationGroupId) : null)
  const linked = targetCv ? linkedOf(targetCv) : null
  const languageDiffers = !!targetCv && targetCv.language !== fromLanguage
  const translatable = payload ? collectItemTexts('', payload.type, payload.item) : []
  const willTranslate = languageDiffers && translate && translatable.length > 0
  const updating = !!linked && linkMode === 'update'

  const finish = async (item: AnyItem) => {
    if (!payload || !targetCv) return
    setBusy(true)
    try {
      if (updating) {
        const name = await replaceLinkedItem(targetCv.id, payload.type, item)
        toast({ message: m.tr8_toast_updated_in_cv({ name }) })
      } else {
        const name = await copyItemToCv(targetCv.id, payload.type, item)
        toast({ message: m.toast_copied_to_cv({ name }) })
      }
      onClose()
    } catch (error) {
      console.error(error)
      setBusy(false)
      setStep('error')
    }
  }

  const runTranslation = async () => {
    if (!payload || !targetCv) return
    const abort = new AbortController()
    controller.current = abort
    setStep('running')
    try {
      // Metinde geçen ad ve iletişim bilgileri kaynak CV'nin kişisel bilgileriyle maskelenir.
      const personal = useEditor.getState().cv?.personal ?? {}
      const prepared = buildTranslateRequest(fromLanguage, targetCv.language, translatable, personal)
      const result = await provider.translate(prepared.request, abort.signal)
      if (abort.signal.aborted) return
      const merged = mergeTranslations(translatable, result, prepared)
      setEntries(merged)
      setReview(initialReview(merged))
      setStep('review')
    } catch (error) {
      if (abort.signal.aborted) return
      console.error(error)
      setStep('error')
    }
  }

  const submit = () => {
    if (!payload || !targetCv) return
    if (step === 'review') void finish(applyToItem(payload.item, reviewValues(entries, review)))
    else if (willTranslate) void runTranslation()
    else void finish(payload.item)
  }

  const stop = () => {
    controller.current?.abort()
    setStep('pick')
  }

  const reviewing = step === 'review'
  const submitLabel = reviewing
    ? updating
      ? m.tr8_copy_submit_update()
      : m.tr8_copy_submit_translated()
    : willTranslate
      ? m.tr8_translate_start()
      : updating
        ? m.tr8_copy_submit_update()
        : m.copy_to_cv_submit()

  return (
    <Dialog
      open={!!payload}
      onOpenChange={(open) => !open && onClose()}
      title={reviewing ? m.tr8_translate_review_title() : m.copy_to_cv_title()}
      description={
        reviewing && targetCv ? m.tr8_copy_review_desc({ name: targetCv.name }) : m.copy_to_cv_desc({ name: label })
      }
      className={reviewing ? 'w-[min(94vw,620px)]' : undefined}
      footer={
        step === 'running' ? (
          <Button variant="ghost" onClick={stop}>
            {m.tr8_translate_stop()}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={reviewing ? () => setStep('pick') : onClose}>
              {reviewing ? m.common_back() : m.common_cancel()}
            </Button>
            <Button variant="primary" disabled={!targetCv || busy} onClick={submit}>
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      {reviewing && targetCv ? (
        <div className="flex flex-col gap-4 animate-rise-in">
          {provider.isDemo && <DemoTranslateNote />}
          <TranslationReview
            entries={entries}
            state={review}
            onChange={setReview}
            from={fromLanguage}
            to={targetCv.language}
            source={null}
          />
        </div>
      ) : others.length === 0 ? (
        <p className="text-sm text-muted">{m.copy_to_cv_none()}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label={m.copy_to_cv_title()} className="flex flex-col gap-1.5">
            {others.map((cv) => {
              const hasLink = !!linkedOf(cv)
              return (
                <button
                  key={cv.id}
                  type="button"
                  role="radio"
                  aria-checked={target === cv.id}
                  disabled={step === 'running'}
                  onClick={() => setTarget(cv.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    target === cv.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-semibold uppercase">{cv.language}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{cv.name}</span>
                  {hasLink && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Link2 className="size-3.5" />
                      {m.tr8_copy_linked_badge()}
                    </span>
                  )}
                  <Check className={cn('size-4 text-accent transition-opacity', target === cv.id ? 'opacity-100' : 'opacity-0')} />
                </button>
              )
            })}
          </div>

          {languageDiffers && targetCv && (
            <div className="flex flex-col gap-2 animate-fade-in">
              {translatable.length > 0 ? (
                <>
                  <Segmented
                    value={translate ? 'translate' : 'asis'}
                    onChange={(v) => setTranslate(v === 'translate')}
                    aria-label={m.tr8_copy_mode()}
                    stretch
                    options={[
                      { value: 'translate', label: m.tr8_copy_translate() },
                      { value: 'asis', label: m.tr8_copy_as_is() },
                    ]}
                  />
                  {translate && (
                    <p className="text-[13px] text-muted">
                      {targetCv.language === 'en' ? m.tr8_copy_translate_hint_en() : m.tr8_copy_translate_hint_tr()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-muted">{m.tr8_copy_nothing()}</p>
              )}
            </div>
          )}

          {linked && (
            <div className="flex flex-col gap-2 animate-fade-in">
              <p className="text-[12.5px] font-medium text-muted">{m.tr8_copy_linked()}</p>
              <Segmented
                value={linkMode}
                onChange={setLinkMode}
                aria-label={m.tr8_copy_linked()}
                stretch
                options={[
                  { value: 'update', label: m.tr8_copy_update_linked() },
                  { value: 'new', label: m.tr8_copy_add_new() },
                ]}
              />
            </div>
          )}

          {step === 'running' && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted animate-fade-in">
              <Loader2 className="size-4 animate-spin text-accent" />
              {m.tr8_translate_running()}
            </p>
          )}
          {step === 'error' && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {m.tr8_translate_error()}
            </p>
          )}

          <div className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
            <Link2 className="mt-0.5 size-4 shrink-0" />
            <p>{m.tr8_copy_link_note()}</p>
          </div>
        </div>
      )}
    </Dialog>
  )
}
