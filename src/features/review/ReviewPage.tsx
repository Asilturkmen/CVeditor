import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, FileSearch, FileText } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { extractPdfText, flowRows, MAX_PDF_BYTES, PdfTextError, type PdfText } from '@/ai/pdfText'
import { migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { allCvs } from '@/db/repo'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { Disclosure } from '@/components/ui/Disclosure'
import { DropZone, EmptyState } from '@/components/ui/EmptyState'
import { BareTextarea, Select } from '@/components/ui/Field'
import { FormRow, Group } from '@/components/ui/Group'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { m } from '@/paraglide/messages'
import type { ReadingText } from '@/render/atsText'
import { CvFrame } from '@/render/CvFrame'
import { getTemplate } from '@/render/templates'
import { TEMPLATE_TEXT } from '@/features/templates/templateText'
import { matchJobAd } from '@/review/keywords'
import { pdfErrorFinding, reviewCv, reviewPdfText, type Finding } from '@/review/rules'
import { cvPlainText } from '@/review/text'
import { FindingGroups, SeverityCounts } from './FindingList'
import { KeywordPanel } from './KeywordPanel'
import { openInEditor } from './openInEditor'
import { ReviewAiCard } from './ReviewAiCard'

const AD_KEY = 'cveditor:reviewAd'

function readAd(): string {
  try {
    return sessionStorage.getItem(AD_KEY) ?? ''
  } catch {
    return ''
  }
}

type PdfState =
  | { status: 'idle' }
  | { status: 'reading'; name: string }
  // file: her seçilen dosyada artar (aynı adla yeniden yüklenen dosya da ayrı kaynaktır)
  | { status: 'ready'; name: string; file: number; pdf: PdfText }
  | { status: 'error'; name: string; file: number; finding: Finding }

/** Kaynak çubuğundaki PDF yuvası: bırakma hedefi (sürüklerken vurgulu), dosya adı ve durumu, değiştir. */
function PdfSource({ state, onFile }: { state: PdfState; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const pick = () => input.current?.click()

  return (
    <DropZone
      active={dragging}
      className="flex min-h-11 min-w-0 flex-1 basis-72 items-center gap-3 px-3 py-2"
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
      {state.status === 'reading' ? <Spinner size={16} className="text-fg-2" /> : <FileText className="size-4 shrink-0 text-fg-2" aria-hidden />}
      {state.status === 'idle' ? (
        <p className="min-w-0 flex-1 text-body text-fg">{m.rv_drop_title()}</p>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium break-all text-fg">{state.name}</p>
          <p className="text-callout text-fg-2" role="status">
            {state.status === 'reading'
              ? m.rv_pdf_reading()
              : state.status === 'ready'
                ? m.rv_pdf_pages({ pages: state.pdf.pageCount })
                : state.finding.title}
          </p>
        </div>
      )}
      <Button onClick={pick} disabled={state.status === 'reading'}>
        {state.status === 'idle' ? m.rv_drop_button() : m.rv_pdf_replace()}
      </Button>
    </DropZone>
  )
}

/**
 * Kendi CV'n: açılır listede seçilir; yanında küçük resim (ilk sayfa) ve "dil · şablon · sayfa".
 * Küçük resim yalnız ilk sayfayı gösterir ama bütün sayfalar çizilir: sayfa sayısı ve ATS metni
 * buradan gelir.
 */
function MyCvSource({
  cvs,
  cv,
  onSelect,
  onPageCount,
  onReadingText,
}: {
  cvs: Cv[]
  cv: Cv | null
  onSelect: (id: string) => void
  onPageCount: (count: number) => void
  onReadingText: (text: ReadingText) => void
}) {
  const pages = useRef('')
  const [pageCount, setPageCount] = useState(0)
  const selectId = useId()
  if (!cvs.length) {
    return (
      <p className="min-w-0 flex-1 basis-72 text-body text-fg">
        {m.rv_no_cvs()}{' '}
        <Link to="/sablonlar" className="text-accent hover:underline">
          {m.rv_no_cvs_link()}
        </Link>
      </p>
    )
  }
  return (
    <>
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
        <label htmlFor={selectId} className="shrink-0 text-body text-fg-2">
          {m.rv_select_label()}
        </label>
        <Select id={selectId} controlSize="sm" className="min-w-0 flex-1" value={cv?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
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
      </div>
      {cv && (
        <div className="flex min-w-0 flex-1 basis-72 items-center gap-3">
          <div
            aria-hidden
            className="relative aspect-[210/297] w-9 shrink-0 overflow-hidden rounded-xs bg-paper shadow-thumb"
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
              onReadingText={onReadingText}
            />
          </div>
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-callout text-fg-2">
            <Badge className="uppercase">{cv.language}</Badge>
            <span>{TEMPLATE_TEXT[getTemplate(cv.templateId).id].name()}</span>
            {pageCount > 0 && (
              <>
                <span aria-hidden className="text-fg-3">
                  ·
                </span>
                <span className="tabular-nums">{m.page_count({ count: pageCount })}</span>
              </>
            )}
          </p>
          <Link
            to="/editor/$cvId"
            params={{ cvId: cv.id }}
            className={buttonClass({ variant: 'plain', className: '-mr-2 gap-0.5 pr-1.5' })}
          >
            {m.rv_open_editor()}
            <ChevronRight aria-hidden />
          </Link>
        </div>
      )}
    </>
  )
}

/**
 * "ATS'nin gördüğü metin", okunma sırasıyla, sayfa sayfa: yüklenen PDF'te
 * içerik akışının ham sırası (sütunlar karışıyorsa burada da karışık görünür;
 * `PdfText.flow`), kendi CV'nde basılacak metin (src/render/atsText.ts).
 */
function ExtractedText({ pdf, hint }: { pdf: PdfText | ReadingText; hint: string }) {
  const pages = useMemo(() => {
    const byPage = new Map<number, string[]>()
    const lines = 'flow' in pdf && pdf.flow ? flowRows(pdf.flow) : pdf.lines
    for (const l of lines) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l.text])
    return [...byPage.entries()]
  }, [pdf])
  return (
    <div className="flex flex-col gap-2">
      <p className="px-4 text-callout text-fg-2">{hint}</p>
      <div
        tabIndex={0}
        aria-label={m.rv_text_title()}
        data-testid="ats-text"
        className="max-h-[28rem] overflow-auto rounded-xl bg-content px-4 py-3 font-mono text-callout text-fg shadow-1"
      >
        {pages.map(([page, lines]) => (
          <div key={page}>
            {pdf.pageCount > 1 && (
              <p className="mt-3 mb-1 font-sans text-headline text-fg-2 first:mt-0">{m.rv_text_page({ page })}</p>
            )}
            {lines.map((line, i) => (
              <p key={i} className="break-words whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * CV İnceleme. Üstte tek satırlık kaynak çubuğu (kendi CV'n ya da PDF); altında geniş solda sonuç
 * (önce düzeltilecekler, geçenler kapalı satırda, ATS metni) ve iş ilanı (hep açık, anahtar kelime
 * karşılaştırmasıyla), dar sağda yapay zekâ yorumu. Dar ekranda tek sütun.
 */
export function ReviewPage() {
  const search = useSearch({ strict: false }) as { cv?: string }
  const navigate = useNavigate()
  const [mode, setMode] = useState<'mine' | 'pdf'>('mine')
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'idle' })
  const [ad, setAd] = useState(readAd)
  const [textOpen, setTextOpen] = useState(false)
  const [pages, setPages] = useState<{ cvId: string; count: number } | null>(null)
  const [cvText, setCvText] = useState<{ cvId: string; text: ReadingText } | null>(null)
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
      setPdfState({ status: 'error', name: file.name, file: token, finding: pdfErrorFinding('too_large') })
      return
    }
    setPdfState({ status: 'reading', name: file.name })
    try {
      const pdf = await extractPdfText(await file.arrayBuffer(), { signal: controller.signal })
      if (token === readToken.current) setPdfState({ status: 'ready', name: file.name, file: token, pdf })
    } catch (error) {
      if (token !== readToken.current || controller.signal.aborted) return
      const code = error instanceof PdfTextError ? error.code : 'unreadable'
      setPdfState({ status: 'error', name: file.name, file: token, finding: pdfErrorFinding(code) })
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

  // Kaynak değişince (başka CV, başka dosya) sonuç alanı yeniden kurulur: yapay zekâ sonuçları eski kaynaktan kalmaz.
  const sourceKey =
    mode === 'mine' ? `cv-${cv?.id ?? ''}` : `pdf-${pdfState.status === 'ready' || pdfState.status === 'error' ? pdfState.file : pdfState.status}`
  const readyPdf = mode === 'pdf' && pdfState.status === 'ready' ? pdfState.pdf : null
  const mineCv = mode === 'mine' ? cv : null
  const edit = mode === 'mine' && cv ? (target: Parameters<typeof openInEditor>[2]) => openInEditor(navigate, cv.id, target) : undefined
  const atsText = readyPdf
    ? { pdf: readyPdf as PdfText | ReadingText, hint: m.rv_text_hint() }
    : mineCv && cvText?.cvId === mineCv.id
      ? { pdf: cvText.text, hint: m.rv_text_hint_cv() }
      : null

  return (
    <div className="animate-fade-in pb-12">
      <header className="mb-8 max-w-[680px]">
        <h1 className="text-title-lg text-fg">{m.rv_title()}</h1>
        <p className="mt-1 text-body text-fg-2">{m.rv_intro()}</p>
      </header>

      <Group title={m.rv_source_title()} inset="lg" footer={mode === 'pdf' ? m.rv_drop_hint() : undefined}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-[var(--row-px)] py-3">
          <Segmented
            value={mode}
            onChange={setMode}
            aria-label={m.rv_source_title()}
            // Dar ekranda tam genişlik; masaüstünde içeriği kadar, seçicinin yanında.
            className="shrink-0 max-sm:grid max-sm:w-full"
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
                onReadingText={(text) => cv && setCvText({ cvId: cv.id, text })}
              />
            )
          ) : (
            <PdfSource state={pdfState} onFile={(file) => void onFile(file)} />
          )}
        </div>
      </Group>

      {/*
        Geniş sol sütun: kurala dayalı sonuç, altında iş ilanı ve ilanla karşılaştırma (sayfanın en çok
        metin taşıyan iki parçası geniş sütunda). Dar sağ sütun: yapay zekâ yorumu. Dar ekranda tek sütun.
      */}
      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="min-w-0" aria-live="polite">
            {!findings ? (
              <EmptyState icon={FileSearch} title={m.rv_empty_title()} description={m.rv_empty_body()} />
            ) : (
              <div key={sourceKey} className="flex animate-rise-in flex-col gap-6">
                <div className="px-4">
                  <SeverityCounts findings={findings} />
                </div>
                <FindingGroups findings={findings} onEdit={edit} />
                {atsText && (
                  <Disclosure summary={m.rv_text_title()} open={textOpen} onOpenChange={setTextOpen} className="-mt-3 [&>button]:ml-3">
                    <ExtractedText pdf={atsText.pdf} hint={atsText.hint} />
                  </Disclosure>
                )}
              </div>
            )}
          </div>

          <Group title={m.rv_ad_title()} count={m.rv_ad_optional()} inset="lg">
            <FormRow label={m.rv_ad_label()} hint={m.rv_ad_hint()} stacked>
              {(id, describedBy) => (
                <BareTextarea
                  id={id}
                  rows={6}
                  aria-describedby={describedBy}
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  placeholder={m.rv_ad_placeholder()}
                />
              )}
            </FormRow>
            {match && findings && <KeywordPanel key={sourceKey} match={match} ai={{ cv: mineCv, pdf: readyPdf, jobAd: deferredAd }} />}
          </Group>
        </div>

        {findings && (
          <aside className="flex min-w-0 flex-col gap-8" aria-label={m.rv_ai_title()}>
            <ReviewAiCard
              key={sourceKey}
              cv={mineCv}
              pdf={readyPdf}
              // Ertelenmemiş ilan: "Ne gönderilir?" ve gönderim yazılan metnin son hâlini kullanır.
              jobAd={ad}
              onEdit={edit}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
