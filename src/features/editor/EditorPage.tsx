import { Link, useBlocker, useNavigate, useParams } from '@tanstack/react-router'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Download,
  FileDown,
  FileQuestion,
  FileWarning,
  Languages,
  LayoutTemplate,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pencil,
  Redo2,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { getCv, versionOf } from '@/db/repo'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { FloatingNotice, InlineNotice } from '@/components/ui/Notice'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { toast } from '@/components/ui/toast'
import { Toolbar, ToolbarGroup, ToolbarSection } from '@/components/ui/Toolbar'
import { Tooltip } from '@/components/ui/Tooltip'
import { CV_FORM_ATTR, editorShortcut } from '@/editor/shortcuts'
import { useEditor, type SaveConflict } from '@/editor/store'
import { useEditorUi } from '@/editor/ui'
import { duplicate, exportCvJson, exportRawJson, printTitle } from '@/features/cv-actions'
import { DeleteDialog } from '@/features/cv-list/CvListPage'
import { TranslateCvDialog } from '@/features/translate/TranslateCvDialog'
import { Wordmark } from '@/features/shell/Wordmark'
import { cn } from '@/lib/cn'
import { usePrefs } from '@/lib/prefs'
import { useChanged } from '@/lib/useChanged'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { exportPdf, pdfServerAvailable } from '@/lib/pdfExport'
import type { OversizedBlock } from '@/render/paginate'
import { m } from '@/paraglide/messages'
import { OWN_PRINT_ATTR, type CvFrameHandle } from '@/render/CvFrame'
import { whenPrintEnds } from '@/render/printEnd'
import { buildPrintNotice, PRINT_MIRROR_ID, warmMirrorFonts } from '@/render/printMirror'
import { Inspector } from './Inspector'
import { oversizedLabels } from './oversizedLabels'
import { PreviewPane } from './PreviewPane'
import { Rail } from './rail/Rail'

const PANEL_KEY = 'cveditor:panelWidth'
/** Inspector genişliği (DESIGN.md): varsayılan 440, en az 360, en çok 560 ya da pencerenin %45'i. */
const PANEL_MIN = 360
const PANEL_DEFAULT = 440
const PANEL_MAX = 560

/** Panel pencerenin %45'ini geçmez; CV her zaman alanın çoğunu alır. */
const panelMax = (viewport: number) => Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(viewport * 0.45)))

/** Kullanıcının sürükleyerek seçtiği genişlik; hiç sürüklemediyse null (varsayılan). */
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

/** CV formunu işaretler: içindeki alanlarda Ctrl+Z CV'nin ortak geçmişini geri alır (bkz. editor/shortcuts.ts). */
const cvForm = { [CV_FORM_ATTR]: '' }

/** Kaydetme göstergesi: CV adının yanında, malzeme üstünde birincil renk; kaydedilince 12px ✓. */
function SaveIndicator() {
  const state = useEditor((s) => s.saveState)
  const problem = state === 'error' || state === 'conflict'
  const label =
    state === 'error'
      ? m.save_error()
      : state === 'conflict'
        ? m.save_conflict()
        : state === 'saved'
          ? m.save_saved()
          : m.save_saving()
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        role="status"
        data-save-state={state}
        className={cn('inline-flex items-center gap-1 text-callout whitespace-nowrap', problem ? 'text-danger' : 'text-fg')}
      >
        {state === 'saved' ? (
          <Check key="ok" aria-hidden className="size-3 text-ok animate-save-tick" strokeWidth={2.5} />
        ) : problem ? (
          <TriangleAlert aria-hidden className="size-3.5" />
        ) : (
          <Loader2 aria-hidden className="size-3 animate-spin" />
        )}
        {label}
      </span>
      {state === 'error' && (
        <Button size="sm" variant="plain" data-save-retry onClick={() => void useEditor.getState().flush()}>
          {m.common_retry()}
        </Button>
      )}
    </span>
  )
}

/**
 * Bu CV başka bir sekmede değişti ya da silindi ve bu sekmede kaydedilmemiş değişiklik var (ya da CV
 * silindi). Kayıt durdurulmuştur; hangi sürümün kalacağını kullanıcı seçer. Sessizce ezme yok.
 * Tuvalin üst ortasında yüzen uyarı (renkli bant değil); sayfa sığdırılınca onun altından başlar.
 */
