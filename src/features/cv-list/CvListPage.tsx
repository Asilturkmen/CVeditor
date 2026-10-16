import { Link, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Download, FileText, MoreHorizontal, PenLine, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { getMeta, META_LAST_BACKUP } from '@/db/repo'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { deleteWithUndo, duplicate, exportAllJson, exportCvJson, exportJsonResume, rename } from '@/features/cv-actions'
import { cn } from '@/lib/cn'
import { useChanged } from '@/lib/useChanged'
import { daysSince, formatDateTime, relativeTime } from '@/lib/time'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { getTemplate } from '@/render/templates'
import { TEMPLATE_TEXT } from '@/features/templates/templateText'

const BACKUP_REMIND_DAYS = 7

function CvCard({ cv, onRename, onDelete }: { cv: Cv; onRename: () => void; onDelete: () => void }) {
  const navigate = useNavigate()
  return (
    <article className="group relative flex flex-col gap-3">
      <Link
        to="/editor/$cvId"
        params={{ cvId: cv.id }}
        className={cn(
          'relative block aspect-[210/297] overflow-hidden rounded-xl border border-line bg-canvas',
          'transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-soft)]',
          'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
        )}
        aria-label={m.list_open_cv({ name: cv.name })}
      >
        <CvFrame cv={cv} scale="fit" fitPadding={0} firstPageOnly className="absolute inset-0" title={cv.name} />
      </Link>
      <div className="flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight break-words sm:min-h-[2lh]" title={cv.name}>
            {cv.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-semibold tracking-wide text-text uppercase">
              {cv.language}
            </span>
            <span>{TEMPLATE_TEXT[getTemplate(cv.templateId).id].name()}</span>
            <span className="text-faint">·</span>
            <span title={formatDateTime(cv.updatedAt)}>{relativeTime(cv.updatedAt)}</span>
          </p>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={m.list_cv_actions({ name: cv.name })}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<FileText />} onSelect={() => navigate({ to: '/editor/$cvId', params: { cvId: cv.id } })}>
              {m.common_open()}
            </MenuItem>
            <MenuItem icon={<PenLine />} onSelect={onRename}>
              {m.common_rename()}
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={() => void duplicate(cv)}>
              {m.list_duplicate()}
            </MenuItem>
            <MenuItem icon={<Download />} onSelect={() => exportCvJson(cv)}>
              {m.list_export_json()}
            </MenuItem>
            <MenuItem icon={<Download />} onSelect={() => exportJsonResume(cv)}>
              {m.imp_json_export()}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={onDelete}>
              {m.common_delete()}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </article>
  )
}

function RenameDialog({ cv, onClose }: { cv: Cv | null; onClose: () => void }) {
  const [value, setValue] = useState('')
  // Açılınca ad kutusu CV'nin güncel adıyla dolar.
  if (useChanged(cv, null) && cv) setValue(cv.name)
  const submit = async () => {
    if (!cv) return
    await rename(cv, value)
    onClose()
  }
  return (
    <Dialog
      open={!!cv}
      onOpenChange={(open) => !open && onClose()}
      title={m.rename_title()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!value.trim()}>
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
        <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-label={m.new_cv_name()} />
      </form>
    </Dialog>
  )
}

export function DeleteDialog({
  cv,
  onClose,
  onDeleted,
  beforeDelete,
}: {
  cv: Cv | null
  onClose: () => void
  onDeleted?: () => void
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
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (cv)
                void (async () => {
                  await beforeDelete?.()
                  await deleteWithUndo(cv)
                  onDeleted?.()
                })()
              onClose()
            }}
          >
            {m.common_delete()}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{m.delete_undo_hint()}</p>
    </Dialog>
  )
}

function BackupReminder({ cvs }: { cvs: Cv[] }) {
  const lastBackup = useLiveQuery(() => getMeta<string>(META_LAST_BACKUP), [], null)
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
    <div className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 animate-rise-in">
      <div className="flex-1 text-sm">
        <p className="font-medium">{m.backup_reminder_title()}</p>
        <p className="text-muted">
          {days === null ? m.backup_reminder_never() : m.backup_reminder_days({ days: String(days) })}
        </p>
      </div>
      <Button size="sm" onClick={() => void exportAllJson(cvs)}>
        <Download />
        {m.backup_now()}
      </Button>
    </div>
  )
}

export function CvListPage() {
  const cvs = useLiveQuery(() => db.cvs.orderBy('updatedAt').reverse().toArray())
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<Cv | null>(null)
  const [deleting, setDeleting] = useState<Cv | null>(null)
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
    const q = query.trim().toLocaleLowerCase('tr')
    if (!q) return cvs
    return cvs.filter((cv) => `${cv.name} ${cv.personal.fullName}`.toLocaleLowerCase('tr').includes(q))
  }, [cvs, query])

  if (!cvs) return null

  return (
    <div className="animate-fade-in">
      <div className="mb-7 flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            {m.list_title()}
            {cvs.length > 0 && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted tabular-nums">
                {cvs.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-muted">{m.list_subtitle()}</p>
        </div>
        {cvs.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.list_search()}
              aria-label={m.list_search()}
              className="w-64 pr-8 pl-9"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-faint sm:block pointer-coarse:hidden">
              /
            </kbd>
          </div>
        )}
        <Link
          to="/sablonlar"
          className={buttonClass({ variant: 'primary' })}
        >
          <Plus />
          {m.list_new_cv()}
        </Link>
      </div>

      <BackupReminder cvs={cvs} />

      {cvs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
          <h2 className="text-lg font-semibold tracking-tight">{m.list_empty_title()}</h2>
          <p className="mt-1.5 max-w-sm text-muted">{m.list_empty_body()}</p>
          <Link
            to="/sablonlar"
            className={buttonClass({ variant: 'primary', className: 'mt-5' })}
          >
            {m.list_empty_cta()}
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">{m.list_no_match({ query })}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-8">
          {filtered.map((cv) => (
            <CvCard key={cv.id} cv={cv} onRename={() => setRenaming(cv)} onDelete={() => setDeleting(cv)} />
          ))}
        </div>
      )}

      <RenameDialog cv={renaming} onClose={() => setRenaming(null)} />
      <DeleteDialog cv={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}
