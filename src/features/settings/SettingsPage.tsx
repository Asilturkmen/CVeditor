import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CvReadError, parseBackup, type ParsedBackup } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { clearAll, getMeta, importCvs, META_LAST_BACKUP } from '@/db/repo'
import { Badge, Kbd } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Group, GroupRow } from '@/components/ui/Group'
import { InlineNotice } from '@/components/ui/Notice'
import { Segmented } from '@/components/ui/Segmented'
import { Swatches } from '@/components/ui/Swatches'
import { Switch } from '@/components/ui/Switch'
import { toast } from '@/components/ui/toast'
import { exportAllJson } from '@/features/cv-actions'
import { isChromium, isPersisted, isSafari, requestPersistence } from '@/lib/persistence'
import { formatShortcut } from '@/lib/platform'
import { ACCENTS, usePrefs, type AccentId } from '@/lib/prefs'
import { formatDateTime } from '@/lib/time'
import { useChanged } from '@/lib/useChanged'
import { m } from '@/paraglide/messages'
import { getLocale, setLocale, type Locale } from '@/paraglide/runtime'

const ACCENT_NAMES: Record<AccentId, () => string> = {
  petrol: () => m.accent_petrol(),
  murekkep: () => m.accent_murekkep(),
  kiremit: () => m.accent_kiremit(),
  orman: () => m.accent_orman(),
  grafit: () => m.accent_grafit(),
}

/** Dil adları her zaman kendi dilinde yazılır (çevrilmez); kullanıcı tanımadığı arayüzde de kendi dilini bulsun. */
const LOCALE_OPTIONS: { value: Locale; label: ReactNode }[] = [
  { value: 'tr', label: <span lang="tr">Türkçe</span> },
  { value: 'en', label: <span lang="en">English</span> },
]

const SHORTCUTS: { keys: string[]; label: () => string }[] = [
  { keys: ['Ctrl+Z'], label: () => m.common_undo() },
  { keys: ['Ctrl+Shift+Z'], label: () => m.common_redo() },
  { keys: ['Ctrl+P'], label: () => m.pdf_button() },
  { keys: ['Ctrl+S'], label: () => m.shortcut_save() },
  { keys: ['/'], label: () => m.shortcut_search() },
  { keys: ['Ctrl+B', 'Ctrl+I'], label: () => m.shortcut_format() },
  { keys: ['Ctrl+\\'], label: () => m.shortcut_rail() },
  { keys: ['Ctrl+0'], label: () => m.shortcut_fit() },
]

/** Ayar grupları arası 32px; başlık title-2, satırlar 16px iç boşluklu (macOS Sistem Ayarları). */
function SettingsGroup({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <Group title={title} size="settings" inset="lg" footer={footer}>
      {children}
    </Group>
  )
}

/**
 * Kontrolü geniş satır (vurgu rengi): dar ekranda kontrol başlığın altına iner; başlık
 * sıkışıp harf harf sarmaz.
 */