function SaveConflictNotice({ conflict, onLeave }: { conflict: SaveConflict; onLeave: () => void }) {
  const [busy, setBusy] = useState(false)
  const resolve = async (choice: 'mine' | 'theirs') => {
    setBusy(true)
    const result = await useEditor.getState().resolveConflict(choice)
    setBusy(false)
    if (!result.ok) toast({ message: m.conflict_failed(), tone: 'error' })
  }
  const deleted = conflict === 'deleted'
  return (
    <div data-save-conflict={conflict} className="flex max-w-full justify-center">
      <FloatingNotice tone="warn" role="alert" className="max-w-[min(100%,620px)] animate-rise-in items-start py-2.5 pr-3 [&>svg]:mt-px">
        <span className="block">
          <span className="font-semibold">{deleted ? m.conflict_deleted_title() : m.conflict_changed_title()}</span>{' '}
          {deleted ? m.conflict_deleted_body() : m.conflict_changed_body()}
        </span>
        <span className="mt-2 flex flex-wrap justify-end gap-2">
          {deleted ? (
            <>
              <Button disabled={busy} onClick={onLeave}>
                {m.nav_back_to_list()}
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void resolve('mine')}>
                {m.conflict_resave()}
              </Button>
            </>
          ) : (
            <>
              <Button disabled={busy} onClick={() => void resolve('theirs')}>
                {m.conflict_load_theirs()}
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void resolve('mine')}>
                {m.conflict_keep_mine()}
              </Button>
            </>
          )}
        </span>
      </FloatingNotice>
    </div>
  )
}

/**
 * Editörden çıkış koruması: bekleyen kayıt çıkmadan önce yazılır; yazılamıyorsa (hata ya da çakışma)
 * gezinme durur ve kullanıcıya sorulur. Değişiklik hiçbir yolda uyarısız atılmaz.
 */
function useLeaveGuard() {
  return useBlocker({
    shouldBlockFn: async () => {
      const state = useEditor.getState()
      if (!state.cv) return false
      return !(await state.flush()).ok
    },
    withResolver: true,
    // Sekme kapatma / yenileme uyarısı depoda (editor/store.ts): editör açık olmasa da geçerli.
    enableBeforeUnload: false,
  })
}

function LeaveDialog({ guard }: { guard: ReturnType<typeof useLeaveGuard> }) {
  const conflict = useEditor((s) => s.saveState === 'conflict')
  const [busy, setBusy] = useState(false)
  const open = guard.status === 'blocked'
  const retry = async () => {
    setBusy(true)
    const state = useEditor.getState()
    const result = conflict ? await state.resolveConflict('mine') : await state.flush()
    setBusy(false)
    if (result.ok) guard.proceed?.()
    else toast({ message: result.reason === 'conflict' ? m.save_conflict_toast() : m.save_failed_toast(), tone: 'error' })
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && guard.reset?.()}
      title={m.leave_unsaved_title()}
      description={conflict ? m.leave_unsaved_conflict() : m.leave_unsaved_body()}
      footer={
        <>
          <Button
            variant="destructive"
            size="lg"
            className="sm:mr-auto"
            data-leave-anyway
            onClick={() => {
              // Kullanıcı açıkça seçti: bellekteki değişiklikler bırakılır.
              useEditor.getState().unload()
              guard.proceed?.()
            }}
          >
            {m.leave_anyway()}
          </Button>
          <Button
            size="lg"
            onClick={() => {
              const current = useEditor.getState().cv
              if (current) exportCvJson(current)
            }}
          >
            <Download />
            {m.leave_download()}
          </Button>
          <Button variant="primary" size="lg" loading={busy} onClick={() => void retry()}>
            {conflict ? m.conflict_keep_mine() : m.common_retry()}
          </Button>
        </>
      }
    >
      <p className="text-body text-fg-2">{m.leave_unsaved_hint()}</p>
    </Dialog>
  )
}

/** CV adı: üst çubukta yerinde düzenlenir; kalem her zaman görünür. Uzun ad sarmaz, alan esner. */
function CvName({ cv }: { cv: Cv }) {
  const update = useEditor((s) => s.update)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <span className="flex min-w-0 items-center gap-0.5">
      <input
        ref={inputRef}
        {...cvForm}
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
        className="h-7 max-w-[min(24rem,28vw)] min-w-16 rounded-md bg-transparent px-1.5 text-title-3 text-fg [field-sizing:content] transition-colors hover:bg-fill-4 focus:bg-content"
      />
      <IconButton
        size="sm"
        tabIndex={-1}
        label={m.editor_rename_cv()}
        icon={<Pencil />}
        onClick={() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }}
      />
    </span>
  )
}

