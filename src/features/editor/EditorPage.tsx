import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileDown,
  Languages,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Redo2,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { getCv } from '@/db/repo'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { Segmented } from '@/components/ui/Segmented'
import { toast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { useEditor } from '@/editor/store'
import { useEditorUi } from '@/editor/ui'
import { duplicate, exportCvJson, printTitle } from '@/features/cv-actions'
import { DeleteDialog } from '@/features/cv-list/CvListPage'
import { ThemeToggle } from '@/features/shell/AppShell'
import { TranslateCvDialog } from '@/features/translate/TranslateCvDialog'
import { Wordmark } from '@/features/shell/Wordmark'
import { cn } from '@/lib/cn'
import { useChanged } from '@/lib/useChanged'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { m } from '@/paraglide/messages'
import { OWN_PRINT_ATTR, type CvFrameHandle } from '@/render/CvFrame'
import { whenPrintEnds } from '@/render/printEnd'
import { buildPrintNotice, PRINT_MIRROR_ID, warmMirrorFonts } from '@/render/printMirror'
import { AppearanceTab } from './appearance/AppearanceTab'
import { PromptBox } from './ai/PromptBox'
import { PersonalForm } from './content/PersonalForm'
import { SectionList } from './content/SectionList'
import { oversizedLabels } from './oversizedLabels'
import { PreviewPane } from './PreviewPane'

const PANEL_KEY = 'cveditor:panelWidth'
const PANEL_MIN = 380
const PANEL_MAX_DEFAULT = 560

/** Varsayılan panel genişliği pencereyle orantılı: clamp(380px, 38vw, 560px). */
const panelDefault = (viewport: number) => Math.round(Math.min(PANEL_MAX_DEFAULT, Math.max(PANEL_MIN, viewport * 0.38)))
/** Panel pencerenin yarısını geçmez; CV her zaman en az yarıyı alır. */
const panelMax = (viewport: number) => Math.max(PANEL_MIN, Math.round(viewport * 0.5))

/** Kullanıcının sürükleyerek seçtiği genişlik; hiç sürüklemediyse null (varsayılan orantılı). */
function readSavedPanelWidth() {
  try {
    const value = Number(localStorage.getItem(PANEL_KEY))
    return value >= PANEL_MIN ? value : null
  } catch {
    return null
  }
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

function SaveIndicator() {
  const state = useEditor((s) => s.saveState)
  const label =
    state === 'error' ? m.save_error() : state === 'saved' ? m.save_saved() : m.save_saving()
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs transition-colors',
        state === 'error' ? 'text-danger' : 'text-faint',
      )}
    >
      {state === 'saved' ? (
        <Check key="ok" className="size-3.5 text-ok animate-[save-tick_260ms_var(--ease-spring)]" />
      ) : state === 'error' ? (
        <TriangleAlert className="size-3.5" />
      ) : (
        <Loader2 className="size-3.5 animate-spin" />
      )}
      {label}
    </span>
  )
}

function CvName({ cv }: { cv: Cv }) {
  const update = useEditor((s) => s.update)
  return (
    <input
      value={cv.name}
      aria-label={m.new_cv_name()}
      onChange={(e) =>
        update((d) => {
          d.name = e.target.value
        }, { coalesceKey: 'name' })
      }
      onBlur={(e) => {
        if (!e.target.value.trim())
          update((d) => {
            d.name = m.untitled_cv()
          })
      }}
      className="h-8 max-w-[22rem] min-w-24 truncate rounded-md [field-sizing:content] border border-transparent bg-transparent px-2 text-[15px] font-semibold tracking-tight transition-colors hover:border-line focus:border-accent focus:outline-none"
    />
  )
}

