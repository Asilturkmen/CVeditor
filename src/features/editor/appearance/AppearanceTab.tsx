import { DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Printer } from 'lucide-react'
import { memo, useDeferredValue, useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { sectionTitle } from '@/cv/locale'
import type { Cv, CvLanguage, Section, TemplateSettings } from '@/cv/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DragHandle } from '@/components/ui/DragHandle'
import { Group } from '@/components/ui/Group'
import { Segmented } from '@/components/ui/Segmented'
import { SelectMenu, type SelectMenuGroup } from '@/components/ui/SelectMenu'
import { Swatches } from '@/components/ui/Swatches'
import { moveSection, setColorSet, setTemplateSetting, toggleSideSection } from '@/editor/actions'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { BODY_FONT_ORDER, FONTS } from '@/render/fonts'

type FontId = keyof typeof FONTS
import { activeColorSet, getTemplate, resolvedBaseColor, supportedColumns, type TemplateDef } from '@/render/templates'
import { colorSetName, TEMPLATE_TEXT } from '@/features/templates/templateText'
import { dndScreenReaderInstructions, useDndAnnouncements } from '../content/dndA11y'
import { useSortDnd, useStableIds } from '../content/keyboardSort'
import { PhotoRow } from '../content/photo'
import { useSortableStyle, VERTICAL_ONLY } from '../content/sortableStyle'

/** Ayar satırı: etiket solda, kontrol sağda (44px); altında isteğe bağlı açıklama (sarar). */
function SettingRow({
  label,
  htmlFor,
  children,
  note,
  labelId,
}: {
  label: ReactNode
  htmlFor?: string
  labelId?: string
  children: ReactNode
  note?: ReactNode
}) {
  return (
    <div className="px-[var(--row-px)] py-2">
      <div className="flex min-h-7 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        {htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className="flex min-h-7 items-center text-body text-fg">
            {label}
          </label>
        ) : (
          <span id={labelId} className="flex min-h-7 items-center text-body text-fg">
            {label}
          </span>
        )}
        <div className="ml-auto flex min-h-7 min-w-0 items-center justify-end gap-2">{children}</div>
      </div>
      {note && <div className="mt-1.5 flex flex-col gap-1 text-callout text-fg-2">{note}</div>}
    </div>
  )
}

let colorSessions = 0

/**
 * Renk seçicisi açıkken her sürükleme adımı bir `input` olayıdır. Seçicinin bir açılışı (ilk
 * değişiklikten `change`/odak kaybına kadar) tek oturumdur: arada ne kadar duraklanırsa duraklansın
 * tek geri alma adımı olur.
 */
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string, session: string) => void }) {
  const session = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // Yerel `change` seçici kapanınca gelir (React'in onChange'i her `input`ta çalışır).
    const end = () => {
      session.current = null
    }
    input.addEventListener('change', end)
    return () => input.removeEventListener('change', end)
  }, [])
  return (
    <label className="press relative inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill-3 pr-2.5 pl-1 text-callout font-medium text-fg hover:bg-fill-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus-ring">
      <span aria-hidden className="size-5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: value }} />
      {label}
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => {
          session.current ??= `color-${++colorSessions}`
          onChange(e.target.value, session.current)
        }}
        onBlur={() => {
          session.current = null
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  )
}

function ColorRow({ cv, template }: { cv: Cv; template: TemplateDef }) {
  const t = cv.template
  const active = activeColorSet(template, t)
  const usesBase = template.colorSets.some((set) => set.base)
  const base = resolvedBaseColor(template, t)
  const options = template.colorSets.map((set) => ({
    value: set.id,
    color: set.base ?? set.accent,
    second: set.base ? set.accent : undefined,
    label: colorSetName(set.id),
  }))
  return (
    <SettingRow
      label={m.ap_accent()}
      note={
        <>
          <span>{m.ap_colors_hint()}</span>
          {template.inkHeavy && (
            <span className="flex items-start gap-1.5">
              <Printer aria-hidden className="mt-px size-3.5 shrink-0" />
              {m.ap_ink_note()}
            </span>
          )}
        </>
      }
    >
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-callout text-fg-2" aria-live="polite">
            {active ? colorSetName(active.id) : m.ap_custom_color()}
          </span>
          <Swatches
            value={active?.id ?? ''}
            onChange={(id) => {
              const set = template.colorSets.find((s) => s.id === id)
              if (set) setColorSet(set)
            }}
            options={options}
            aria-label={m.ap_color_sets()}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ColorInput label={m.ap_custom_color()} value={t.accentColor} onChange={(v, session) => setTemplateSetting('accentColor', v, session)} />
          {usesBase && <ColorInput label={m.ap_custom_base()} value={base} onChange={(v, session) => setTemplateSetting('baseColor', v, session)} />}
        </div>
      </div>
    </SettingRow>
  )
}