function WrapRow({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-[var(--row-px)] py-2.5">
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="text-body text-fg">{title}</span>
        {description && <span className="text-callout text-fg-2">{description}</span>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  )
}

/** Beyaz dialog yüzeyinde liste: gri dolgulu tek blok, satırlar arası ayırıcı (kutu içinde kutu değil). */
const dialogListStyle = { '--row-px': '12px' } as CSSProperties

function RestoreDialog({ parsed, onClose }: { parsed: ParsedBackup | null; onClose: () => void }) {
  const existing = useLiveQuery(() => db.cvs.toCollection().primaryKeys(), [], [] as string[])
  const [mode, setMode] = useState<'keepBoth' | 'replace'>('keepBoth')
  const [busy, setBusy] = useState(false)
  // Çift tıklama aynı yedeği iki kez eklemesin: durum güncellenmeden gelen ikinci tıklamayı da keser.
  const running = useRef(false)
  // Her açılışta baştan başlanır: önceki dosyada seçilen "Yedektekiyle değiştir" yeni dosyaya taşınmaz.
  if (useChanged(parsed, null) && parsed) {
    setMode('keepBoth')
    setBusy(false)
  }
  const conflicts = parsed ? parsed.cvs.filter((cv) => existing.includes(cv.id)).length : 0

  const run = async () => {
    if (!parsed || running.current) return
    running.current = true
    setBusy(true)
    try {
      const { added, replaced } = await importCvs(parsed.cvs, mode)
      toast({ message: m.restore_done({ added, replaced }) })
      onClose()
    } catch (error) {
      // İşlem bütünüyle geri alınır (tek veritabanı işlemi); pencere açık kalır, yeniden denenebilir.
      console.error(error)
      toast({ message: m.err_restore(), tone: 'error' })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={!!parsed}
      onOpenChange={(open) => !open && onClose()}
      title={m.restore_title()}
      description={parsed ? m.restore_found({ count: parsed.cvs.length }) : undefined}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            size="lg"
            variant="primary"
            loading={busy}
            disabled={!parsed || parsed.cvs.length === 0}
            onClick={() => void run()}
          >
            {m.restore_submit()}
          </Button>
        </>
      }
    >
      {parsed && (
        <div className="flex flex-col gap-4">
          {parsed.cvs.length > 0 && (
            <ul className="group-rows overflow-hidden rounded-xl bg-fill-4" style={dialogListStyle}>
              {parsed.cvs.map((cv: Cv) => (
                <li key={cv.id} className="flex min-h-10 items-center gap-2 px-3 py-2 text-body">
                  <Badge className="uppercase">{cv.language}</Badge>
                  <span className="min-w-0 flex-1 break-words text-fg">{cv.name}</span>
                  {existing.includes(cv.id) && <span className="text-callout text-fg-2">{m.restore_exists()}</span>}
                </li>
              ))}
            </ul>
          )}
          {parsed.failures.length > 0 && (
            <div>
              <InlineNotice tone="danger">{m.restore_failures({ count: parsed.failures.length })}</InlineNotice>
              <ul className="mt-1 list-disc pl-11 text-callout text-fg-2">
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
              <p className="text-body text-fg">{m.restore_conflicts({ count: conflicts })}</p>
              <Segmented
                value={mode}
                onChange={setMode}
                stretch
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
  if (useChanged(open, false) && open) setAgreed(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={m.clear_title()}
      description={m.clear_desc()}
      footer={
        <>
          {/* Yıkıcı onayda Enter Vazgeç'e gider. */}
          <Button size="lg" autoFocus onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            size="lg"
            variant="destructive"
            disabled={!agreed}
            onClick={() => {
              void clearAll().then(
                () => toast({ message: m.clear_done() }),
                (error) => {
                  console.error(error)
                  toast({ message: m.err_clear(), tone: 'error' })
                },
              )
              onClose()
            }}
          >
            {m.clear_submit()}
          </Button>
        </>
      }
    >
      <Checkbox checked={agreed} onCheckedChange={setAgreed} label={m.clear_check()} />
    </Dialog>
  )
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <span className="text-callout text-fg-3">/</span>}
          <Kbd className="text-callout">{formatShortcut(key)}</Kbd>
        </Fragment>
      ))}
    </span>
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
  const darkId = useId()
  const chromium = isChromium()
  const safari = isSafari()

  useEffect(() => {
    void isPersisted().then(setPersisted)
  }, [])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setParsed(parseBackup(await file.text()))
    } catch (error) {
      // Bilinen nedenler arayüz dilinde gelir; beklenmeyen hata ham hâliyle gösterilmez.
      if (!(error instanceof CvReadError)) console.error(error)
      toast({ message: error instanceof CvReadError ? error.message : m.err_backup_read(), tone: 'error' })
    }
  }

  return (
    <div className="mx-auto flex max-w-[720px] animate-fade-in flex-col gap-8 pb-12">
      <h1 className="text-title-lg text-fg">{m.settings_title()}</h1>

      <SettingsGroup title={m.settings_appearance()} footer={m.settings_appearance_desc()}>
        <GroupRow
          title={m.settings_language()}
          description={m.settings_language_hint()}
          trailing={
            // setLocale tercihi localStorage'a yazar ve sayfayı yeniden yükler.
            <Segmented value={getLocale()} onChange={(locale) => void setLocale(locale)} aria-label={m.settings_language()} options={LOCALE_OPTIONS} />
          }
        />
        <GroupRow
          title={m.settings_dark()}
          description={m.settings_dark_hint()}
          htmlFor={darkId}
          trailing={<Switch id={darkId} checked={theme === 'dark'} onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')} />}
        />
        <WrapRow title={m.settings_accent()} description={m.settings_accent_hint()}>
          <span className="text-body text-fg-2" aria-hidden>
            {ACCENT_NAMES[accent]()}
          </span>
          <Swatches
            value={accent}
            onChange={(id) => setAccent(id as AccentId)}
            aria-label={m.settings_accent()}
            // Daire, vurgunun bu temadaki hâlini gösterir (koyuda açık ton).
            options={ACCENTS.map((a) => ({ value: a.id, color: theme === 'dark' ? a.dark : a.color, label: ACCENT_NAMES[a.id]() }))}
          />
        </WrapRow>
      </SettingsGroup>

      <SettingsGroup
        title={m.settings_data()}
        footer={
          <div className="flex flex-col gap-2">
            <p>{m.settings_data_desc()}</p>
            <p>{m.settings_brave_note()}</p>
          </div>
        }
      >
        <GroupRow
          title={m.settings_backup()}
          description={lastBackup ? m.settings_last_backup({ date: formatDateTime(lastBackup) }) : m.backup_reminder_never()}
          trailing={
            <Button onClick={() => void exportAllJson(cvs)} disabled={cvs.length === 0}>
              {cvs.length > 0 ? m.settings_backup_button({ count: cvs.length }) : m.ux_settings_backup_empty()}
            </Button>
          }
        />
        <GroupRow
          title={m.settings_restore()}
          description={m.settings_restore_hint()}
          trailing={
            <>
              <Button onClick={() => fileRef.current?.click()}>{m.settings_restore_button()}</Button>
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
            </>
          }
        />
        <GroupRow
          title={m.settings_persist()}
          description={
            persisted === null ? m.settings_persist_unknown() : persisted ? m.settings_persist_on() : m.settings_persist_off()
          }
          trailing={
            persisted ? (
              <span className="inline-flex items-center gap-1.5 text-body text-fg-2">
                <CircleCheck aria-hidden className="size-4 text-ok" />
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
            )
          }
        />
      </SettingsGroup>

      <SettingsGroup title={m.settings_browser()} footer={m.settings_browser_desc()}>
        <GroupRow
          leading={chromium ? <CircleCheck className="text-ok" /> : <TriangleAlert className="text-warn" />}
          title={chromium ? m.settings_browser_ok() : m.settings_browser_warn()}
        />
        {safari && <GroupRow leading={<TriangleAlert className="text-warn" />} title={m.settings_browser_safari()} />}
      </SettingsGroup>

      <SettingsGroup title={m.settings_shortcuts()}>
        {SHORTCUTS.map((s) => (
          <GroupRow key={s.keys.join()} title={s.label()} trailing={<ShortcutKeys keys={s.keys} />} />
        ))}
      </SettingsGroup>

      <SettingsGroup title={m.settings_danger()} footer={m.settings_danger_desc()}>
        <GroupRow
          title={m.clear_title()}
          description={m.clear_row_hint()}
          trailing={
            <Button variant="destructive" onClick={() => setClearing(true)}>
              {m.settings_clear_button()}
            </Button>
          }
        />
      </SettingsGroup>

      <SettingsGroup title={m.settings_about()}>
        <GroupRow title={m.settings_about_body({ version: __APP_VERSION__ })} />
      </SettingsGroup>

      <RestoreDialog parsed={parsed} onClose={() => setParsed(null)} />
      <ClearAllDialog open={clearing} onClose={() => setClearing(false)} />
    </div>
  )
}
