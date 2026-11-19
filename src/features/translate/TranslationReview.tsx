import { useId, useMemo, useState, type CSSProperties } from 'react'
import type { TranslatedEntry } from '@/ai/translate'
import { stripHtml } from '@/cv/factory'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, CvLanguage, Section } from '@/cv/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { controlOnContentClass } from '@/components/ui/controlClass'
import { Input } from '@/components/ui/Field'
import { Group } from '@/components/ui/Group'
import { InlineNotice } from '@/components/ui/Notice'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { sanitizeRichText } from '@/render/richtext'
import { RichTextField } from '@/features/editor/content/RichTextField'
import { ITEM_FIELDS } from '@/features/editor/content/fieldDefs'
import { itemLabel } from '@/features/editor/labels'
import type { ReviewRow, ReviewState } from './reviewState'

/**
 * Çeviri onay listesi: her alan kaynak ↔ çeviri yan yana (dar yerde alt alta), kaydetmeden önce
 * satır içinde düzeltilebilir; "Çevirme" anahtarı alanı kaynaktaki gibi bırakır.
 *
 * İki kullanım:
 * - CV çevirisi (`source` verilir): solda bölüm listesi (sayı = gösterilen alan), üstte
 *   "Değişen ve işaretli | Tümü" süzgeci (varsayılan: değişen ve işaretli), bölüm bölüm gruplar.
 * - Tek kayıt (`source` null, "Başka CV'ye ekle"): başlıksız, süzgeçsiz tek liste; beyaz dialog
 *   yüzeyinde gri dolgulu blok.
 */

function fieldLabel(entry: TranslatedEntry): string {
  if (!entry.sectionType) return entry.field === 'headline' ? m.f_headline() : entry.field
  if (!entry.itemId) return m.tr8_translate_section_title()
  if (entry.sectionType === 'summary') return m.s_summary()
  return ITEM_FIELDS[entry.sectionType].find((f) => f.key === entry.field)?.label() ?? entry.field
}

/** Kontrol edilmesi gereken alan: çeviri kaynaktan farklı, çeviri gelmedi ya da konum çevrilmedi. */
function isFlagged(entry: TranslatedEntry): boolean {
  return entry.translated !== entry.text || !!entry.missing || !!entry.locationKept
}

interface EntryGroup {
  id: string
  title: string | null
  items: { id: string | null; label: string | null; entries: TranslatedEntry[] }[]
}

function groupEntries(entries: TranslatedEntry[], source: { language: CvLanguage; sections: Section[] } | null): EntryGroup[] {
  const groups: EntryGroup[] = []
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
    <Badge className="mt-[5px] w-7 justify-center uppercase" title={language === 'tr' ? m.lang_tr() : m.lang_en()}>
      {language}
    </Badge>
  )
}