const FONT_SAMPLE = 'Ağ Şı İç Ğü'

function fontGroups(): SelectMenuGroup[] {
  const option = (id: FontId) => ({
    value: id,
    short: FONTS[id].label,
    style: { fontFamily: FONTS[id].stack },
    label: (
      <span className="flex items-baseline gap-2">
        <span className="text-body-user">{FONTS[id].label}</span>
        <span className="text-fg-2">{FONT_SAMPLE}</span>
      </span>
    ),
  })
  return [
    { label: m.ap_sans(), options: BODY_FONT_ORDER.filter((id) => FONTS[id].kind !== 'serif').map(option) },
    { label: m.ap_serif(), options: BODY_FONT_ORDER.filter((id) => FONTS[id].kind === 'serif').map(option) },
  ]
}

/** Şablon satırı: geçerli şablonun küçük resmi + adı + düzeni; "Değiştir…" tuvalin solundaki şablon rayını açar. */
const TemplateRow = memo(function TemplateRow({ cv }: { cv: Cv }) {
  const template = getTemplate(cv.templateId)
  const text = TEMPLATE_TEXT[template.id]
  const rail = useEditorUi((s) => s.rail)
  const setRail = useEditorUi((s) => s.setRail)
  return (
    <div className="flex min-h-18 items-center gap-3 px-[var(--row-px)] py-2">
      <div aria-hidden className="h-14 w-10 shrink-0 overflow-hidden rounded-xs bg-paper shadow-thumb">
        <CvFrame cv={cv} scale="fit" fitPadding={0} firstPageOnly title={text.name()} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-headline break-words text-fg">{text.name()}</span>
        <span className="text-callout break-words text-fg-2">{text.features()}</span>
      </div>
      <Button
        aria-expanded={rail === 'templates'}
        onClick={() => setRail(rail === 'templates' ? null : 'templates')}
      >
        {m.ap_template_change()}
      </Button>
    </div>
  )
})

function SectionRow({
  section,
  language,
  twoColumns,
  side,
}: {
  section: Section
  language: CvLanguage
  twoColumns: boolean
  side: boolean
}) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(section.id)
  const title = sectionTitle(language, section.type, section.title)
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex min-h-10 items-center gap-1 bg-content py-1 pr-[var(--row-px)] pl-1 transition-[box-shadow,border-radius,scale] duration-200',
        isDragging && 'z-20 scale-[1.02] rounded-lg bg-elevated shadow-3',
      )}
    >
      <DragHandle label={m.ap_order_drag({ name: title })} {...attributes} {...listeners} className="h-8 self-center" />
      <span className={cn('min-w-0 flex-1 px-1 text-body break-words', section.hidden ? 'text-fg-3' : 'text-fg')}>{title}</span>
      {section.hidden && <Badge>{m.common_hidden()}</Badge>}
      {twoColumns && (
        <Segmented
          size="sm"
          value={side ? 'side' : 'main'}
          onChange={(v) => (v === 'side') !== side && toggleSideSection(section.id)}
          aria-label={m.ap_column_for({ name: title })}
          options={[
            { value: 'side', label: m.ap_side_column() },
            { value: 'main', label: m.ap_main_column() },
          ]}
        />
      )}
    </li>
  )
}

/**
 * Bölümler: tek liste — sıra (sürükle ya da tutamakta Boşluk + oklar; İçerik'teki sürükleme ile aynı
 * eylem, her bırakış tek geri alma adımı) ve iki sütunlu düzende her bölümün sütunu (Yan/Ana).
 */