/** Dil rozeti: tıklanınca CV dilinin ne demek olduğu ve diğer dile çeviri. */
function LanguageButton({ cv, onTranslate }: { cv: Cv; onTranslate: () => void }) {
  const language = cv.language === 'en' ? m.lang_en() : m.lang_tr()
  return (
    <Popover>
      <Tooltip content={m.editor_language_hint()}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={m.editor_lang_label({ language })}
            className="press-sm inline-flex h-6 shrink-0 items-center gap-0.5 rounded-sm bg-fill-3 pr-1 pl-1.5 text-caption text-fg transition-colors hover:bg-fill-2 active:bg-fill-1 data-[state=open]:bg-fill-2"
          >
            {cv.language.toUpperCase()}
            <ChevronDown aria-hidden className="size-3" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" aria-label={m.editor_lang_label({ language })} className="w-72">
        <p className="text-headline text-fg">{m.editor_lang_label({ language })}</p>
        <p className="mt-1 text-callout text-fg-2">{m.new_cv_language_hint()}</p>
        <PopoverClose asChild>
          <Button className="mt-3" onClick={onTranslate}>
            <Languages />
            {cv.language === 'en' ? m.editor_translate_to_tr() : m.editor_translate_to_en()}
          </Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Inspector'ın solundaki bölme çizgisi: görünen 1px, tutma alanı 9px; üstüne gelince, odakta ve
 * sürüklerken 2px vurgu. Ok tuşları 24px, çift tık varsayılana döner.
 */
function Splitter({
  onDrag,
  onReset,
  value,
  min,
  max,
}: {
  onDrag: (dx: number) => void
  onReset: () => void
  /** Panelin genişliği ve sınırları (px): ekran okuyucu ayırıcının konumunu bilsin. */
  value: number
  min: number
  max: number
}) {
  const start = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (start.current === null) return
    onDrag(e.clientX - start.current)
    start.current = e.clientX
  }
  // Bırakma, iptal (dokunma kesildi, pencere odağı gitti) ve yakalamanın kaybı aynı: sürükleme biter.
  const onPointerUp = () => {
    start.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setDragging(false)
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={m.splitter_label()}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-dragging={dragging ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onDrag(-24)
        if (e.key === 'ArrowRight') onDrag(24)
      }}
      className="group relative z-10 w-px shrink-0 cursor-col-resize bg-separator outline-none"
    >
      <span aria-hidden className="absolute inset-y-0 -left-1 w-[9px]" />
      <span
        aria-hidden
        className="absolute inset-y-0 -left-px w-0.5 bg-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[dragging]:opacity-100"
      />
    </div>
  )
}

/** Ctrl+S: yalnız gerçekten yazıldıysa "Kaydedildi"; yazılamadıysa nedenini söyler. */
async function saveNow() {
  const result = await useEditor.getState().flush()
  if (result.ok) toast({ message: m.save_saved_toast() })
  else toast({ message: result.reason === 'conflict' ? m.save_conflict_toast() : m.save_failed_toast(), tone: 'error' })
}

function useEditorShortcuts(onPrint: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Kural editor/shortcuts.ts'te: AltGr kısayol değildir; CV'ye bağlı olmayan metin alanında
      // (istek kutusu, bölüm adı kutusu) ve açık pencerede Ctrl+Z tarayıcıya bırakılır.
      const shortcut = editorShortcut(e, !!document.querySelector('[role="dialog"]'))
      if (!shortcut) return
      e.preventDefault()
      if (shortcut === 'undo') useEditor.getState().undo()
      else if (shortcut === 'redo') useEditor.getState().redo()
      else if (shortcut === 'print') onPrint()
      else void saveNow()
    }
    // Yakalama evresinde: CV alanlarının kendi geri al'ı yerine editörün ortak geçmişi çalışsın.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onPrint])
}

