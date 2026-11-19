import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  FileUp,
  Languages,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { describeCvError, migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { getMeta, META_LAST_BACKUP } from '@/db/repo'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { controlOnContentClass } from '@/components/ui/controlClass'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Field'
import { Group, GroupRow } from '@/components/ui/Group'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { SearchField } from '@/components/ui/SearchField'
import { toast } from '@/components/ui/toast'
import { deleteWithUndo, duplicate, exportAllJson, exportCvJson, rename } from '@/features/cv-actions'
import { requestImportStart } from '@/features/templates/importIntent'
import { TEMPLATE_TEXT } from '@/features/templates/templateText'
import { cn } from '@/lib/cn'
import { focusWhenSettled } from '@/lib/focus'
import { matchesSearch } from '@/lib/search'
import { useChanged } from '@/lib/useChanged'
import { daysSince, formatDateTime, relativeTime } from '@/lib/time'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { getTemplate } from '@/render/templates'

const BACKUP_REMIND_DAYS = 7

// Çeviri penceresi (yapay zekâ katmanı) yalnız istenince yüklenir: liste ilk açılışta hafif kalsın.
const TranslateCvDialog = lazy(() =>
  import('@/features/translate/TranslateCvDialog').then((mod) => ({ default: mod.TranslateCvDialog })),
)

/** "az önce" (bir dakikadan yeni), yoksa göreli zaman ("3 gün önce"). */
function updatedText(iso: string): string {
  const age = Date.now() - Date.parse(iso)
  return age >= 0 && age < 60_000 ? m.time_just_now() : relativeTime(iso)
}

/**
 * CV kartı: kapsız; A4 küçük resim pencere zemininde, altında ad (title-3, sarar, kesilmez) ve tek satır
 * bilgi (dil · şablon · sayfa · zaman); ⋯ adın sağında her zaman görünür. Telefonda 68px küçük resimli
 * liste satırı.
 */
function CvCard({
  cv,
  onRename,
  onDelete,
  onTranslate,
}: {
  cv: Cv
  onRename: () => void
  onDelete: () => void
  onTranslate: () => void
}) {
  const navigate = useNavigate()
  const [pages, setPages] = useState<number | null>(null)
  return (
    <article
      className="flex min-w-0 flex-col max-sm:grid max-sm:grid-cols-[68px_minmax(0,1fr)] max-sm:items-start max-sm:gap-3"
      data-cv-card={cv.id}
    >
      <Link
        to="/editor/$cvId"
        params={{ cvId: cv.id }}
        className={cn(
          'relative block aspect-[210/297] overflow-hidden rounded-sm bg-paper shadow-thumb outline-offset-3',
          'transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-2 active:translate-y-0',
        )}
        aria-label={m.list_open_cv({ name: cv.name })}
      >
        <CvFrame
          cv={cv}
          scale="fit"
          fitPadding={0}
          firstPageOnly
          className="absolute inset-0"
          title={cv.name}
          onResult={(result) => setPages(result.pageCount)}
        />
      </Link>
      <div className="mt-3 flex min-w-0 items-start gap-1 max-sm:mt-0">
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-title-3 break-words text-fg">{cv.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-callout text-fg-2">
            <Badge>{cv.language?.toUpperCase()}</Badge>
            <span>{TEMPLATE_TEXT[getTemplate(cv.templateId).id].name()}</span>
            {pages !== null && (
              <>
                <span aria-hidden className="text-fg-3">
                  ·
                </span>
                <span className="tabular-nums">{m.list_pages({ pages })}</span>
              </>
            )}
            <span aria-hidden className="text-fg-3">
              ·
            </span>
            <time dateTime={cv.updatedAt} title={formatDateTime(cv.updatedAt)}>
              {updatedText(cv.updatedAt)}
            </time>
          </p>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              data-cv-actions
              label={m.list_cv_actions({ name: cv.name })}
              tooltip={false}
              icon={<MoreHorizontal />}
            />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<FileText />} onSelect={() => navigate({ to: '/editor/$cvId', params: { cvId: cv.id } })}>
              {m.common_open()}
            </MenuItem>
            <MenuItem icon={<PenLine />} onSelect={onRename}>
              {m.list_menu_rename()}
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={() => void duplicate(cv)}>
              {m.list_duplicate()}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Languages />} onSelect={onTranslate}>
              {m.list_menu_translate()}
            </MenuItem>
            <MenuItem icon={<ClipboardCheck />} onSelect={() => navigate({ to: '/inceleme', search: { cv: cv.id } })}>
              {m.list_menu_review()}
            </MenuItem>
            <MenuItem icon={<Download />} onSelect={() => exportCvJson(cv)}>
              {m.list_export_json()}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={onDelete}>
              {m.list_menu_delete()}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </article>
  )
}