function RichPreview({ html, secondary }: { html: string; secondary?: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 flex-1 pt-1 text-body break-words [&_li+li]:mt-0.5 [&_p+p]:mt-1 [&_ul]:list-disc [&_ul]:pl-4',
        secondary ? 'text-fg-2' : 'text-fg',
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
  const switchId = useId()
  const label = fieldLabel(entry)
  const unchanged = !row.keep && row.value === entry.text
  return (
    <div className="@container flex flex-col gap-2 px-[var(--row-px)] py-3" data-translate-field={entry.key}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-headline text-fg">{label}</span>
        {entry.missing && !row.keep ? (
          <Badge tone="warn" className="h-auto min-h-[18px] whitespace-normal">
            {entry.unrestored ? m.fix_translate_unrestored() : m.tr8_translate_missing()}
          </Badge>
        ) : entry.locationKept && !row.keep ? (
          <Badge tone="warn" className="h-auto min-h-[18px] whitespace-normal" title={m.tr_location_kept_hint()}>
            <span data-testid="translate-location-kept">{m.tr_location_kept()}</span>
          </Badge>
        ) : unchanged ? (
          <Badge>{m.tr8_translate_unchanged()}</Badge>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <label htmlFor={switchId} className="cursor-pointer text-callout text-fg-2">
            {m.tr8_translate_keep()}
          </label>
          <Switch
            id={switchId}
            checked={row.keep}
            onCheckedChange={(keep) => {
              setEditing(false)
              onChange({ ...row, keep })
            }}
            aria-label={m.tr8_translate_keep_label({ field: label })}
          />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-2 @xl:grid-cols-2">
        <div className="flex min-w-0 items-start gap-2">
          <LangTag language={from} />
          {entry.rich ? (
            <RichPreview html={entry.text} secondary />
          ) : (
            <p className="min-w-0 flex-1 pt-1 text-body break-words text-fg-2">{entry.text}</p>
          )}
        </div>

        <div className="flex min-w-0 items-start gap-2">
          <LangTag language={row.keep ? from : to} />
          {row.keep ? (
            <p className="min-w-0 flex-1 pt-1 text-body text-fg-2">{m.tr8_translate_kept()}</p>
          ) : entry.rich ? (
            editing ? (
              <div className="min-w-0 flex-1">
                <RichTextField
                  value={row.value}
                  onChange={(value) => onChange({ ...row, value })}
                  label={m.tr8_translate_after_label({ field: label })}
                />
                <div className="mt-1.5 flex justify-end">
                  <Button size="sm" variant="plain" onClick={() => setEditing(false)}>
                    {m.tr8_translate_done_edit()}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {stripHtml(row.value).trim() ? <RichPreview html={row.value} /> : <span className="flex-1" />}
                <Button size="sm" variant="plain" className="mt-0.5 -mr-2" onClick={() => setEditing(true)}>
                  {m.tr8_translate_edit()}
                </Button>
              </div>
            )
          ) : (
            <Input
              controlSize="sm"
              value={row.value}
              aria-label={m.tr8_translate_after_label({ field: label })}
              onChange={(e) => onChange({ ...row, value: e.target.value })}
              className={cn(controlOnContentClass, 'min-w-0 flex-1')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

type Filter = 'flagged' | 'all'

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
  const navId = useId()
  const flaggedCount = useMemo(() => entries.filter(isFlagged).length, [entries])
  // Süzgeç yalnız CV çevirisinde; hiç işaretli alan yoksa doğrudan "Tümü".
  const [filter, setFilter] = useState<Filter>(source && flaggedCount > 0 ? 'flagged' : 'all')
  const shown = source && filter === 'flagged' ? entries.filter(isFlagged) : entries
  const groups = groupEntries(shown, source)
  const setRow = (key: string, row: ReviewRow) => onChange({ ...state, [key]: row })

  const fields = (list: TranslatedEntry[]) =>
    list.map((entry) => (
      <ReviewField
        key={entry.key}
        entry={entry}
        row={state[entry.key] ?? { value: entry.translated, keep: false }}
        from={from}
        to={to}
        onChange={(row) => setRow(entry.key, row)}
      />
    ))

  if (!source) {
    return (
      <div className="group-rows overflow-hidden rounded-xl bg-fill-4" style={{ '--row-px': '12px' } as CSSProperties}>
        {groups.flatMap((g) => g.items.flatMap((item) => fields(item.entries)))}
      </div>
    )
  }

  const sectionDomId = (groupId: string) => `${navId}-${groupId}`
  const jump = (groupId: string) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(sectionDomId(groupId))?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="flex flex-col">
      {/* Kaydırınca üstte kalır (yapışma kaydırma kabının iç boşluğundan ölçülür: -16px); altından geçen satırlar görünmesin diye pencere zemini. */}
      <div className="sticky -top-4 z-10 -mx-5 -mt-4 bg-window px-5 pt-4 pb-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          aria-label={m.tr_filter_label()}
          options={[
            { value: 'flagged', label: m.tr_filter_flagged({ count: flaggedCount }) },
            { value: 'all', label: m.tr_filter_all({ count: entries.length }) },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 min-[900px]:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label={m.tr_nav_label()} className="sticky top-12 hidden min-[900px]:block">
          <ul className="flex flex-col gap-0.5">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => jump(group.id)}
                  className="press press-wide flex min-h-8 w-full items-center gap-2 rounded-md px-3 text-left text-body text-fg hover:bg-fill-4 active:bg-fill-3"
                >
                  <span className="min-w-0 flex-1 break-words">{group.title}</span>
                  <span className="text-fg-2 tabular-nums">{group.items.reduce((n, i) => n + i.entries.length, 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {groups.length === 0 && <InlineNotice tone="info">{m.tr_none_flagged()}</InlineNotice>}
          {groups.map((group) => (
            <Group key={group.id} id={sectionDomId(group.id)} title={group.title} inset="lg" className="scroll-mt-16">
              {group.items.map((item) => (
                <div key={item.id ?? 'self'}>
                  {item.label && (
                    <p className="px-[var(--row-px)] pt-3 text-body font-semibold break-words text-fg">{item.label}</p>
                  )}
                  <div className="group-rows">{fields(item.entries)}</div>
                </div>
              ))}
            </Group>
          ))}
        </div>
      </div>
    </div>
  )
}

/** "Örnek çeviri" notu: sağlayıcı örnekse gösterilir. */
export function DemoTranslateNote() {
  return (
    <InlineNotice tone="warn">
      <strong className="font-semibold">{m.tr8_translate_demo_title()}.</strong> {m.tr8_translate_demo()}
    </InlineNotice>
  )
}
