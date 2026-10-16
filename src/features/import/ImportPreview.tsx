import { Check, ChevronDown, Copy, FileText, FileUp, Info, Loader2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { ImportedCv } from '@/ai/importConvert'
import { formatDateRange, formatYearMonth } from '@/cv/dates'
import { sectionTitle } from '@/cv/locale'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, CvLanguage, Personal, Section } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { ITEM_FIELDS } from '@/features/editor/content/fieldDefs'
import { itemLabel } from '@/features/editor/labels'
import { MAX_PDF_PAGES } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { AiError } from '@/ai/types'
import { aiErrorMessage } from '@/features/ai/aiErrorMessage'
import { importErrorCode, readCvPdf, type ImportErrorCode, type ImportOutcome } from './runImport'

export interface ImportSelection {
  personal: Personal
  sections: Section[]
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string; step: 'pdf' | 'parse' }
  /** detail: yapay zekâ hatasının iletisi (ağ, hız sınırı, parola…) */
  | { kind: 'error'; code: ImportErrorCode; detail?: string }
  | { kind: 'ready'; outcome: ImportOutcome | null }

const ERRORS: Record<ImportErrorCode, { title: () => string; body: () => string }> = {
  not_pdf: { title: () => m.imp_err_not_pdf_title(), body: () => m.imp_err_not_pdf_body() },
  encrypted: { title: () => m.imp_err_encrypted_title(), body: () => m.imp_err_encrypted_body() },
  no_text: { title: () => m.imp_err_no_text_title(), body: () => m.imp_err_no_text_body() },
  unreadable: { title: () => m.imp_err_unreadable_title(), body: () => m.imp_err_unreadable_body() },
  too_large: { title: () => m.imp_err_too_large_title(), body: () => m.imp_err_too_large_body() },
  too_long: { title: () => m.fix_pdf_too_long_title(), body: () => m.fix_pdf_too_long_body({ max: MAX_PDF_PAGES }) },
  parse: { title: () => m.imp_err_parse_title(), body: () => m.imp_err_parse_body() },
}

const languageName = (lang: CvLanguage) => (lang === 'tr' ? m.lang_tr() : m.lang_en())

/**
 * Eski CV'yi içe aktarma: PDF'in metin katmanı tarayıcıda okunur, sağlayıcı
 * (şimdilik kurallı ayrıştırıcı) kayıtlara böler. Tahmin doğrudan
 * kaydedilmez: kullanıcı kayıt kayıt seçer, gerekirse alanları düzeltir.
 */