function Splitter({ onDrag, onReset }: { onDrag: (dx: number) => void; onReset: () => void }) {
  const start = useRef<number | null>(null)
  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (start.current === null) return
    onDrag(e.clientX - start.current)
    start.current = e.clientX
  }
  const onPointerUp = () => {
    start.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={m.splitter_label()}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onDrag(-24)
        if (e.key === 'ArrowRight') onDrag(24)
      }}
      className="group relative z-10 w-px shrink-0 cursor-col-resize bg-line outline-none"
    >
      <span className="absolute inset-y-0 -left-1.5 w-3" />
      <span className="absolute inset-y-0 left-0 w-px bg-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100" />
    </div>
  )
}

function useEditorShortcuts(onPrint: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      // Açık bir pencerede (ör. çeviri incelemesi) Ctrl+Z o pencerenin alanına aittir, arkadaki CV'ye değil.
      if ((key === 'z' || key === 'y') && document.querySelector('[role="dialog"]')) return
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditor.getState().undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useEditor.getState().redo()
      } else if (key === 'p') {
        e.preventDefault()
        onPrint()
      } else if (key === 's') {
        e.preventDefault()
        void useEditor.getState().flush().then(() => toast({ message: m.save_saved_toast() }))
      }
    }
    // Yakalama evresinde: giriş alanlarının kendi geri al'ı yerine editörün ortak geçmişi çalışsın.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onPrint])
}

/**
 * Tarayıcının kendi Yazdır menüsü (Ctrl+P'yi editör zaten yakalar). beforeprint
 * baskıyı iptal edemez ve beklemez; bu yüzden en sadık yol, o anda önizlemenin
 * sayfalanmış kopyasını üst belgeye koymak (printMirror.ts) ve @media print'te
 * yalnız onu basmaktır. "PDF al" ile aynı kurallar: uzun kayıt varsa CV sessizce
 * basılmaz; baskıya kısa bir not girer ve pencere kapanınca onay penceresi açılır.
 * Bekleyen öneri varsa da not basılır (öneri işaretleri PDF'e girmesin).
 */
function useBrowserMenuPrint(frameRef: React.RefObject<CvFrameHandle | null>, onNeedsConfirm: () => void) {
  useEffect(() => {
    let state: { host: HTMLElement; title: string; lang: string; confirm: boolean; stopWatching: () => void } | null = null
    const cleanup = () => {
      if (!state) return
      state.stopWatching()
      state.host.remove()
      document.title = state.title
      document.documentElement.lang = state.lang
      state = null
    }
    const onBefore = () => {
      // "PDF al" iframe'i basıyorsa ayna gerekmez.
      if (document.documentElement.hasAttribute(OWN_PRINT_ATTR)) return
      cleanup()
      document.getElementById(PRINT_MIRROR_ID)?.remove()
      const cv = useEditor.getState().cv
      if (!cv) return
      const ui = useEditorUi.getState()
      const pending = ui.suggestions.length > 0
      const confirm = !pending && ui.oversized.length > 0
      const mirror = pending || confirm ? null : frameRef.current?.printMirror()
      // İlk çizim bitmeden (ayna yok) editör arayüzü basılmasın: kısa not basılır.
      const host = pending
        ? buildPrintNotice(m.print_menu_pending())
        : confirm
          ? buildPrintNotice(m.print_menu_oversized())
          : (mirror ?? buildPrintNotice(m.print_menu_not_ready()))
      const html = document.documentElement
      state = { host, title: document.title, lang: html.lang, confirm, stopWatching: () => {} }
      if (mirror) {
        document.title = printTitle(cv)
        // Basılan belgenin dili CV dilidir (arayüz dili değil).
        html.lang = mirror.lang || cv.language
      }
      document.body.append(host)
      // afterprint gelmezse ayna, başlık ve dil sayfa yeniden odak alınca ya da etkileşimde geri alınır.
      state.stopWatching = whenPrintEnds([window], onAfter)
    }
    const onAfter = () => {
      const confirm = state?.confirm ?? false
      cleanup()
      if (confirm) onNeedsConfirm()
    }
    window.addEventListener('beforeprint', onBefore)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      cleanup()
    }
  }, [frameRef, onNeedsConfirm])
}

