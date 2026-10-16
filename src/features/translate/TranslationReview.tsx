import { Info } from 'lucide-react'
import { useState } from 'react'
import type { TranslatedEntry } from '@/ai/translate'
import { stripHtml } from '@/cv/factory'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, CvLanguage, Section } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { sanitizeRichText } from '@/render/richtext'
import { RichTextField } from '@/features/editor/content/RichTextField'
import { ITEM_FIELDS } from '@/features/editor/content/fieldDefs'
import { itemLabel } from '@/features/editor/labels'
import type { ReviewRow, ReviewState } from './reviewState'

/**
 * Çeviri onay listesi: her alan önce → sonra, kaydetmeden önce satır içinde
 * düzeltilebilir; "Çevirme" anahtarı alanı kaynaktaki gibi bırakır.
 * CV çevirisi ve kayıt düzeyinde çeviri aynı bileşeni kullanır.
 */

function fieldLabel(entry: TranslatedEntry): string {
  if (!entry.sectionType) return entry.field === 'headline' ? m.f_headline() : entry.field
  if (!entry.itemId) return m.tr8_translate_section_title()
  if (entry.sectionType === 'summary') return m.s_summary()
  return ITEM_FIELDS[entry.sectionType].find((f) => f.key === entry.field)?.label() ?? entry.field
}

interface Group {
  id: string
  title: string | null
  items: { id: string | null; label: string | null; entries: TranslatedEntry[] }[]
}

function groupEntries(entries: TranslatedEntry[], source: { language: CvLanguage; sections: Section[] } | null): Group[] {
  const groups: Group[] = []
  for (const entry of entries) {
    const groupId = entry.sectionId ?? 'personal'
    let group = groups.find((g) => g.id === groupId)
    if (!group) {
      const section = source?.sections.find((s) => s.id === entry.sectionId)
      const title = !source ? null : section ? sectionTitle(source.language, section.type, section.title) : m.editor_personal_title()
      group = { id: groupId, title, items: [] }
      groups.push(group)
    }
    let item = group.items.find((i) => i.id === entry.itemId)
    if (!item) {
      const section = source?.sections.find((s) => s.id === entry.sectionId)
      const found = (section?.items as AnyItem[] | undefined)?.find((i) => i.id === entry.itemId)
      // Tek alanlı kayıtlarda (özet) ayrıca kayıt adı yazmaya gerek yok
      const label = found && section && section.type !== 'summary' ? itemLabel(section.type, found) || null : null
      item = { id: entry.itemId, label, entries: [] }
      group.items.push(item)
    }
    item.entries.push(entry)
  }
  return groups
}

function LangTag({ language }: { language: CvLanguage }) {
  return (
    <span className="mt-[3px] w-6 shrink-0 text-[10.5px] font-semibold tracking-wide text-faint uppercase">{language}</span>
  )
}

function RichPreview({ html, muted }: { html: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 flex-1 text-[13px] leading-relaxed [&_li+li]:mt-0.5 [&_p+p]:mt-1 [&_ul]:list-disc [&_ul]:pl-4',
        muted ? 'text-muted' : 'text-text',
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  )
}

function ReviewField({
  entry,
  row,
  from,
  to,
  onChange,
}: {
  entry: TranslatedEntry
  row: ReviewRow
  from: CvLanguage
  to: CvLanguage
  onChange: (row: ReviewRow) => void
}) {
  const [editing, setEditing] = useState(false)
  const label = fieldLabel(entry)
  const unchanged = !row.keep && row.value === entry.text
  return (
    <div className={cn('rounded-lg border px-3 py-2.5 transition-colors duration-150', row.keep ? 'border-line bg-surface-2/50' : 'border-line')}>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        {entry.missing && !row.keep ? (
          <span className="rounded bg-warn-soft px-1.5 py-px text-[11px] font-medium text-warn">
            {entry.unrestored ? m.fix_translate_unrestored() : m.tr8_translate_missing()}
          </span>
        ) : unchanged ? (
          <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] text-faint">{m.tr8_translate_unchanged()}</span>
        ) : null}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted">
          {m.tr8_translate_keep()}
          <Switch
            checked={row.keep}
            onCheckedChange={(keep) => {
              setEditing(false)
              onChange({ ...row, keep })
            }}
            aria-label={m.tr8_translate_keep_label({ field: label })}
          />
        </label>
      </div>

      <div className="mt-2 flex items-start gap-2">
        <LangTag language={from} />
        {entry.rich ? (
          <RichPreview html={entry.text} muted />
        ) : (
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed break-words text-muted">{entry.text}</p>
        )}
      </div>

      <div className="mt-1.5 flex items-start gap-2">
        <LangTag language={row.keep ? from : to} />
        {row.keep ? (
          <p className="min-w-0 flex-1 text-[13px] text-faint italic">{m.tr8_translate_kept()}</p>
        ) : entry.rich ? (
          editing ? (
            <div className="min-w-0 flex-1">
              <RichTextField
                value={row.value}
                onChange={(value) => onChange({ ...row, value })}
                label={m.tr8_translate_after_label({ field: label })}
              />
              <div className="mt-1.5 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  {m.tr8_translate_done_edit()}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {stripHtml(row.value).trim() ? <RichPreview html={row.value} /> : <span className="flex-1" />}
              <Button size="sm" variant="ghost" className="-mt-0.5 -mr-1.5" onClick={() => setEditing(true)}>
                {m.tr8_translate_edit()}
              </Button>
            </div>
          )
        ) : (
          <Input
            value={row.value}
            aria-label={m.tr8_translate_after_label({ field: label })}
            onChange={(e) => onChange({ ...row, value: e.target.value })}
            className="-mt-1 h-8 flex-1 text-[13px]"
          />
        )}
      </div>
    </div>
  )
}

export function TranslationReview({
  entries,
  state,
  onChange,
  from,
  to,
  source,
}: {
  entries: TranslatedEntry[]
  state: ReviewState
  onChange: (state: ReviewState) => void
  from: CvLanguage
  to: CvLanguage
  /** Bölüm/kayıt başlıkları için kaynak CV; null → başlıksız düz liste (tek kayıt) */
  source: { language: CvLanguage; sections: Section[] } | null
}) {
  const groups = groupEntries(entries, source)
  const setRow = (key: string, row: ReviewRow) => onChange({ ...state, [key]: row })
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.id} aria-label={group.title ?? undefined} className="flex flex-col gap-2">
          {group.title && <h3 className="text-[13px] font-semibold tracking-tight">{group.title}</h3>}
          {group.items.map((item) => (
            <div key={item.id ?? 'self'} className="flex flex-col gap-1.5">
              {item.label && <p className="truncate text-xs text-faint">{item.label}</p>}
              {item.entries.map((entry) => (
                <ReviewField
                  key={entry.key}
                  entry={entry}
                  row={state[entry.key] ?? { value: entry.translated, keep: false }}
                  from={from}
                  to={to}
                  onChange={(row) => setRow(entry.key, row)}
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** "Örnek çeviri" notu: sağlayıcı örnekse gösterilir. */
export function DemoTranslateNote() {
  return (
    <div className="flex gap-3 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] text-text">
      <Info className="mt-0.5 size-4 shrink-0 text-warn" />
      <p>
        <strong className="font-semibold">{m.tr8_translate_demo_title()}.</strong> {m.tr8_translate_demo()}
      </p>
    </div>
  )
}