export function ImportPreview({
  language,
  onChange,
  onLanguageChange,
}: {
  language: CvLanguage
  onChange: (selection: ImportSelection | null) => void
  onLanguageChange?: (language: CvLanguage) => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [data, setData] = useState<ImportedCv | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const read = useCallback(
    async (file: File) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setPhase({ kind: 'reading', fileName: file.name, step: 'pdf' })
      try {
        const outcome = await readCvPdf(file, language, controller.signal, (step) =>
          setPhase({ kind: 'reading', fileName: file.name, step }),
        )
        if (controller.signal.aborted) return
        setData(outcome.imported)
        setExcluded(new Set())
        setPhase({ kind: 'ready', outcome })
      } catch (error) {
        if (controller.signal.aborted) return
        console.warn('[içe aktarma]', error)
        setPhase(
          error instanceof AiError
            ? { kind: 'error', code: 'parse', detail: aiErrorMessage(error, m.imp_err_parse_body()) }
            : { kind: 'error', code: importErrorCode(error) },
        )
      }
    },
    [language],
  )

  const showSample = () => {
    setData({ personal: samplePersonal(language), sections: sampleSections(language) })
    setExcluded(new Set())
    setPhase({ kind: 'ready', outcome: null })
  }

  const reset = () => {
    abortRef.current?.abort()
    setData(null)
    setPhase({ kind: 'idle' })
  }

  useEffect(() => {
    if (phase.kind !== 'ready' || !data) {
      onChange(null)
      return
    }
    const chosen = data.sections
      .map((s) => ({ ...s, items: (s.items as AnyItem[]).filter((i) => !excluded.has(i.id)) }) as Section)
      .filter((s) => s.items.length > 0)
    onChange({ personal: data.personal, sections: chosen })
  }, [phase, data, excluded, onChange])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void read(file)
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      hidden
      data-testid="import-file"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void read(file)
      }}
    />
  )

  if (phase.kind === 'idle') {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-150',
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong',
        )}
      >
        <FileUp className={cn('size-6 transition-colors duration-150', dragging ? 'text-accent' : 'text-faint')} />
        <div>
          <p className="font-medium">{dragging ? m.imp_drop_here() : m.import_pick_title()}</p>
          <p className="mt-0.5 text-sm text-muted">{m.import_pick_body()}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            {m.import_pick_button()}
          </Button>
          <span className="text-sm text-faint">{m.imp_drop_hint()}</span>
        </div>
        <p className="max-w-sm text-xs text-faint">{getAiProvider().isDemo ? m.imp_privacy() : m.imp_privacy_live()}</p>
        <Button variant="ghost" size="sm" onClick={showSample}>
          {m.import_sample_button()}
        </Button>
        {picker}
      </div>
    )
  }

  if (phase.kind === 'reading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-muted" role="status">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          {phase.step === 'pdf' ? m.imp_reading_pdf() : m.imp_parsing()}
        </span>
        <span className="max-w-full truncate text-xs text-faint">{phase.fileName}</span>
        <Button variant="ghost" size="sm" onClick={reset}>
          {m.imp_cancel()}
        </Button>
      </div>
    )
  }

  if (phase.kind === 'error') {
    const error = ERRORS[phase.code]
    return (
      <div className="flex flex-col gap-4 animate-rise-in">
        <div role="alert" className="flex gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 text-[13px]">
            <p className="font-semibold text-text">{error.title()}</p>
            <p className="mt-0.5 text-muted">{phase.detail ?? error.body()}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            {m.imp_try_another()}
          </Button>
          <Button variant="ghost" onClick={showSample}>
            {m.import_sample_button()}
          </Button>
        </div>
        {picker}
      </div>
    )
  }

  if (!data) return null
  const outcome = phase.outcome
  return (
    <ImportReview
      language={language}
      outcome={outcome}
      data={data}
      setData={setData}
      excluded={excluded}
      setExcluded={setExcluded}
      onPickAnother={() => inputRef.current?.click()}
      onLanguageChange={onLanguageChange}
      picker={picker}
    />
  )
}

// ---------------------------------------------------------------- Önizleme