function PdfConfirmDialog({
  cv,
  open,
  onClose,
  onConfirm,
}: {
  cv: Cv
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const oversized = useEditorUi((s) => s.oversized)
  const [agreed, setAgreed] = useState(false)
  if (useChanged(open, false) && open) setAgreed(false)
  const labels = oversizedLabels(cv, oversized)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={m.pdf_confirm_title()}
      description={labels.length === 1 ? m.ux_pdf_confirm_desc_one() : m.pdf_confirm_desc({ count: labels.length })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {m.pdf_confirm_cancel()}
          </Button>
          <Button variant="primary" disabled={!agreed} onClick={onConfirm}>
            {m.pdf_confirm_go()}
          </Button>
        </>
      }
    >
      <ul className="mb-4 flex flex-col gap-1.5">
        {labels.map((l, i) => (
          <li key={`${l.id}-${i}`} className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">
            <TriangleAlert className="size-4 shrink-0 text-warn" />
            {l.label}
          </li>
        ))}
      </ul>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--accent)]"
        />
        <span>{labels.length === 1 ? m.ux_pdf_confirm_check_one() : m.pdf_confirm_check()}</span>
      </label>
    </Dialog>
  )
}

function MobileEditor({ cv, onPrint, frameRef }: { cv: Cv; onPrint: () => void; frameRef: React.RefObject<CvFrameHandle | null> }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 items-center gap-2 border-b border-line px-3">
        <Link to="/cvler" className="inline-flex size-9 items-center justify-center rounded-lg text-muted" aria-label={m.nav_back_to_list()}>
          <ArrowLeft className="size-4" />
        </Link>
        <span className="min-w-0 flex-1 truncate font-semibold">{cv.name}</span>
        <Button variant="primary" size="sm" onClick={onPrint}>
          <FileDown />
          {m.pdf_button()}
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        <PreviewPane ref={frameRef} cv={cv} readOnly notice={m.mobile_note()} />
      </div>
    </div>
  )
}