/** Izgaranın son hücresi: "Yeni CV" (gri dolgu, ortada +; kesikli çerçeve yok). Telefonda başlıktaki düğme yeter. */
function NewCvCell() {
  return (
    <Link
      to="/sablonlar"
      className={cn(
        'press press-wide flex aspect-[210/297] flex-col items-center justify-center gap-2 rounded-sm bg-fill-4 text-fg outline-offset-3',
        'transition-colors duration-150 hover:bg-fill-3 active:bg-fill-2 max-sm:hidden',
      )}
    >
      <Plus className="size-6" strokeWidth={1.5} aria-hidden />
      <span className="text-body">{m.list_new_cv()}</span>
    </Link>
  )
}

function RenameDialog({ cv, onClose }: { cv: Cv | null; onClose: () => void }) {
  const [value, setValue] = useState('')
  // Açılınca ad kutusu CV'nin güncel adıyla dolar.
  if (useChanged(cv, null) && cv) setValue(cv.name)
  const submit = async () => {
    if (!cv) return
    // Kaydedilemediyse pencere açık kalır (yazılan ad kaybolmasın); hata bildirimi rename'den gelir.
    if (await rename(cv, value)) onClose()
  }
  return (
    <Dialog
      open={!!cv}
      onOpenChange={(open) => !open && onClose()}
      title={m.rename_title()}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button variant="primary" size="lg" onClick={() => void submit()} disabled={!value.trim()}>
            {m.common_save()}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          aria-label={m.new_cv_name()}
          className={controlOnContentClass}
        />
      </form>
    </Dialog>
  )
}

/** CV silme onayı (CV'lerim ve editör): ne olacağını söyler; Enter Vazgeç'te, "Sil" yıkıcı. */
export function DeleteDialog({
  cv,
  onClose,
  onDeleted,
  onFailed,
  beforeDelete,
}: {
  cv: Cv | null
  onClose: () => void
  onDeleted?: () => void
  /** Silme başarısız oldu (kullanıcıya bildirildi); `beforeDelete` ile yapılan hazırlık geri alınabilsin. */
  onFailed?: () => void
  beforeDelete?: () => Promise<void>
}) {
  return (
    <Dialog
      open={!!cv}
      onOpenChange={(open) => !open && onClose()}
      title={m.delete_title({ name: cv?.name ?? '' })}
      description={m.delete_body()}
      footer={
        <>
          <Button size="lg" autoFocus onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              if (cv)
                void (async () => {
                  await beforeDelete?.()
                  // Silinemediyse (bildirimi deleteWithUndo verir) listeye dönülmez.
                  if (await deleteWithUndo(cv)) onDeleted?.()
                  else onFailed?.()
                })()
              onClose()
            }}
          >
            {m.common_delete()}
          </Button>
        </>
      }
    >
      <p className="text-body text-fg-2">{m.delete_undo_hint()}</p>
    </Dialog>
  )
}