/** Ctrl+\: sol rayı aç/kapat (kapalıysa Şablonlar ile açılır). AltGr (Ctrl+Alt) kısayol değildir. */
function useRailShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (e.key !== '\\' && e.code !== 'Backslash') return
      e.preventDefault()
      const ui = useEditorUi.getState()
      ui.setRail(ui.rail ? null : 'templates')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
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
  serverOversized,
}: {
  cv: Cv
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** Sunucunun 409 ile bildirdiği kayıtlar (yoksa önizlemenin bulduğu) */
  serverOversized?: OversizedBlock[] | null
}) {
  const previewOversized = useEditorUi((s) => s.oversized)
  const oversized = serverOversized ?? previewOversized
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
          <Button size="lg" onClick={onClose}>
            {m.pdf_confirm_cancel()}
          </Button>
          <Button variant="primary" size="lg" disabled={!agreed} onClick={onConfirm}>
            {m.pdf_confirm_go()}
          </Button>
        </>
      }
    >
      <ul className="mb-4 flex flex-col gap-2">
        {labels.map((l, i) => (
          <li key={`${l.id}-${i}`}>
            <InlineNotice tone="warn">{l.label}</InlineNotice>
          </li>
        ))}
      </ul>
      <Checkbox
        checked={agreed}
        onCheckedChange={setAgreed}
        label={labels.length === 1 ? m.ux_pdf_confirm_check_one() : m.pdf_confirm_check()}
      />
    </Dialog>
  )
}

/** "CV'lerime dön": araç çubuğunun başında yalnız ikon (‹), adı ve ipucu var. */
function BackLink() {
  return (
    <Tooltip content={m.nav_back_to_list()}>
      <Link
        to="/cvler"
        aria-label={m.nav_back_to_list()}
        className={buttonClass({ variant: 'ghost', size: 'icon', className: '[&_svg]:size-5' })}
      >
        <ChevronLeft strokeWidth={1.5} />
      </Link>
    </Tooltip>
  )
}

/**
 * Telefon (< 900px): üst çubukta geri + CV adı, ortada salt okunur önizleme (genişliğe sığar, hapla
 * sayfa ve yakınlaştırma), altta tam genişlik "PDF al". "Bilgisayardan aç" notu tuvalde yüzer.
 */
function MobileEditor({
  cv,
  onPrint,
  frameRef,
  notices,
}: {
  cv: Cv
  onPrint: () => void
  frameRef: React.RefObject<CvFrameHandle | null>
  notices?: React.ReactNode
}) {
  return (
    <div className="flex h-dvh flex-col bg-window">
      <Toolbar scrolled className="shrink-0 gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <BackLink />
        <h1 className="min-w-0 flex-1 text-title-3 break-words text-fg">{cv.name}</h1>
        <Badge className="mr-2">{cv.language.toUpperCase()}</Badge>
      </Toolbar>
      <div className="min-h-0 flex-1">
        <PreviewPane ref={frameRef} cv={cv} readOnly notice={m.mobile_note()} notices={notices} />
      </div>
      <Toolbar as="footer" edge="top" scrolled className="shrink-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button variant="primary" size="xl" className="w-full" onClick={onPrint}>
          <FileDown />
          {m.pdf_button()}
        </Button>
      </Toolbar>
    </div>
  )
}

type Loaded =
  | { cvId: string; status: 'ready' | 'missing' | 'error'; raw?: undefined }
  /** `raw`: okunamayan kaydın ham hâli (kullanıcı indirebilsin) */
  | { cvId: string; status: 'broken'; raw: unknown }

/** Her editör açılışında artar: eski açılışın temizliği yenisinin yüklediği CV'yi boşaltmasın. */
let mountSeq = 0

/**
 * Editörden çıkıldı ama son değişiklikler yazılamadı (çıkış koruması atlandıysa son güvenlik ağı):
 * CV bellekte tutulur, kullanıcı uyarılır ve yedeğini indirebilir.
 */
/** PDF sunucusu var mı (düğmenin ipucu için): sunucu varsa PDF doğrudan iner, yoksa yazdır penceresi açılır. */
function usePdfServer(): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let alive = true
    void pdfServerAvailable().then((ok) => {
      if (alive) setAvailable(ok)
    })
    return () => {
      alive = false
    }
  }, [])
  return available
}

function warnUnsavedLeft() {
  // Yedek, uyarı anındaki CV'dir: bu arada başka bir CV açılsa da indirilen o olmaz.
  const snapshot = useEditor.getState().cv
  if (!snapshot) return
  toast({
    message: m.leave_unsaved_kept(),
    tone: 'error',
    duration: Infinity,
    action: { label: m.leave_download(), run: () => exportCvJson(snapshot) },
  })
}

