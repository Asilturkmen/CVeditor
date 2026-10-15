import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Download, HardDrive, Info, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { parseBackup, type ParsedBackup } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { clearAll, getMeta, importCvs, META_LAST_BACKUP } from '@/db/repo'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { toast } from '@/components/ui/Toaster'
import { exportAllJson } from '@/features/cv-actions'
import { cn } from '@/lib/cn'
import { isChromium, isPersisted, requestPersistence } from '@/lib/persistence'
import { ACCENTS, usePrefs, type AccentId } from '@/lib/prefs'
import { formatDateTime } from '@/lib/time'
import { m } from '@/paraglide/messages'

const ACCENT_NAMES: Record<AccentId, () => string> = {
  petrol: () => m.accent_petrol(),
  murekkep: () => m.accent_murekkep(),
  kiremit: () => m.accent_kiremit(),
  orman: () => m.accent_orman(),
  grafit: () => m.accent_grafit(),
}

function Card({ title, description, children, tone }: { title: string; description?: ReactNode; children: ReactNode; tone?: 'danger' }) {
  return (
    <section
      className={cn(
        'grid grid-cols-1 gap-x-10 gap-y-4 border-b border-line py-8 first:pt-0 last:border-b-0 md:grid-cols-[260px_1fr]',
      )}
    >
      <div>
        <h2 className={cn('text-[15px] font-semibold tracking-tight', tone === 'danger' && 'text-danger')}>{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function RestoreDialog({ parsed, onClose }: { parsed: ParsedBackup | null; onClose: () => void }) {
  const existing = useLiveQuery(() => db.cvs.toCollection().primaryKeys(), [], [] as string[])
  const [mode, setMode] = useState<'keepBoth' | 'replace'>('keepBoth')
  const conflicts = parsed ? parsed.cvs.filter((cv) => existing.includes(cv.id)).length : 0

  const run = async () => {
    if (!parsed) return
    const { added, replaced } = await importCvs(parsed.cvs, mode)
    toast({ message: m.restore_done({ added, replaced }) })
    onClose()
  }

  return (
    <Dialog
      open={!!parsed}
      onOpenChange={(open) => !open && onClose()}
      title={m.restore_title()}
      description={parsed ? m.restore_found({ count: parsed.cvs.length }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button variant="primary" disabled={!parsed || parsed.cvs.length === 0} onClick={() => void run()}>
            {m.restore_submit()}
          </Button>
        </>
      }
    >
      {parsed && (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {parsed.cvs.map((cv: Cv) => (
              <li key={cv.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-semibold uppercase">{cv.language}</span>
                <span className="flex-1 font-medium">{cv.name}</span>
                {existing.includes(cv.id) && <span className="text-xs text-warn">{m.restore_exists()}</span>}
              </li>
            ))}
          </ul>
          {parsed.failures.length > 0 && (
            <div className="rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              <p className="font-medium">{m.restore_failures({ count: parsed.failures.length })}</p>
              <ul className="mt-1 list-disc pl-5">
                {parsed.failures.map((f) => (
                  <li key={f.index}>
                    {f.name}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {conflicts > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">{m.restore_conflicts({ count: conflicts })}</p>
              <Segmented
                value={mode}
                onChange={setMode}
                aria-label={m.restore_conflicts({ count: conflicts })}
                options={[
                  { value: 'keepBoth', label: m.restore_keep_both() },
                  { value: 'replace', label: m.restore_replace() },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

function ClearAllDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false)
  useEffect(() => {
    if (open) setAgreed(false)
  }, [open])
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={m.clear_title()}
      description={m.clear_desc()}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            variant="danger"
            disabled={!agreed}
            onClick={() => {
              void clearAll().then(() => toast({ message: m.clear_done() }))
              onClose()
            }}
          >
            {m.clear_submit()}
          </Button>
        </>
      }
    >
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--danger)]"
        />
        <span>{m.clear_check()}</span>
      </label>
    </Dialog>
  )
}

export function SettingsPage() {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const accent = usePrefs((s) => s.accent)
  const setAccent = usePrefs((s) => s.setAccent)
  const cvs = useLiveQuery(() => db.cvs.orderBy('updatedAt').reverse().toArray(), [], [] as Cv[])
  const lastBackup = useLiveQuery(() => getMeta<string>(META_LAST_BACKUP), [], undefined)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [clearing, setClearing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chromium = isChromium()

  useEffect(() => {
    void isPersisted().then(setPersisted)
  }, [])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setParsed(parseBackup(await file.text()))
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : String(error), tone: 'error' })
    }
  }

  return (
    <div className="max-w-[920px] animate-fade-in">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">{m.settings_title()}</h1>

      <Card title={m.settings_appearance()} description={m.settings_appearance_desc()}>
        <Row label={m.settings_dark()} hint={m.settings_dark_hint()}>
          <Switch checked={theme === 'dark'} onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')} aria-label={m.settings_dark()} />
        </Row>
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-sm font-medium">{m.settings_accent()}</p>
          <p className="mt-0.5 text-[13px] text-muted">{m.settings_accent_hint()}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={m.settings_accent()}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accent === a.id}
                onClick={() => setAccent(a.id)}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm transition-colors',
                  accent === a.id ? 'border-text' : 'border-line hover:border-line-strong',
                )}
              >
                <span className="flex size-6 items-center justify-center rounded-full" style={{ background: a.color }}>
                  {accent === a.id && <Check className="size-3.5 text-white" strokeWidth={3} />}
                </span>
                {ACCENT_NAMES[a.id]()}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title={m.settings_data()} description={m.settings_data_desc()}>
        <Row
          label={m.settings_backup()}
          hint={lastBackup ? m.settings_last_backup({ date: formatDateTime(lastBackup) }) : m.backup_reminder_never()}
        >
          <Button onClick={() => void exportAllJson(cvs)} disabled={cvs.length === 0}>
            <Download />
            {m.settings_backup_button({ count: cvs.length })}
          </Button>
        </Row>
        <Row label={m.settings_restore()} hint={m.settings_restore_hint()}>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload />
            {m.settings_restore_button()}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </Row>
        <Row
          label={m.settings_persist()}
          hint={
            persisted === null
              ? m.settings_persist_unknown()
              : persisted
                ? m.settings_persist_on()
                : m.settings_persist_off()
          }
        >
          {persisted ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-ok">
              <HardDrive className="size-4" />
              {m.settings_persist_ok()}
            </span>
          ) : (
            <Button
              onClick={() =>
                void requestPersistence().then((ok) => {
                  setPersisted(ok)
                  if (!ok) toast({ message: m.settings_persist_denied() })
                })
              }
            >
              {m.settings_persist_request()}
            </Button>
          )}
        </Row>
        <div className="flex gap-3 rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-muted">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>{m.settings_brave_note()}</p>
        </div>
      </Card>

      <Card title={m.settings_browser()} description={m.settings_browser_desc()}>
        <div
          className={cn(
            'flex gap-3 rounded-xl border px-4 py-3 text-sm',
            chromium ? 'border-line bg-surface' : 'border-warn/30 bg-warn-soft',
          )}
        >
          {chromium ? <Check className="mt-0.5 size-4 shrink-0 text-ok" /> : <Info className="mt-0.5 size-4 shrink-0 text-warn" />}
          <p>{chromium ? m.settings_browser_ok() : m.settings_browser_warn()}</p>
        </div>
      </Card>

      <Card title={m.settings_shortcuts()}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          {[
            ['Ctrl+Z', m.common_undo()],
            ['Ctrl+Shift+Z', m.common_redo()],
            ['Ctrl+P', m.pdf_button()],
            ['Ctrl+S', m.shortcut_save()],
            ['/', m.shortcut_search()],
            ['Ctrl+B / Ctrl+I', m.shortcut_format()],
          ].map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-xs">{key}</kbd>
              </dt>
              <dd className="text-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={m.settings_danger()} tone="danger" description={m.settings_danger_desc()}>
        <Row label={m.clear_title()} hint={m.clear_row_hint()}>
          <Button variant="secondary" className="text-danger" onClick={() => setClearing(true)}>
            {m.clear_submit()}
          </Button>
        </Row>
      </Card>

      <Card title={m.settings_about()}>
        <p className="text-sm text-muted">{m.settings_about_body({ version: __APP_VERSION__ })}</p>
      </Card>

      <RestoreDialog parsed={parsed} onClose={() => setParsed(null)} />
      <ClearAllDialog open={clearing} onClose={() => setClearing(false)} />
    </div>
  )
}