export function EditorPage() {
  const { cvId } = useParams({ from: '/editor/$cvId' })
  const navigate = useNavigate()
  const cv = useEditor((s) => s.cv)
  const load = useEditor((s) => s.load)
  const unload = useEditor((s) => s.unload)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const tab = useEditorUi((s) => s.tab)
  const setTab = useEditorUi((s) => s.setTab)
  const pageCount = useEditorUi((s) => s.pageCount)
  const resetUi = useEditorUi((s) => s.reset)
  // Yükleme sonucu hangi CV için: cvId değişince yenisi gelene dek 'loading'.
  const [loaded, setLoaded] = useState<{ cvId: string; status: 'ready' | 'missing' | 'broken' } | null>(null)
  const status = loaded?.cvId === cvId ? loaded.status : 'loading'
  const [savedPanelWidth, setSavedPanelWidth] = useState(readSavedPanelWidth)
  const viewport = useViewportWidth()
  const maxPanel = panelMax(viewport)
  const panelWidth = Math.min(maxPanel, savedPanelWidth ?? panelDefault(viewport))
  const [confirmPdf, setConfirmPdf] = useState(false)
  const [deleting, setDeleting] = useState<Cv | null>(null)
  const [translating, setTranslating] = useState(false)
  const frameRef = useRef<CvFrameHandle>(null)
  const narrow = useMediaQuery('(max-width: 899px)')

  useEffect(() => {
    let cancelled = false
    resetUi()
    void getCv(cvId).then((raw) => {
      if (cancelled) return
      if (!raw) {
        setLoaded({ cvId, status: 'missing' })
        return
      }
      try {
        load(migrateCv(raw))
        setLoaded({ cvId, status: 'ready' })
      } catch (error) {
        console.error(error)
        setLoaded({ cvId, status: 'broken' })
      }
    })
    return () => {
      cancelled = true
      void useEditor.getState().flush().then(() => unload(cvId))
    }
  }, [cvId, load, unload, resetUi])

  useEffect(() => {
    if (cv) document.title = `${cv.name} · CVeditör`
    return () => {
      document.title = 'CVeditör'
    }
  }, [cv?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (savedPanelWidth === null) localStorage.removeItem(PANEL_KEY)
      else localStorage.setItem(PANEL_KEY, String(Math.round(savedPanelWidth)))
    } catch {
      // yalnız bu oturumda kalır
    }
  }, [savedPanelWidth])

  const doPrint = useCallback(() => {
    const current = useEditor.getState().cv
    if (!current) return
    void frameRef.current?.print(printTitle(current))
  }, [])

  const requestPrint = useCallback(() => {
    const ui = useEditorUi.getState()
    if (ui.suggestions.length > 0) {
      toast({ message: m.pdf_pending_suggestions() })
      return
    }
    if (ui.oversized.length > 0) {
      setConfirmPdf(true)
      return
    }
    doPrint()
  }, [doPrint])

  useEditorShortcuts(requestPrint)
  const openConfirm = useCallback(() => setConfirmPdf(true), [])
  useBrowserMenuPrint(frameRef, openConfirm)
  // Menü baskısında aynanın yazı tipleri hazır olsun (beforeprint yüklemeyi beklemez).
  const font = cv?.template.font
  useEffect(() => {
    if (font) warmMirrorFonts(font)
  }, [font])

  if (status === 'missing' || status === 'broken') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <Wordmark />
        <h1 className="text-xl font-semibold tracking-tight">
          {status === 'missing' ? m.editor_missing_title() : m.editor_broken_title()}
        </h1>
        <p className="max-w-sm text-muted">{status === 'missing' ? m.editor_missing_body() : m.editor_broken_body()}</p>
        <Link to="/cvler" className="text-sm font-medium text-accent hover:underline">
          {m.nav_back_to_list()}
        </Link>
      </div>
    )
  }

  if (!cv || status === 'loading') {
    return <div className="h-dvh bg-bg" />
  }

  if (narrow) {
    return (
      <>
        <MobileEditor cv={cv} onPrint={requestPrint} frameRef={frameRef} />
        <PdfConfirmDialog
          cv={cv}
          open={confirmPdf}
          onClose={() => setConfirmPdf(false)}
          onConfirm={() => {
            setConfirmPdf(false)
            doPrint()
          }}
        />
      </>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden animate-fade-in">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Tooltip content={m.nav_back_to_list()}>
          <Link
            to="/cvler"
            aria-label={m.nav_back_to_list()}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <ArrowLeft className="size-4" />
          </Link>
        </Tooltip>
        <CvName cv={cv} />
        <Tooltip content={m.editor_language_hint()}>
          <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-semibold tracking-wide uppercase">
            {cv.language}
          </span>
        </Tooltip>
        <span className="ml-2 flex items-center">
          <SaveIndicator />
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip content={`${m.common_undo()} · Ctrl+Z`}>
            <Button
              size="icon"
              variant="ghost"
              aria-label={m.common_undo()}
              disabled={!canUndo}
              onClick={() => useEditor.getState().undo()}
            >
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content={`${m.common_redo()} · Ctrl+Shift+Z`}>
            <Button
              size="icon"
              variant="ghost"
              aria-label={m.common_redo()}
              disabled={!canRedo}
              onClick={() => useEditor.getState().redo()}
            >
              <Redo2 />
            </Button>
          </Tooltip>
          <span className="mx-1.5 h-5 w-px bg-line" />
          <Tooltip content={pageCount > 1 ? m.pages_hint() : undefined}>
            <span className={cn('px-1 text-xs tabular-nums', pageCount > 1 ? 'text-warn' : 'text-faint')}>
              {m.page_count({ count: pageCount })}
            </span>
          </Tooltip>
          <ThemeToggle />
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={m.editor_more()}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon={<Copy />}
                onSelect={() =>
                  void useEditor
                    .getState()
                    .flush()
                    .then(() => duplicate(cv))
                    .then((copy) => navigate({ to: '/editor/$cvId', params: { cvId: copy.id } }))
                }
              >
                {m.list_duplicate()}
              </MenuItem>
              <MenuItem icon={<Download />} onSelect={() => exportCvJson(cv)}>
                {m.list_export_json()}
              </MenuItem>
              <MenuItem icon={<Languages />} onSelect={() => setTranslating(true)}>
                {m.editor_translate_cv()}
              </MenuItem>
              <MenuItem
                icon={<ListChecks />}
                onSelect={() =>
                  void useEditor
                    .getState()
                    .flush()
                    .then(() => navigate({ to: '/inceleme', search: { cv: cv.id } }))
                }
              >
                {m.rv_editor_menu()}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onSelect={() => setDeleting(cv)}>
                {m.common_delete()}
              </MenuItem>
            </MenuContent>
          </Menu>
          <Tooltip content={`${m.pdf_hint()} · Ctrl+P`}>
            <Button variant="primary" className="ml-1" onClick={requestPrint}>
              <FileDown />
              {m.pdf_button()}
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PreviewPane ref={frameRef} cv={cv} />
        </div>
        <Splitter
          onDrag={(dx) => setSavedPanelWidth((w) => Math.min(maxPanel, Math.max(PANEL_MIN, Math.min(maxPanel, w ?? panelWidth) - dx)))}
          onReset={() => setSavedPanelWidth(null)}
        />
        <aside className="flex min-h-0 shrink-0 flex-col bg-surface" style={{ width: panelWidth }}>
          <div className="flex shrink-0 items-center border-b border-line px-4 py-2.5">
            <Segmented
              value={tab}
              onChange={setTab}
              aria-label={m.editor_panel_tabs()}
              options={[
                { value: 'content', label: m.tab_content() },
                { value: 'appearance', label: m.tab_appearance() },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-panel-scroll>
            <div key={tab} className="px-4 pt-4 pb-10 animate-[rise-in_200ms_var(--ease-out-soft)]">
              {tab === 'content' ? (
                <div className="flex flex-col gap-6">
                  <section id="personal-card" aria-label={m.editor_personal_title()} className="rounded-2xl">
                    {/* Bölüm başlıklarıyla aynı satır yapısı: tutamak yuvası boş, başlık ve alanlar aynı x'te. */}
                    <header className="flex items-center gap-1.5 py-2">
                      <span aria-hidden className="h-7 w-5 shrink-0" />
                      <h2 className="px-1 py-0.5 text-[15px] font-semibold tracking-tight">{m.editor_personal_title()}</h2>
                    </header>
                    <div className="pb-2 pl-7.5">
                      <PersonalForm personal={cv.personal} showPhoto={cv.template.showPhoto} />
                    </div>
                  </section>
                  <SectionList sections={cv.sections} language={cv.language} cvId={cv.id} />
                </div>
              ) : (
                <AppearanceTab cv={cv} />
              )}
            </div>
          </div>
          <PromptBox cv={cv} />
        </aside>
      </div>

      <PdfConfirmDialog
        cv={cv}
        open={confirmPdf}
        onClose={() => setConfirmPdf(false)}
        onConfirm={() => {
          setConfirmPdf(false)
          doPrint()
        }}
      />
      <TranslateCvDialog cv={cv} open={translating} onClose={() => setTranslating(false)} />
      <DeleteDialog
        cv={deleting}
        onClose={() => setDeleting(null)}
        beforeDelete={async () => {
          // Bekleyen otomatik kayıt silinen CV'yi geri yazmasın.
          await useEditor.getState().flush()
          useEditor.getState().unload()
        }}
        onDeleted={() => void navigate({ to: '/cvler' })}
      />
    </div>
  )
}
