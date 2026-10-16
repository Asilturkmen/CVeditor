import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, FileText, Loader2, Upload } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { extractPdfText, MAX_PDF_BYTES, PdfTextError, type PdfText } from '@/ai/pdfText'
import { migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { allCvs } from '@/db/repo'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { getTemplate } from '@/render/templates'
import { TEMPLATE_TEXT } from '@/features/templates/TemplatesPage'
import { matchJobAd } from '@/review/keywords'
import { pdfErrorFinding, reviewCv, reviewPdfText, type Finding } from '@/review/rules'
import { cvPlainText } from '@/review/text'
import { FindingGroups, SeverityCounts } from './FindingList'
import { KeywordPanel } from './KeywordPanel'
import { openInEditor } from './openInEditor'

const AD_KEY = 'cveditor:reviewAd'

function readAd(): string {
  try {
    return sessionStorage.getItem(AD_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Açılır-kapanır bölüm: yükseklik geçişi (grid 0fr → 1fr), kapalıyken içerik odak almaz. */
function Collapsible({
  title,
  aside,
  open,
  onOpenChange,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => onOpenChange(!open)}
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-[15px] font-semibold tracking-tight"
        >
          <ChevronRight
            aria-hidden
            className={cn('size-4 shrink-0 text-muted transition-transform duration-200 ease-[var(--ease-out-soft)]', open && 'rotate-90')}
          />
          <span className="flex-1">{title}</span>
          {aside}
        </button>
      </h2>
      <div
        id={id}
        inert={!open}
        className="grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out-soft)]"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

type PdfState =
  | { status: 'idle' }
  | { status: 'reading'; name: string }
  | { status: 'ready'; name: string; pdf: PdfText }
  | { status: 'error'; name: string; finding: Finding }

function PdfSource({ state, onFile }: { state: PdfState; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const pick = () => input.current?.click()

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
    >
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label={m.rv_drop_button()}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      {state.status === 'idle' ? (
        <div
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors duration-150',
            dragging ? 'border-accent bg-accent-soft' : 'border-line-strong',
          )}
        >
          <Upload className="size-5 text-muted" aria-hidden />
          <p className="text-sm font-medium">{m.rv_drop_title()}</p>
          <Button size="sm" onClick={pick}>
            {m.rv_drop_button()}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-150',
            dragging ? 'border-accent bg-accent-soft' : 'border-line',
          )}
        >
          {state.status === 'reading' ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
          ) : (
            <FileText className="size-4 shrink-0 text-muted" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium break-all">{state.name}</p>
            <p className="text-[13px] text-muted" role="status">
              {state.status === 'reading'
                ? m.rv_pdf_reading()
                : state.status === 'ready'
                  ? m.rv_pdf_pages({ pages: state.pdf.pageCount })
                  : state.finding.title}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={pick} disabled={state.status === 'reading'}>
            {m.rv_pdf_replace()}
          </Button>
        </div>
      )}
      <p className="mt-2 text-[13px] text-muted">{m.rv_drop_hint()}</p>
    </div>
  )
}

function MyCvSource({
  cvs,
  cv,
  onSelect,
  onPageCount,
}: {
  cvs: Cv[]
  cv: Cv | null
  onSelect: (id: string) => void
  onPageCount: (count: number) => void
}) {
  const pages = useRef('')
  const [pageCount, setPageCount] = useState(0)
  if (!cvs.length) {
    return (
      <p className="text-sm text-muted">
        {m.rv_no_cvs()}{' '}
        <Link to="/sablonlar" className="font-medium text-accent hover:underline">
          {m.rv_no_cvs_link()}
        </Link>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <Field label={m.rv_select_label()}>
        {(id) => (
          <Select id={id} value={cv?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
            {!cv && (
              <option value="" disabled>
                {m.rv_select_placeholder()}
              </option>
            )}
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.language.toUpperCase()})
              </option>
            ))}
          </Select>
        )}
      </Field>
      {cv && (
        <div className="flex items-start gap-3">
          <Link
            to="/editor/$cvId"
            params={{ cvId: cv.id }}
            aria-label={m.rv_open_editor()}
            className="relative block aspect-[210/297] w-[84px] shrink-0 overflow-hidden rounded-md border border-line bg-canvas transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-md"
          >
            <CvFrame
              cv={cv}
              scale="fit"
              fitPadding={0}
              firstPageOnly
              className="pointer-events-none absolute inset-0"
              title={cv.name}
              onResult={(r) => {
                const key = `${cv.id}:${r.pageCount}`
                if (key === pages.current) return
                pages.current = key
                setPageCount(r.pageCount)
                onPageCount(r.pageCount)
              }}
            />
          </Link>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium break-words">{cv.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
              <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-semibold tracking-wide text-text uppercase">
                {cv.language}
              </span>
              <span>{TEMPLATE_TEXT[getTemplate(cv.templateId).id].name()}</span>
              {pageCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{m.page_count({ count: pageCount })}</span>
                </>
              )}
            </p>
            <Link
              to="/editor/$cvId"
              params={{ cvId: cv.id }}
              className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline"
            >
              {m.rv_open_editor()}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/** "ATS'nin gördüğü metin": PDF'ten okunan satırlar, okunma sırasıyla, sayfa sayfa. */
function ExtractedText({ pdf }: { pdf: PdfText }) {
  const pages = useMemo(() => {
    const byPage = new Map<number, string[]>()
    for (const l of pdf.lines) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l.text])
    return [...byPage.entries()]
  }, [pdf])
  return (
    <>
      <p className="mb-3 text-[13px] text-muted">{m.rv_text_hint()}</p>
      <div
        tabIndex={0}
        aria-label={m.rv_text_title()}
        data-testid="ats-text"
        className="max-h-[28rem] overflow-auto rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed"
      >
        {pages.map(([page, lines]) => (
          <div key={page}>
            {pdf.pageCount > 1 && (
              <p className="my-2 font-sans text-[11px] font-semibold tracking-wide text-muted uppercase first:mt-0">
                {m.rv_text_page({ page })}
              </p>
            )}
            {lines.map((line, i) => (
              <p key={i} className="break-words whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function ReviewPage() {
  const search = useSearch({ strict: false }) as { cv?: string }
  const navigate = useNavigate()
  const [mode, setMode] = useState<'mine' | 'pdf'>('mine')
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [ad, setAd] = useState(readAd)
  const [adOpen, setAdOpen] = useState(() => readAd().trim() !== '')
  const [textOpen, setTextOpen] = useState(false)
  const [showPassed, setShowPassed] = useState(true)
  const [pages, setPages] = useState<{ cvId: string; count: number } | null>(null)
  const deferredAd = useDeferredValue(ad)
  const readToken = useRef(0)
  const readAbort = useRef<AbortController | null>(null)
  useEffect(() => () => readAbort.current?.abort(), [])

  const cvs = useLiveQuery(allCvs)
  const selectedId = search.cv ?? cvs?.[0]?.id
  const raw = useLiveQuery(() => (selectedId ? db.cvs.get(selectedId) : undefined), [selectedId])
  const cv = useMemo(() => {
    if (!raw) return null
    try {
      return migrateCv(raw)
    } catch {
      return null
    }
  }, [raw])

  useEffect(() => {
    try {
      if (ad.trim()) sessionStorage.setItem(AD_KEY, ad)
      else sessionStorage.removeItem(AD_KEY)
    } catch {
      // yalnız bu sayfada kalır
    }
  }, [ad])

  const onFile = async (file: File) => {
    const token = ++readToken.current
    // Önceki dosyanın okunması sürüyorsa bırakılır (sayfa sayfa denetlenir).
    readAbort.current?.abort()
    const controller = new AbortController()
    readAbort.current = controller
    setTextOpen(false)
    if (file.size > MAX_PDF_BYTES) {
      setPdfState({ status: 'error', name: file.name, finding: pdfErrorFinding('too_large') })
      return
    }
    setPdfState({ status: 'reading', name: file.name })
    try {
      const pdf = await extractPdfText(await file.arrayBuffer(), { signal: controller.signal })
      if (token === readToken.current) setPdfState({ status: 'ready', name: file.name, pdf })
    } catch (error) {
      if (token !== readToken.current || controller.signal.aborted) return
      const code = error instanceof PdfTextError ? error.code : 'unreadable'
      setPdfState({ status: 'error', name: file.name, finding: pdfErrorFinding(code) })
    }
  }

  // Sayfa sayısı önizleme çizilince gelir; başka CV seçilince eskisi kullanılmaz.
  const pageCount = pages && pages.cvId === cv?.id ? pages.count : undefined

  const findings = useMemo<Finding[] | null>(() => {
    if (mode === 'mine') return cv ? reviewCv(cv, { pageCount }) : null
    if (pdfState.status === 'ready') return reviewPdfText(pdfState.pdf)
    if (pdfState.status === 'error') return [pdfState.finding]
    return null
  }, [mode, cv, pageCount, pdfState])

  const sourceText =
    mode === 'mine' ? (cv ? cvPlainText(cv) : null) : pdfState.status === 'ready' ? pdfState.pdf.text : null
  const match = useMemo(
    () => (deferredAd.trim() && sourceText != null ? matchJobAd(deferredAd, sourceText, cv?.language ?? 'tr') : null),
    [deferredAd, sourceText, cv?.language],
  )

  const sourceKey = mode === 'mine' ? `cv-${cv?.id ?? ''}` : `pdf-${pdfState.status === 'ready' ? pdfState.name : pdfState.status}`

  return (
    <div className="animate-fade-in">
      <header className="mb-8 max-w-[680px]">
        <h1 className="text-2xl font-semibold tracking-tight">{m.rv_title()}</h1>
        <p className="mt-1.5 text-muted">{m.rv_intro()}</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="rv-source" className="rounded-xl border border-line bg-surface p-4">
            <h2 id="rv-source" className="mb-3 text-[15px] font-semibold tracking-tight">
              {m.rv_source_title()}
            </h2>
            <Segmented
              value={mode}
              onChange={setMode}
              stretch
              aria-label={m.rv_source_title()}
              className="mb-4"
              options={[
                { value: 'mine', label: m.rv_source_mine() },
                { value: 'pdf', label: m.rv_source_pdf() },
              ]}
            />
            {mode === 'mine' ? (
              cvs && (
                <MyCvSource
                  cvs={cvs}
                  cv={cv}
                  onSelect={(id) => void navigate({ to: '/inceleme', search: { cv: id }, replace: true })}
                  onPageCount={(count) => cv && setPages({ cvId: cv.id, count })}
                />
              )
            ) : (
              <PdfSource state={pdfState} onFile={(file) => void onFile(file)} />
            )}
          </section>

          <Collapsible
            open={adOpen}
            onOpenChange={setAdOpen}
            title={
              <>
                {m.rv_ad_title()} <span className="text-[13px] font-normal text-muted">({m.rv_ad_optional()})</span>
              </>
            }
          >
            <Field label={m.rv_ad_label()} hint={m.rv_ad_hint()}>
              {(id) => (
                <Textarea
                  id={id}
                  rows={9}
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  placeholder={m.rv_ad_placeholder()}
                  className="resize-y"
                />
              )}
            </Field>
          </Collapsible>
        </div>

        <div className="min-w-0" aria-live="polite">
          {!findings ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
              <h2 className="text-[15px] font-semibold tracking-tight">{m.rv_empty_title()}</h2>
              <p className="max-w-sm text-sm text-muted">{m.rv_empty_body()}</p>
            </div>
          ) : (
            <div key={sourceKey} className="flex flex-col gap-6 animate-[rise-in_220ms_var(--ease-out-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <SeverityCounts findings={findings} />
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                  <Switch checked={showPassed} onCheckedChange={setShowPassed} aria-label={m.rv_show_passed()} />
                  {m.rv_show_passed()}
                </label>
              </div>

              {match && <KeywordPanel match={match} />}

              <FindingGroups
                findings={findings}
                showPassed={showPassed}
                onEdit={mode === 'mine' && cv ? (target) => openInEditor(navigate, cv.id, target) : undefined}
              />

              {mode === 'pdf' && pdfState.status === 'ready' && (
                <Collapsible open={textOpen} onOpenChange={setTextOpen} title={m.rv_text_title()}>
                  <ExtractedText pdf={pdfState.pdf} />
                </Collapsible>
              )}

              <section aria-labelledby="rv-ai" className="rounded-xl border border-dashed border-line-strong px-4 py-3.5">
                <h2 id="rv-ai" className="text-[15px] font-semibold tracking-tight">
                  {m.rv_ai_title()}
                </h2>
                <p className="mt-1 text-[13px] text-muted">{m.rv_ai_body()}</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