function ImportReview({
  language,
  outcome,
  data,
  setData,
  excluded,
  setExcluded,
  onPickAnother,
  onLanguageChange,
  picker,
}: {
  language: CvLanguage
  outcome: ImportOutcome | null
  data: ImportedCv
  setData: (data: ImportedCv) => void
  excluded: Set<string>
  setExcluded: (fn: (prev: Set<string>) => Set<string>) => void
  onPickAnother: () => void
  onLanguageChange?: (language: CvLanguage) => void
  picker: ReactNode
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const total = data.sections.reduce((n, s) => n + s.items.length, 0)
  const selected = total - excluded.size
  const detected = outcome?.detected
  const sure = detected && detected.confidence >= 0.6
  const mismatch = sure && detected.language !== language

  const toggle = (set: (fn: (prev: Set<string>) => Set<string>) => void, id: string) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const updatePersonal = (key: 'fullName' | 'headline', value: string) =>
    setData({ ...data, personal: { ...data.personal, [key]: value } })

  const updateItem = (sectionId: string, itemId: string, key: string, value: string) =>
    setData({
      ...data,
      sections: data.sections.map((s) =>
        s.id !== sectionId
          ? s
          : ({ ...s, items: (s.items as AnyItem[]).map((i) => (i.id === itemId ? { ...i, [key]: value } : i)) } as Section),
      ),
    })

  const contacts = (
    [
      ['email', m.f_email()],
      ['phone', m.f_phone()],
      ['location', m.f_location()],
      ['linkedin', m.f_linkedin()],
      ['github', m.f_github()],
      ['website', m.f_website()],
    ] as const
  ).filter(([key]) => data.personal[key])

  return (
    <div className="flex flex-col gap-4 animate-rise-in">
      {outcome ? (
        <>
          <div className="flex gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-text">
            <Info className="mt-0.5 size-4 shrink-0 text-muted" />
            <p>{outcome.isDemo ? m.imp_banner_rules() : m.imp_banner_ai()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <FileText className="size-4 shrink-0 text-faint" />
            <span className="min-w-0 truncate text-muted">
              {m.imp_file_meta({ file: outcome.fileName, pages: outcome.pageCount })}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted" data-testid="import-language">
              {sure ? m.imp_detected({ language: languageName(detected.language) }) : m.imp_detected_unsure()}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onPickAnother}>
              {m.imp_try_another()}
            </Button>
          </div>
          {mismatch && (
            <div
              role="status"
              className="flex flex-col gap-2.5 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] sm:flex-row sm:items-center"
            >
              <TriangleAlert className="hidden size-4 shrink-0 text-warn sm:block" />
              <p className="min-w-0 flex-1">
                {m.imp_mismatch({ detected: languageName(detected.language), selected: languageName(language) })}
              </p>
              {onLanguageChange && (
                <Button size="sm" className="self-start sm:self-auto" onClick={() => onLanguageChange(detected.language)}>
                  {detected.language === 'en' ? m.imp_switch_en() : m.imp_switch_tr()}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{m.import_found_sample()}</p>
      )}

      <div className="rounded-xl border border-line">
        <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
          {m.editor_personal_title()}
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={m.f_full_name()}>
              {(id) => <Input id={id} value={data.personal.fullName} onChange={(e) => updatePersonal('fullName', e.target.value)} />}
            </Field>
            <Field label={m.f_headline()}>
              {(id) => <Input id={id} value={data.personal.headline} onChange={(e) => updatePersonal('headline', e.target.value)} />}
            </Field>
          </div>
          {contacts.length > 0 ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]" data-testid="import-contacts">
              {contacts.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 truncate">{data.personal[key]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[13px] text-faint">{m.imp_contacts_none()}</p>
          )}
        </div>
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {outcome && <p className="text-[13px] text-muted">{m.imp_review_hint()}</p>}
          <p className="ml-auto text-xs text-faint tabular-nums">{m.imp_count({ selected, total })}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13px]">
          <p className="font-semibold">{m.imp_none_found_title()}</p>
          <p className="mt-0.5 text-muted">{m.imp_none_found_body()}</p>
        </div>
      )}

      {data.sections.map((section) => (
        <div key={section.id} className="rounded-xl border border-line" data-testid="import-section">
          <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
            {sectionTitle(language, section.type, section.title)}
          </div>
          <ul>
            {(section.items as AnyItem[]).map((item) => (
              <ImportRecord
                key={item.id}
                section={section}
                item={item}
                language={language}
                on={!excluded.has(item.id)}
                expanded={open.has(item.id)}
                onToggle={() => toggle(setExcluded, item.id)}
                onExpand={() => toggle(setOpen, item.id)}
                onField={(key, value) => updateItem(section.id, item.id, key, value)}
              />
            ))}
          </ul>
        </div>
      ))}

      {outcome && <RawText text={outcome.text} defaultOpen={total === 0} />}
      {picker}
    </div>
  )
}

function ImportRecord({
  section,
  item,
  language,
  on,
  expanded,
  onToggle,
  onExpand,
  onField,
}: {
  section: Section
  item: AnyItem
  language: CvLanguage
  on: boolean
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
  onField: (key: string, value: string) => void
}) {
  const it = item as AnyItem & Record<string, unknown>
  const dates =
    'dates' in item ? formatDateRange(item.dates, language) : 'date' in item ? formatYearMonth(item.date, language) : ''
  const fields = section.type === 'summary' ? [] : ITEM_FIELDS[section.type].filter((f) => f.kind !== 'rich' && f.kind !== 'range' && f.kind !== 'month')
  const rich = section.type === 'summary' ? (it.content as string) : ((it.description as string | undefined) ?? '')
  const bulletCount = (rich.match(/<li>/g) ?? []).length
  const panelId = `imp-${item.id}`
  return (
    <li className="border-b border-line last:border-b-0" data-testid="import-record">
      <div className="flex items-center hover:bg-surface-2">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pr-2 pl-4 text-sm">
          <input type="checkbox" className="sr-only" checked={on} onChange={onToggle} />
          <span
            aria-hidden
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150',
              on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong',
            )}
          >
            {on && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className={cn('min-w-0 flex-1 truncate', !on && 'text-faint line-through')}>
            {itemLabel(section.type, item) || m.editor_untitled()}
            {section.type === 'skills' && it.name && it.keywords ? (
              <span className="text-faint"> · {it.keywords as string}</span>
            ) : null}
          </span>
          {bulletCount > 0 && !expanded && (
            <span className="hidden shrink-0 text-xs text-faint sm:inline">{m.imp_bullets({ count: bulletCount })}</span>
          )}
          {dates && <span className="shrink-0 text-xs text-faint tabular-nums">{dates}</span>}
        </label>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? m.imp_fields_hide() : m.imp_fields_show()}
          className="mr-2 rounded-md p-1.5 text-faint transition-colors hover:bg-surface-3 hover:text-text"
        >
          <ChevronDown className={cn('size-4 transition-transform duration-200', expanded && 'rotate-180')} />
        </button>
      </div>
      {expanded && (
        <div id={panelId} className="flex flex-col gap-3 border-t border-line bg-surface-2/50 px-4 py-3 animate-rise-in">
          {fields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <Field key={f.key} label={f.label()} className={f.wide ? 'sm:col-span-2' : undefined}>
                  {(id) => (
                    <Input
                      id={id}
                      value={(it[f.key] as string) ?? ''}
                      placeholder={f.placeholder?.()}
                      onChange={(e) => onField(f.key, e.target.value)}
                    />
                  )}
                </Field>
              ))}
            </div>
          )}
          {rich && (
            <div
              className="text-[13px] leading-relaxed text-muted [&_li]:mt-0.5 [&_p+p]:mt-1.5 [&_p+ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-4"
              // İçerik importConvert'te kaçışlanıp sanitizeRichText'ten geçti
              dangerouslySetInnerHTML={{ __html: rich }}
            />
          )}
        </div>
      )}
    </li>
  )
}

function RawText({ text, defaultOpen }: { text: string; defaultOpen: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Pano izni yoksa kullanıcı metni elle seçebilir
    }
  }
  return (
    <details className="group rounded-xl border border-line" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium select-none hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 -rotate-90 text-faint transition-transform duration-200 group-open:rotate-0" />
        {m.imp_raw_text()}
        <span className="ml-auto hidden text-xs font-normal text-faint sm:inline">{m.imp_raw_hint()}</span>
      </summary>
      <div className="relative border-t border-line">
        <Button variant="secondary" size="sm" className="absolute top-2 right-3" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? m.imp_copied() : m.imp_copy()}
        </Button>
        <pre className="max-h-64 overflow-auto px-4 py-3 pr-28 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted">
          {text}
        </pre>
      </div>
    </details>
  )
}