/** Hatırlatma (kural aynen): hiç yedek yoksa ilk CV'den bir gün sonra; yedek 7 günden eskiyse ve sonra değişiklik varsa. */
function BackupReminder({ cvs, lastBackup }: { cvs: Cv[]; lastBackup: string | undefined | null }) {
  if (lastBackup === null || cvs.length === 0) return null
  const days = daysSince(lastBackup)
  if (days === null) {
    // Hiç yedek yok: ilk CV'yi oluşturur oluşturmaz değil, bir gün sonra hatırlat.
    const oldest = Math.max(...cvs.map((cv) => daysSince(cv.createdAt) ?? 0))
    if (oldest < 1) return null
  } else {
    // Yedekten sonra değişiklik yoksa hatırlatmaya gerek yok.
    const changedSince = cvs.some((cv) => cv.updatedAt > lastBackup!)
    if (days < BACKUP_REMIND_DAYS || !changedSince) return null
  }
  return (
    <Group className="mb-8 max-w-[720px] animate-rise-in" inset="lg" aria-label={m.backup_reminder_title()}>
      <GroupRow
        leading={<TriangleAlert className="text-warn" />}
        title={<span className="font-semibold">{m.backup_reminder_title()}</span>}
        description={days === null ? m.backup_reminder_never() : m.backup_reminder_days({ days: String(days) })}
        trailing={
          <Button onClick={() => void exportAllJson(cvs)}>
            <Download />
            {m.backup_now()}
          </Button>
        }
      />
    </Group>
  )
}

/** Başlık satırının sağındaki yedek durumu: "Son yedek: 3 gün önce · Yedekle". */
function BackupStatus({ cvs, lastBackup }: { cvs: Cv[]; lastBackup: string | undefined | null }) {
  if (lastBackup === null || cvs.length === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-body text-fg-2">
      <span>{lastBackup ? m.list_backup_last({ when: updatedText(lastBackup) }) : m.list_backup_none()}</span>
      <span aria-hidden className="text-fg-3">
        ·
      </span>
      <Button variant="plain" size="sm" className="-mr-2 text-body" onClick={() => void exportAllJson(cvs)}>
        {m.list_backup_action()}
      </Button>
    </p>
  )
}

/**
 * CV'lerim: başlık (sayı düz yazı) + tek cümle ve yedek durumu; sağda arama (/) ve tek birincil
 * "Yeni CV". Izgara Şablonlar'la aynı (4/3/2 sütun); son hücre "Yeni CV". Telefonda liste satırları.
 */
