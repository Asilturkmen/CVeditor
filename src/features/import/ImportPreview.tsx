import { Check, Copy, FileText, FileUp, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { ImportedCv } from '@/ai/importConvert'
import { formatDateRange, formatYearMonth } from '@/cv/dates'
import { sectionTitle } from '@/cv/locale'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, CvLanguage, Personal, Section } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Disclosure, OutlineRow } from '@/components/ui/Disclosure'
import { DropZone } from '@/components/ui/EmptyState'
import { BareInput } from '@/components/ui/Field'
import { FormRow, Group } from '@/components/ui/Group'
import { InlineNotice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { m } from '@/paraglide/messages'
import { ITEM_FIELDS } from '@/features/editor/content/fieldDefs'
import { itemLabel } from '@/features/editor/labels'
import { MAX_PDF_PAGES } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { AiError } from '@/ai/types'
import { aiErrorMessage } from '@/features/ai/aiErrorMessage'
import { NameMissingNote } from '@/features/ai/AiPayloadDialog'
import { importErrorCode, prepareCvImport, sendCvImport, type ImportErrorCode, type ImportOutcome, type PreparedImport } from './runImport'

export interface ImportSelection {
  personal: Personal
  sections: Section[]
  /** Seçili / bulunan kayıt sayısı (pencerenin eylem satırında: "9/10 kayıt seçili"). */
  count: { selected: number; total: number }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string; step: 'pdf' | 'parse' }
  /** Gerçek sağlayıcı: maskeli metin gösterilir, kullanıcı "Gönder" demeden hiçbir şey gitmez */
  | { kind: 'confirm'; prepared: PreparedImport }
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

function failure(error: unknown): Phase {
  console.warn('[içe aktarma]', error)
  return error instanceof AiError
    ? { kind: 'error', code: 'parse', detail: aiErrorMessage(error, m.imp_err_parse_body()) }
    : { kind: 'error', code: importErrorCode(error) }
}

const languageName = (lang: CvLanguage) => (lang === 'tr' ? m.lang_tr() : m.lang_en())

/**
 * Grupların zemini: beyaz dialogda (`content`) gri dolgulu blok, gri sayfada (`window`) beyaz grup.
 * Her iki durumda da kutu içinde kutu yok; satırlar arası ayırıcıyı grup koyar.
 */
type Surface = 'content' | 'window'
const groupBody = (surface: Surface) => (surface === 'content' ? 'bg-fill-4 shadow-none' : undefined)

/**
 * Eski CV'yi içe aktarma: PDF'in metin katmanı tarayıcıda okunur ve maskelenir
 * (CV İnceleme ile aynı işlev), sağlayıcı kayıtlara böler. Gerçek sağlayıcıda
 * göndermeden önce onay adımı vardır: gidecek metnin tamamı gösterilir, ad
 * bulunamadıysa uyarılır; "Gönder" denmeden hiçbir şey gitmez. Örnek sağlayıcı
 * hiçbir yere göndermediği için doğrudan çalışır. Tahmin doğrudan kaydedilmez:
 * kullanıcı kayıt kayıt seçer, gerekirse alanları düzeltir. Bulunan kayıtlar
 * editördeki anahat satırlarıyla aynı dilde: işaret kutusu, ad, soluk tarih; açılınca alanlar.
 */
export function ImportPreview({
  language,
  onChange,
  onLanguageChange,
  surface = 'content',
}: {
  language: CvLanguage
  onChange: (selection: ImportSelection | null) => void
  onLanguageChange?: (language: CvLanguage) => void
  /** Bileşenin durduğu yüzey: dialog (`content`, varsayılan) ya da gri sayfa (`window`). */
  surface?: Surface
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [data, setData] = useState<ImportedCv | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(async (prepared: PreparedImport) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'reading', fileName: prepared.fileName, step: 'parse' })
    try {
      const outcome = await sendCvImport(prepared, controller.signal)
      if (controller.signal.aborted) return
      setData(outcome.imported)
      setExcluded(new Set())
      setPhase({ kind: 'ready', outcome })
    } catch (error) {
      if (!controller.signal.aborted) setPhase(failure(error))
    }
  }, [])

  const read = useCallback(
    async (file: File) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setPhase({ kind: 'reading', fileName: file.name, step: 'pdf' })
      let prepared: PreparedImport
      try {
        prepared = await prepareCvImport(file, language, controller.signal, (step) =>
          setPhase({ kind: 'reading', fileName: file.name, step }),
        )
      } catch (error) {
        if (!controller.signal.aborted) setPhase(failure(error))
        return
      }
      if (controller.signal.aborted) return
      // Gerçek sağlayıcıda metin kullanıcı onaylamadan gitmez.
      if (!getAiProvider().isDemo) setPhase({ kind: 'confirm', prepared })
      else await send(prepared)
    },
    [language, send],
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
    const total = data.sections.reduce((n, s) => n + s.items.length, 0)
    const selected = chosen.reduce((n, s) => n + s.items.length, 0)
    onChange({ personal: data.personal, sections: chosen, count: { selected, total } })
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
      <DropZone
        active={dragging}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        // Dinlenmede çerçevesiz ve zeminsiz (boş durum gibi); kesikli kenar yalnız sürüklerken.
        className="flex flex-col items-center bg-transparent px-6 py-8 text-center"
      >
        <FileUp aria-hidden strokeWidth={1.5} className={dragging ? 'size-8 text-accent' : 'size-8 text-fg-3'} />
        <p className="mt-3 text-headline text-fg">{dragging ? m.imp_drop_here() : m.import_pick_title()}</p>
        <p className="mt-1 max-w-90 text-body text-fg-2">{m.import_pick_body()}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <Button size="lg" variant="primary" onClick={() => inputRef.current?.click()}>
            {m.import_pick_button()}
          </Button>
          <span className="text-body text-fg-2">{m.imp_drop_hint()}</span>
        </div>
        <p className="mt-4 max-w-[26rem] text-callout text-fg-2">{getAiProvider().isDemo ? m.imp_privacy() : m.imp_privacy_live()}</p>
        <Button variant="plain" className="mt-2" onClick={showSample}>
          {m.import_sample_button()}
        </Button>
        {picker}
      </DropZone>
    )
  }

  if (phase.kind === 'reading') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center" role="status">
        <span className="flex items-center gap-2 text-body text-fg">
          <Spinner />
          {phase.step === 'pdf' ? m.imp_reading_pdf() : m.imp_parsing()}
        </span>
        <span className="max-w-full text-callout break-all text-fg-2">{phase.fileName}</span>
        <Button className="mt-2" onClick={reset}>
          {m.imp_cancel()}
        </Button>
      </div>
    )
  }

  if (phase.kind === 'confirm') {
    return <ImportConfirm prepared={phase.prepared} onSend={() => void send(phase.prepared)} onCancel={reset} />
  }

  if (phase.kind === 'error') {
    const error = ERRORS[phase.code]
    return (
      <div className="flex animate-rise-in flex-col gap-4">
        <div role="alert">
          <InlineNotice tone="danger">
            <span className="block font-semibold">{error.title()}</span>
            <span className="mt-0.5 block text-fg-2">{phase.detail ?? error.body()}</span>
          </InlineNotice>
        </div>
        <div className="flex flex-wrap gap-2 pl-6">
          <Button size="lg" variant="primary" onClick={() => inputRef.current?.click()}>
            {m.imp_try_another()}
          </Button>
          <Button size="lg" onClick={showSample}>
            {m.import_sample_button()}
          </Button>
        </div>
        {picker}
      </div>
    )
  }

  if (!data) return null
  return (
    <ImportReview
      language={language}
      outcome={phase.outcome}
      data={data}
      setData={setData}
      excluded={excluded}
      setExcluded={setExcluded}
      onPickAnother={() => inputRef.current?.click()}
      onLanguageChange={onLanguageChange}
      picker={picker}
      surface={surface}
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
  surface,
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
  surface: Surface
}) {
  const [open, setOpen] = useState<string | null>(null)
  const total = data.sections.reduce((n, s) => n + s.items.length, 0)
  const detected = outcome?.detected
  const sure = detected && detected.confidence >= 0.6
  const mismatch = sure && detected.language !== language

  const toggleExcluded = (id: string) =>
    setExcluded((prev) => {
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
    <div className="flex animate-rise-in flex-col gap-5">
      {outcome ? (
        <div className="flex flex-col gap-3">
          <InlineNotice tone="info">
            {outcome.isDemo ? m.imp_banner_rules() : m.imp_banner_ai()}
            {outcome.dropped > 0 && <> {m.imp_dropped({ count: outcome.dropped })}</>}
          </InlineNotice>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
            <FileText aria-hidden className="size-4 shrink-0 text-fg-2" />
            <span className="min-w-0 break-all text-fg">{m.imp_file_meta({ file: outcome.fileName, pages: outcome.pageCount })}</span>
            <span aria-hidden className="text-fg-3">
              ·
            </span>
            <span className="text-fg-2" data-testid="import-language">
              {sure ? m.imp_detected({ language: languageName(detected.language) }) : m.imp_detected_unsure()}
            </span>
            <Button variant="plain" className="ml-auto -mr-3" onClick={onPickAnother}>
              {m.imp_try_another()}
            </Button>
          </div>
          {mismatch && (
            <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <InlineNotice tone="warn" className="min-w-0 flex-1 basis-64">
                {m.imp_mismatch({ detected: languageName(detected.language), selected: languageName(language) })}
              </InlineNotice>
              {onLanguageChange && (
                <Button onClick={() => onLanguageChange(detected.language)}>
                  {detected.language === 'en' ? m.imp_switch_en() : m.imp_switch_tr()}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-body text-fg-2">{m.import_found_sample()}</p>
      )}

      {/* Tek ritim: ad, unvan ve her iletişim satırı aynı 40px satır (etiket 120px, değer alanın x'inde), ayırıcılı. */}
      <div data-testid="import-contacts">
        <Group title={m.editor_personal_title()} bodyClassName={groupBody(surface)}>
          <FormRow label={m.f_full_name()}>
            {(id) => <BareInput id={id} value={data.personal.fullName} onChange={(e) => updatePersonal('fullName', e.target.value)} />}
          </FormRow>
          <FormRow label={m.f_headline()}>
            {(id) => <BareInput id={id} value={data.personal.headline} onChange={(e) => updatePersonal('headline', e.target.value)} />}
          </FormRow>
          {contacts.length > 0 ? (
            contacts.map(([key, label]) => (
              // Dar ekranda (telefon) etiket değerin üstüne geçer (FormRow gibi): e-posta kırılmasın.
              <div
                key={key}
                className="grid min-h-10 grid-cols-[120px_minmax(0,1fr)] items-center gap-x-3 px-[var(--row-px)] py-1 text-body max-sm:grid-cols-1 max-sm:gap-y-1"
              >
                <span className="break-words text-fg-2 max-sm:px-2">{label}</span>
                <span className="flex min-h-8 min-w-0 items-center px-2 text-fg wrap-anywhere phone:min-h-11">{data.personal[key]}</span>
              </div>
            ))
          ) : (
            <p className="flex min-h-10 items-center px-[var(--row-px)] py-1 text-body text-fg-2">{m.imp_contacts_none()}</p>
          )}
        </Group>
      </div>

      {total > 0 ? (
        // Seçili kayıt sayısı pencerenin eylem satırında ("9/10 kayıt seçili · CV'yi oluştur").
        outcome && <p className="px-3 text-callout text-fg-2">{m.imp_review_hint()}</p>
      ) : (
        <InlineNotice tone="warn">
          <span className="block font-semibold">{m.imp_none_found_title()}</span>
          <span className="mt-0.5 block text-fg-2">{m.imp_none_found_body()}</span>
        </InlineNotice>
      )}

      {data.sections.map((section) => (
        <div key={section.id} data-testid="import-section">
          <Group title={sectionTitle(language, section.type, section.title)} count={section.items.length} bodyClassName={groupBody(surface)}>
            {(section.items as AnyItem[]).map((item) => (
              <ImportRecord
                key={item.id}
                section={section}
                item={item}
                language={language}
                on={!excluded.has(item.id)}
                expanded={open === item.id}
                onToggle={() => toggleExcluded(item.id)}
                onExpand={(next) => setOpen(next ? item.id : null)}
                onField={(key, value) => updateItem(section.id, item.id, key, value)}
              />
            ))}
          </Group>
        </div>
      ))}

      {outcome && <RawText text={outcome.text} defaultOpen={total === 0} />}
      {picker}
    </div>
  )
}

/**
 * Bulunan kayıt: editördeki anahat satırı (`OutlineRow`) — solda işaret kutusu, ad, soluk
 * "N madde · tarih"; satıra tıklayınca yerinde açılır (bir anda tek kayıt), alanlar düzeltilebilir.
 * İşareti kalkan kayıt üstü çizili görünür (CV'ye girmeyecek).
 */
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
  onExpand: (open: boolean) => void
  onField: (key: string, value: string) => void
}) {
  const it = item as AnyItem & Record<string, unknown>
  const dates =
    'dates' in item ? formatDateRange(item.dates, language) : 'date' in item ? formatYearMonth(item.date, language) : ''
  const fields =
    section.type === 'summary' ? [] : ITEM_FIELDS[section.type].filter((f) => f.kind !== 'rich' && f.kind !== 'range' && f.kind !== 'month')
  const rich = section.type === 'summary' ? (it.content as string) : ((it.description as string | undefined) ?? '')
  const bulletCount = (rich.match(/<li>/g) ?? []).length
  const label = itemLabel(section.type, item) || m.editor_untitled()
  const meta = [
    section.type === 'skills' && it.name && it.keywords ? (it.keywords as string) : null,
    bulletCount > 0 ? m.imp_bullets({ count: bulletCount }) : null,
    dates || null,
  ].filter(Boolean)
  return (
    <div data-testid="import-record">
      <OutlineRow
        open={expanded}
        onOpenChange={onExpand}
        hidden={!on}
        leading={
          <span className="flex h-11 items-center pr-1 pl-3">
            <Checkbox checked={on} onCheckedChange={onToggle} aria-label={m.imp_include_label({ label })} />
          </span>
        }
        title={label}
        meta={meta.length > 0 ? <span className="tabular-nums">{meta.join(' · ')}</span> : undefined}
      >
        <div className="flex flex-col">
          {fields.map((f) => (
            <FormRow key={f.key} label={f.label()}>
              {(id) => (
                <BareInput
                  id={id}
                  value={(it[f.key] as string) ?? ''}
                  placeholder={f.placeholder?.()}
                  onChange={(e) => onField(f.key, e.target.value)}
                />
              )}
            </FormRow>
          ))}
          {rich && (
            <div
              className="px-[var(--row-px)] pt-2 text-body break-words text-fg-2 [&_li]:mt-0.5 [&_p+p]:mt-1.5 [&_p+ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-4"
              // Alanlı kayıtta değer sütununda, özette (alansız) ad hizasında
              style={{ paddingLeft: fields.length ? 'calc(var(--row-px) + 132px)' : 'calc(var(--row-px) + 50px)' }}
              // İçerik importConvert'te kaçışlanıp sanitizeRichText'ten geçti
              dangerouslySetInnerHTML={{ __html: rich }}
            />
          )}
        </div>
      </OutlineRow>
    </div>
  )
}

/**
 * Gerçek sağlayıcıda gönderim onayı: yapay zekâya gidecek metnin tamamı (maskeli)
 * olduğu gibi gösterilir. Ad güvenle bulunamadıysa uyarılır. "Gönder" denmeden
 * hiçbir şey gitmez; "Vazgeç" dosya seçimine döner.
 */
function ImportConfirm({ prepared, onSend, onCancel }: { prepared: PreparedImport; onSend: () => void; onCancel: () => void }) {
  return (
    <div className="flex animate-rise-in flex-col gap-4" data-testid="import-confirm">
      <p className="flex items-start gap-2 text-body text-fg">
        <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-fg-2" />
        <span className="min-w-0">
          <span className="block font-semibold">{m.imp_confirm_title()}</span>
          <span className="mt-0.5 block text-fg-2">{m.imp_confirm_body()}</span>
        </span>
      </p>
      {!prepared.masking.nameFound && <NameMissingNote className="mt-0">{m.imp_name_missing()}</NameMissingNote>}
      <p className="flex flex-wrap items-center gap-2 text-body text-fg">
        <FileText aria-hidden className="size-4 shrink-0 text-fg-2" />
        <span className="min-w-0 break-all">{m.imp_file_meta({ file: prepared.fileName, pages: prepared.pageCount })}</span>
      </p>
      <pre
        data-testid="import-send-text"
        aria-label={m.imp_confirm_text_label()}
        tabIndex={0}
        className="max-h-72 overflow-auto rounded-xl bg-fill-4 px-4 py-3 font-mono text-callout break-words whitespace-pre-wrap text-fg"
      >
        {prepared.request.text}
      </pre>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="lg" onClick={onCancel}>
          {m.common_cancel()}
        </Button>
        <Button size="lg" variant="primary" onClick={onSend}>
          {m.imp_confirm_send()}
        </Button>
      </div>
    </div>
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
    <Disclosure summary={m.imp_raw_text()} defaultOpen={defaultOpen} className="[&>button]:ml-2">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3">
          <p className="text-callout text-fg-2">{m.imp_raw_hint()}</p>
          <Button size="sm" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? m.imp_copied() : m.imp_copy()}
          </Button>
        </div>
        <pre className="max-h-64 overflow-auto rounded-xl bg-fill-4 px-4 py-3 font-mono text-callout break-words whitespace-pre-wrap text-fg">
          {text}
        </pre>
      </div>
    </Disclosure>
  )
}