function SectionsList({ cv, twoColumns }: { cv: Cv; twoColumns: boolean }) {
  const sections = cv.sections
  const dnd = useSortDnd()
  const ids = useStableIds(sections.map((s) => s.id))
  const nameOf = (id: UniqueIdentifier) => {
    const s = sections.find((x) => x.id === id)
    return s ? sectionTitle(cv.language, s.type, s.title) : ''
  }
  const announcements = useDndAnnouncements(nameOf)
  const accessibility = useMemo(() => ({ announcements, screenReaderInstructions: dndScreenReaderInstructions }), [announcements])
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    dnd.reset()
    if (!over || active.id === over.id) return
    const from = sections.findIndex((s) => s.id === active.id)
    const to = sections.findIndex((s) => s.id === over.id)
    if (from >= 0 && to >= 0) moveSection(from, to)
  }
  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      modifiers={VERTICAL_ONLY}
      accessibility={accessibility}
      onDragStart={dnd.reset}
      onDragCancel={dnd.reset}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={m.ap_order()} className="group-rows" data-section-order>
          {sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              language={cv.language}
              twoColumns={twoColumns}
              side={cv.template.sideSections.includes(section.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

/**
 * Görünüm sekmesi (Pages'in Biçim paneli): tek ekranlık ayar satırları, etiket solda kontrol sağda.
 * Şablon ızgarası tuvalin solundaki raya taşındı; burada geçerli şablon + "Değiştir…".
 */
export function AppearanceTab({ cv }: { cv: Cv }) {
  const t = cv.template
  const set = <K extends keyof TemplateSettings>(key: K) => (value: TemplateSettings[K]) => setTemplateSetting(key, value)
  const template = getTemplate(cv.templateId)
  // Küçük resim her değişiklikte yeniden çizilir; yazarken öncelik panelde kalsın.
  const thumbnailCv = useDeferredValue(cv)
  // Çizimle aynı kural: desteklenmeyen sütun sayısı (eski/bozuk kayıt) desteklenene düşer.
  const columns = supportedColumns(template, t.columns)
  const twoColumns = columns === 2
  const columnChoice = template.columns.length > 1
  const fontId = useId()
  const groups = useMemo(() => fontGroups(), [])

  return (
    <div className="flex flex-col gap-6">
      <Group title={m.ap_template()} footer={m.ap_template_hint()}>
        <TemplateRow cv={thumbnailCv} />
      </Group>

      <Group title={m.ap_format()}>
        <ColorRow cv={cv} template={template} />
        <SettingRow label={m.ap_font()} htmlFor={fontId} note={m.ap_font_hint()}>
          <SelectMenu id={fontId} value={t.font} onValueChange={(v) => set('font')(v as FontId)} groups={groups} aria-label={m.ap_font()} className="min-w-40" />
        </SettingRow>
        <SettingRow label={m.ap_font_size()}>
          <Segmented
            value={t.fontSize}
            onChange={set('fontSize')}
            aria-label={m.ap_font_size()}
            options={[
              { value: 'sm', label: m.ap_small() },
              { value: 'md', label: m.ap_normal() },
              { value: 'lg', label: m.ap_large() },
            ]}
          />
        </SettingRow>
        <SettingRow label={m.ap_spacing()}>
          <Segmented
            value={t.spacing}
            onChange={set('spacing')}
            aria-label={m.ap_spacing()}
            options={[
              { value: 'compact', label: m.ap_compact() },
              { value: 'normal', label: m.ap_normal() },
              { value: 'relaxed', label: m.ap_relaxed() },
            ]}
          />
        </SettingRow>
        <SettingRow label={m.ap_header_align()}>
          <Segmented
            value={t.headerAlign}
            onChange={set('headerAlign')}
            aria-label={m.ap_header_align()}
            options={[
              { value: 'left', label: m.ap_left() },
              { value: 'center', label: m.ap_center() },
            ]}
          />
        </SettingRow>
        {/* Tek düzenli şablonda sütun seçeneği yok (yalnız iki sütunluysa Bölümler'de Yan/Ana kalır). */}
        {columnChoice && (
          <SettingRow label={m.ap_columns()}>
            <Segmented
              value={String(columns) as '1' | '2'}
              onChange={(v) => set('columns')(v === '2' ? 2 : 1)}
              aria-label={m.ap_columns()}
              options={[
                { value: '1', label: m.layout_one_column() },
                { value: '2', label: m.layout_two_columns() },
              ]}
            />
          </SettingRow>
        )}
      </Group>

      <Group title={m.ap_photo()}>
        <PhotoRow />
      </Group>

      <Group
        title={m.ap_sections()}
        footer={
          <span className="flex flex-col gap-1">
            <span>{m.ap_order_hint()}</span>
            {twoColumns && <span>{columnChoice ? m.ap_columns_hint() : m.ap_columns_only_two()}</span>}
          </span>
        }
      >
        <SectionsList cv={cv} twoColumns={twoColumns} />
      </Group>
    </div>
  )
}