export function CvListPage() {
  const cvs = useLiveQuery(() => db.cvs.orderBy('updatedAt').reverse().toArray())
  const lastBackup = useLiveQuery(() => getMeta<string>(META_LAST_BACKUP), [], null)
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<Cv | null>(null)
  const [deleting, setDeleting] = useState<Cv | null>(null)
  const [translating, setTranslating] = useState<Cv | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    if (!cvs) return []
    // I/İ/ı/i tek harfe katlanır: "it" yazan "IT Manager"ı, "istanbul" yazan "İstanbul"u bulur.
    // Satır ham veritabanı kaydıdır: bozuk kayıt (kişisel bilgisi yok) listeyi çökertmesin.
    return cvs.filter((cv) => matchesSearch(`${cv.name ?? ''} ${cv.personal?.fullName ?? ''}`, query))
  }, [cvs, query])

  /** Silinen kartın yerine odaklanacak öğe: sonraki kart, yoksa önceki, kart kalmadıysa "Yeni CV". */
  const afterDelete = (id: string) => {
    const index = filtered.findIndex((cv) => cv.id === id)
    for (const neighbour of [filtered[index + 1], filtered[index - 1]]) {
      const button = neighbour && neighbour.id !== id ? cardActions(neighbour.id) : null
      if (button) return button
    }
    return document.querySelector<HTMLElement>('[data-new-cv]')
  }

  /** Listeden çeviri: ham satır editörün okuduğu gibi okunur (yükseltilir, onarılır). */
  const startTranslate = (cv: Cv) => {
    try {
      setTranslating(migrateCv(cv))
    } catch (error) {
      console.error(error)
      toast({ message: describeCvError(error), tone: 'error' })
    }
  }

  if (!cvs) return null

  return (
    <div className="animate-fade-in">
      {/* Başlık | araçlar aynı taban çizgisinde; altında 4px ile cümle | yedek durumu. Telefonda alt alta. */}
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-6 max-sm:grid-cols-1 max-sm:gap-y-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-title-lg text-fg">{m.list_title()}</h1>
          {cvs.length > 0 && <span className="text-title-lg font-normal text-fg-2 tabular-nums">{cvs.length}</span>}
        </div>
        <div className="flex items-center gap-2 max-sm:order-last">
          {cvs.length > 0 && (
            <SearchField
              ref={searchRef}
              value={query}
              onValueChange={setQuery}
              placeholder={m.list_search()}
              aria-label={m.list_search()}
              shortcut="/"
              clearLabel={m.list_search_clear()}
              wrapperClassName="w-60 max-sm:w-auto max-sm:flex-1"
            />
          )}
          {/* Boş listede tek birincil eylem boş durumdadır; başlıktaki düğme ikincil olur. */}
          <Link
            to="/sablonlar"
            data-new-cv
            className={buttonClass({ variant: cvs.length > 0 ? 'primary' : 'secondary', size: 'lg' })}
          >
            <Plus />
            {m.list_new_cv()}
          </Link>
        </div>
        <p className="mt-1 text-body text-fg-2 max-sm:mt-0">{m.list_subtitle()}</p>
        <div className="mt-1 flex justify-end max-sm:mt-0 max-sm:justify-start">
          <BackupStatus cvs={cvs} lastBackup={lastBackup} />
        </div>
      </header>

      <BackupReminder cvs={cvs} lastBackup={lastBackup} />

      {cvs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={m.list_empty_title()}
          description={m.list_empty_body()}
          className="py-16"
          actions={
            <>
              <Link
                to="/sablonlar"
                onClick={() => requestImportStart()}
                className={buttonClass({ variant: 'secondary', size: 'lg' })}
              >
                <FileUp />
                {m.list_empty_import()}
              </Link>
              <Link to="/sablonlar" className={buttonClass({ variant: 'primary', size: 'lg' })}>
                {m.list_empty_cta()}
              </Link>
            </>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={m.list_no_match({ query })}
          className="py-16"
          actions={
            <Button size="lg" onClick={() => setQuery('')}>
              {m.list_search_clear()}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 max-sm:grid-cols-1 max-sm:gap-y-4 sm:gap-x-6 sm:gap-y-8 min-[900px]:grid-cols-3 min-[1100px]:grid-cols-4">
          {filtered.map((cv) => (
            <CvCard
              key={cv.id}
              cv={cv}
              onRename={() => setRenaming(cv)}
              onDelete={() => setDeleting(cv)}
              onTranslate={() => startTranslate(cv)}
            />
          ))}
          {!query && <NewCvCell />}
        </div>
      )}

      <RenameDialog
        cv={renaming}
        onClose={() => {
          // Pencere menü maddesinden açıldı; kapanınca odak o kartın işlem düğmesine döner (gövdeye düşmez).
          const id = renaming?.id
          setRenaming(null)
          if (id) focusWhenSettled(() => cardActions(id))
        }}
      />
      <DeleteDialog
        cv={deleting}
        onClose={() => {
          setDeleting(null)
          // Vazgeçildiyse odak aynı kartın işlem düğmesine döner.
          const id = deleting?.id
          if (id) focusWhenSettled(() => cardActions(id) ?? afterDelete(id))
        }}
        // Silindi: kart kalktı; odak komşu karta, kart kalmadıysa "Yeni CV"ye.
        onDeleted={() => deleting && focusWhenSettled(() => afterDelete(deleting.id))}
      />
      {translating && (
        <Suspense fallback={null}>
          <TranslateCvDialog
            cv={translating}
            open
            onClose={() => {
              const id = translating.id
              setTranslating(null)
              focusWhenSettled(() => cardActions(id))
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

/** Listedeki kartın "…" işlem düğmesi. */
function cardActions(id: string) {
  return document.querySelector<HTMLElement>(`[data-cv-card="${CSS.escape(id)}"] [data-cv-actions]`)
}