/** Açılırken boş ekran yerine iskelet: üst çubuk, gri tuval, panel. */
function EditorSkeleton({ panelWidth }: { panelWidth: number }) {
  return (
    <div aria-busy className="flex h-dvh flex-col bg-window">
      <div className="material scroll-edge-bottom h-13 shrink-0" data-scrolled="" />
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 bg-canvas" />
        <div className="shrink-0 border-l border-separator bg-window" style={{ width: panelWidth }} />
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
  const resetUi = useEditorUi((s) => s.reset)
  const rail = useEditorUi((s) => s.rail)
  const setRail = useEditorUi((s) => s.setRail)
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const conflict = useEditor((s) => (s.saveState === 'conflict' ? s.conflict : null))
  // Yükleme sonucu hangi CV için: cvId değişince yenisi gelene dek 'loading'.
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const status = loaded?.cvId === cvId ? loaded.status : 'loading'
  // Yeniden okuma isteği ("Yeniden dene", başarısız silmeden sonra).
  const [reloadKey, setReloadKey] = useState(0)
  const guard = useLeaveGuard()
  const [savedPanelWidth, setSavedPanelWidth] = useState(readSavedPanelWidth)
  const viewport = useViewportWidth()
  const maxPanel = panelMax(viewport)
  const panelWidth = Math.min(maxPanel, savedPanelWidth ?? PANEL_DEFAULT)
  const [confirmPdf, setConfirmPdf] = useState(false)
  const [serverOversized, setServerOversized] = useState<OversizedBlock[] | null>(null)
  const [deleting, setDeleting] = useState<Cv | null>(null)
  const [translating, setTranslating] = useState(false)
  const frameRef = useRef<CvFrameHandle>(null)
  const narrow = useMediaQuery('(max-width: 899px)')
  const pdfServer = usePdfServer()

  useEffect(() => {
    let cancelled = false
    const mount = ++mountSeq
    resetUi()
    const open = async (): Promise<Loaded> => {
      const held = useEditor.getState()
      // Önceki çıkışta kaydedilemeyen değişiklikler hâlâ bellekteyse veritabanındaki eski hâlle ezilmez.
      if (held.cv?.id === cvId && held.saveState !== 'saved') {
        void held.flush()
        return { cvId, status: 'ready' }
      }
      const raw = await getCv(cvId)
      if (!raw) return { cvId, status: 'missing' }
      try {
        const next = migrateCv(raw)
        if (!cancelled) load(next, versionOf(raw))
        return { cvId, status: 'ready' }
      } catch (error) {
        console.error(error)
        return { cvId, status: 'broken', raw }
      }
    }
    void open()
      .catch((error): Loaded => {
        // Okuma reddedildi (veritabanı kapalı, depolama erişilemez): sonsuz "yükleniyor" yerine hata ekranı.
        console.error(error)
        return { cvId, status: 'error' }
      })
      .then((result) => {
        if (!cancelled) setLoaded(result)
      })
    return () => {
      cancelled = true
      void useEditor
        .getState()
        .flush()
        .then((result) => {
          // Bu arada yeni bir editör açıldıysa depo artık onundur.
          if (mountSeq !== mount) return
          if (result.ok) unload(cvId)
          // Kayıt başarısız: bellekteki CV atılmaz (yeniden açınca kaldığı yerden sürer), kullanıcı uyarılır.
          else warnUnsavedLeft()
        })
    }
  }, [cvId, load, unload, resetUi, reloadKey])

  // Başka sekmedeki değişiklik kendiliğinden yüklenince haber ver (geri alma geçmişi sıfırlandı).
  useEffect(
    () =>
      useEditor.subscribe((state, prev) => {
        if (state.remoteLoads > prev.remoteLoads) toast({ message: m.remote_loaded_toast() })
      }),
    [],
  )

  const leaveToList = useCallback(() => {
    // Silinmiş CV'nin bu sekmedeki kopyası bırakılır (kullanıcı "CV'lerime dön" dedi).
    useEditor.getState().unload()
    void navigate({ to: '/cvler' })
  }, [navigate])

  const openReview = useCallback(
    (id: string) =>
      void useEditor
        .getState()
        .flush()
        .then(() => navigate({ to: '/inceleme', search: { cv: id } })),
    [navigate],
  )

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

  // PDF: sunucu varsa /api/pdf, yoksa önizlemenin yazdır penceresi (src/lib/pdfExport.ts).
  const doPrint = useCallback((allowSplit = false) => {
    const current = useEditor.getState().cv
    if (!current) return
    void exportPdf(current, {
      allowSplit,
      print: async () => {
        if (!frameRef.current) throw new Error('Önizleme hazır değil')
        // Çizim başarısızsa print() reddeder; exportPdf bunu "PDF alınamadı" bildirimine çevirir.
        await frameRef.current.print(printTitle(current))
      },
    })
      .then((outcome) => {
        // Sunucu, önizlemenin görmediği uzun kayıt buldu (409): aynı onay penceresi o kayıtlarla açılır.
        if (outcome.kind === 'oversized') {
          setServerOversized(outcome.oversized)
          setConfirmPdf(true)
        }
      })
      .catch((error: unknown) => {
        console.error(error)
        toast({ message: m.pdf_failed(), tone: 'error' })
      })
  }, [])

  const requestPrint = useCallback(() => {
    const ui = useEditorUi.getState()
    if (ui.suggestions.length > 0) {
      toast({ message: m.pdf_pending_suggestions() })
      return
    }
    if (ui.oversized.length > 0) {
      setServerOversized(null)
      setConfirmPdf(true)
      return
    }
    doPrint()
  }, [doPrint])

  useEditorShortcuts(requestPrint)
  useRailShortcut()
  const openConfirm = useCallback(() => {
    setServerOversized(null)
    setConfirmPdf(true)
  }, [])
  useBrowserMenuPrint(frameRef, openConfirm)
  // Menü baskısında aynanın yazı tipleri hazır olsun (beforeprint yüklemeyi beklemez).
  const font = cv?.template.font
  useEffect(() => {
    if (font) warmMirrorFonts(font)
  }, [font])

  if (status === 'missing' || status === 'broken' || status === 'error') {
    const raw = loaded?.raw
    return (
      <div data-editor-status={status} className="flex min-h-dvh flex-col items-center justify-center bg-window px-6">
        <Wordmark />
        <EmptyState
          icon={status === 'missing' ? FileQuestion : FileWarning}
          title={status === 'missing' ? m.editor_missing_title() : status === 'broken' ? m.editor_broken_title() : m.editor_load_error_title()}
          description={status === 'missing' ? m.editor_missing_body() : status === 'broken' ? m.editor_broken_body() : m.editor_load_error_body()}
          className="pt-8"
          actions={
            <>
              <Link to="/cvler" className={buttonClass({ variant: status === 'error' ? 'secondary' : 'primary', size: 'lg' })}>
                {m.nav_back_to_list()}
              </Link>
              {status === 'broken' && raw != null && (
                // Okunamayan kayıt kullanıcının verisidir: ham hâliyle indirilebilir.
                <Button size="lg" onClick={() => exportRawJson(raw, cvId)}>
                  <Download />
                  {m.editor_broken_download()}
                </Button>
              )}
              {status === 'error' && (
                <Button variant="primary" size="lg" onClick={() => setReloadKey((key) => key + 1)}>
                  {m.common_retry()}
                </Button>
              )}
            </>
          }
        />
      </div>
    )
  }

  if (!cv || status === 'loading') {
    return narrow ? <div className="h-dvh bg-window" /> : <EditorSkeleton panelWidth={panelWidth} />
  }

  const conflictNotice = conflict && <SaveConflictNotice conflict={conflict} onLeave={leaveToList} />
  const pdfConfirm = (
    <PdfConfirmDialog
      cv={cv}
      open={confirmPdf}
      serverOversized={serverOversized}
      onClose={() => setConfirmPdf(false)}
      onConfirm={() => {
        setConfirmPdf(false)
        doPrint(true)
      }}
    />
  )

  if (narrow) {
    return (
      <>
        <MobileEditor cv={cv} onPrint={requestPrint} frameRef={frameRef} notices={conflictNotice} />
        <LeaveDialog guard={guard} />
        {pdfConfirm}
      </>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-window animate-fade-in">
      {/* Üst çubuk birden çok bölmenin üstünde: ayırıcı çizgi her zaman (macOS bölmeli pencere). */}
      <Toolbar scrolled className="shrink-0 gap-4 px-3">
        <ToolbarSection grow className="gap-1.5">
          <BackLink />
          <CvName cv={cv} />
          <LanguageButton cv={cv} onTranslate={() => setTranslating(true)} />
          <span className="ml-1.5 flex min-w-0 items-center">
            <SaveIndicator />
          </span>
        </ToolbarSection>

        <ToolbarSection className="shrink-0">
          <ToolbarGroup aria-label={m.editor_history()}>
            <IconButton
              label={m.common_undo()}
              shortcut="Ctrl+Z"
              icon={<Undo2 />}
              disabled={!canUndo}
              onClick={() => useEditor.getState().undo()}
            />
            <IconButton
              label={m.common_redo()}
              shortcut="Ctrl+Shift+Z"
              icon={<Redo2 />}
              disabled={!canRedo}
              onClick={() => useEditor.getState().redo()}
            />
          </ToolbarGroup>
          <Tooltip content={m.rail_toggle_hint()} shortcut="Ctrl+\">
            <Button
              variant="ghost"
              aria-pressed={rail === 'templates'}
              className={cn(rail === 'templates' && 'bg-fill-2 hover:bg-fill-2')}
              onClick={() => setRail(rail === 'templates' ? null : 'templates')}
            >
              <LayoutTemplate />
              {m.rail_templates()}
            </Button>
          </Tooltip>
          <Tooltip content={m.rv_editor_menu()}>
            <Button variant="ghost" onClick={() => openReview(cv.id)}>
              <ListChecks />
              {m.editor_review()}
            </Button>
          </Tooltip>
          <Menu>
            <MenuTrigger asChild>
              <IconButton label={m.editor_more()} icon={<MoreHorizontal />} />
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon={<Copy />}
                onSelect={() =>
                  void useEditor
                    .getState()
                    .flush()
                    .then(() => duplicate(useEditor.getState().cv ?? cv))
                    .then((copy) => copy && navigate({ to: '/editor/$cvId', params: { cvId: copy.id } }))
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
              <MenuItem icon={<ListChecks />} onSelect={() => openReview(cv.id)}>
                {m.rv_editor_menu()}
              </MenuItem>
              <MenuSeparator />
              <MenuCheckboxItem checked={theme === 'dark'} onCheckedChange={(dark) => setTheme(dark ? 'dark' : 'light')}>
                {m.settings_dark()}
              </MenuCheckboxItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onSelect={() => setDeleting(cv)}>
                {m.common_delete()}
              </MenuItem>
            </MenuContent>
          </Menu>
          <Tooltip content={pdfServer ? m.pdf_hint_server() : m.pdf_hint()} shortcut="Ctrl+P">
            <Button variant="primary" size="lg" onClick={requestPrint}>
              <FileDown />
              {m.pdf_button()}
            </Button>
          </Tooltip>
        </ToolbarSection>
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        <Rail cv={cv} />
        <main className="min-w-0 flex-1">
          <PreviewPane ref={frameRef} cv={cv} notices={conflictNotice} />
        </main>
        <Splitter
          onDrag={(dx) => setSavedPanelWidth((w) => Math.min(maxPanel, Math.max(PANEL_MIN, Math.min(maxPanel, w ?? panelWidth) - dx)))}
          onReset={() => setSavedPanelWidth(null)}
          value={panelWidth}
          min={PANEL_MIN}
          max={maxPanel}
        />
        <aside className="flex min-h-0 shrink-0 flex-col bg-window" style={{ width: panelWidth }}>
          <Inspector cv={cv} />
        </aside>
      </div>

      {pdfConfirm}
      <TranslateCvDialog cv={cv} open={translating} onClose={() => setTranslating(false)} />
      <LeaveDialog guard={guard} />
      <DeleteDialog
        cv={deleting}
        onClose={() => setDeleting(null)}
        beforeDelete={async () => {
          // Bekleyen otomatik kayıt silinen CV'yi geri yazmasın; editör silmeyi "başka sekme sildi" sanmasın.
          await useEditor.getState().flush()
          useEditor.getState().unload()
        }}
        onDeleted={() => void navigate({ to: '/cvler' })}
        // Silinemedi: CV duruyor, editöre yeniden yüklenir.
        onFailed={() => setReloadKey((key) => key + 1)}
      />
    </div>
  )
}
