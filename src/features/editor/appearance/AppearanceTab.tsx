import { DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { sectionTitle } from '@/cv/locale'
import { FONT_IDS, type Cv, type CvLanguage, type Section, type TemplateSettings } from '@/cv/schema'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { moveSection, setTemplateSetting, switchTemplate, toggleSideSection } from '@/editor/actions'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { FONTS } from '@/render/fonts'
import { defaultSideSections, getTemplate, TEMPLATE_LIST, TEMPLATES, type TemplateId } from '@/render/templates'
import { visibleSections } from '@/render/visibleSections'
import { TEMPLATE_TEXT } from '@/features/templates/templateText'
import { dndScreenReaderInstructions, useDndAnnouncements } from '../content/dndA11y'
import { useSortDnd } from '../content/keyboardSort'
import { DragHandle } from '../content/sortable'
import { useSortableStyle, verticalOnly } from '../content/sortableStyle'

/** CV vurgu renkleri; ekran okuyucu için Türkçe adlarıyla. */
const ACCENT_PRESETS: { color: string; name: () => string }[] = [
  { color: '#1f5f8b', name: () => m.ux_color_blue() },
  { color: '#2f6f62', name: () => m.accent_petrol() },
  { color: '#24543d', name: () => m.accent_orman() },
  { color: '#7a3e2b', name: () => m.accent_kiremit() },
  { color: '#8a5a14', name: () => m.ux_color_mustard() },
  { color: '#5b3f7a', name: () => m.ux_color_purple() },
  { color: '#3a3a3a', name: () => m.accent_grafit() },
  { color: '#1c2b4a', name: () => m.ux_color_navy() },
]

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-line py-5 first:pt-1 last:border-b-0">
      <div>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function TemplateChoice({ cv, id }: { cv: Cv; id: TemplateId }) {
  const active = cv.templateId === id
  const preview = useMemo<Cv>(() => {
    if (active) return cv
    // switchTemplate ile aynı kural: kullanıcı değiştirmediyse renk/yazı tipi yeni şablonunki.
    const previous = getTemplate(cv.templateId).defaults
    const next = TEMPLATES[id].defaults
    return {
      ...cv,
      templateId: id,
      template: {
        ...cv.template,
        columns: next.columns,
        accentColor: cv.template.accentColor === previous.accentColor ? next.accentColor : cv.template.accentColor,
        font: cv.template.font === previous.font ? next.font : cv.template.font,
        sideSections: cv.template.sideSections.length ? cv.template.sideSections : defaultSideSections(cv.sections),
      },
    }
  }, [cv, id, active])
  const template = TEMPLATE_LIST.find((t) => t.id === id)!
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => switchTemplate(id)}
      className="group flex flex-col gap-2 text-left"
    >
      <div
        className={cn(
          'relative aspect-[210/297] overflow-hidden rounded-lg border bg-canvas transition-[border-color,box-shadow,transform] duration-200',
          active ? 'border-accent shadow-[0_0_0_2px_var(--accent)]' : 'border-line group-hover:-translate-y-0.5 group-hover:border-line-strong',
        )}
      >
        <CvFrame cv={preview} scale="fit" fitPadding={0} firstPageOnly title={TEMPLATE_TEXT[template.id].name()} />
        {active && (
          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm animate-[pop-in_200ms_var(--ease-spring)]">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold">{TEMPLATE_TEXT[template.id].name()}</p>
        <p className="text-xs text-muted">{TEMPLATE_TEXT[id].layout()}</p>
      </div>
    </button>
  )
}

function SectionOrderRow({ section, language }: { section: Section; language: CvLanguage }) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(section.id)
  const title = sectionTitle(language, section.type, section.title)
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 bg-surface py-1.5 pr-3 pl-1.5 transition-[box-shadow,border-radius] duration-200',
        isDragging && 'rounded-lg shadow-lg ring-1 ring-accent-line',
      )}
    >
      <DragHandle label={m.ap_order_drag({ name: title })} {...attributes} {...listeners} />
      <span className={cn('min-w-0 flex-1 truncate text-[13px]', section.hidden && 'text-muted')}>{title}</span>
      {section.hidden && (
        <span className="rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-medium text-muted">{m.common_hidden()}</span>
      )}
    </li>
  )
}

/**
 * Bölüm sırası: İçerik sekmesindeki sürükle-bırak ile aynı eylem (moveSection), her
 * bırakış tek geri alma adımı. Klavye: tutamakta Boşluk, oklar, Boşluk (Escape vazgeçer).
 */
function SectionOrder({ sections, language }: { sections: Section[]; language: CvLanguage }) {
  const dnd = useSortDnd()
  const announcements = useDndAnnouncements((id: UniqueIdentifier) => {
    const s = sections.find((x) => x.id === id)
    return s ? sectionTitle(language, s.type, s.title) : ''
  })
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
      modifiers={[verticalOnly]}
      accessibility={{ announcements, screenReaderInstructions: dndScreenReaderInstructions }}
      onDragStart={dnd.reset}
      onDragCancel={dnd.reset}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label={m.ap_order()} className="flex flex-col divide-y divide-line rounded-lg border border-line" data-section-order>
          {sections.map((section) => (
            <SectionOrderRow key={section.id} section={section} language={language} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

export function AppearanceTab({ cv }: { cv: Cv }) {
  const t = cv.template
  const set = <K extends keyof TemplateSettings>(key: K) => (value: TemplateSettings[K]) => setTemplateSetting(key, value)
  const sections = visibleSections(cv)

  return (
    <div className="flex flex-col">
      <Group title={m.ap_template()} hint={m.ap_template_hint()}>
        <div role="radiogroup" aria-label={m.ap_template()} className="grid grid-cols-2 gap-4">
          {TEMPLATE_LIST.map((tpl) => (
            <TemplateChoice key={tpl.id} cv={cv} id={tpl.id} />
          ))}
        </div>
      </Group>

      <Group title={m.ap_accent()}>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={m.ap_accent()}>
          {ACCENT_PRESETS.map(({ color, name }) => {
            const active = t.accentColor.toLowerCase() === color
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={name()}
                title={name()}
                onClick={() => set('accentColor')(color)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-[transform,box-shadow] duration-150 hover:scale-105',
                  active ? 'ring-2 ring-text' : 'ring-1 ring-black/10 ring-inset dark:ring-white/25',
                )}
                style={{ background: color }}
              >
                {active && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            )
          })}
          <label className="relative flex h-8 cursor-pointer items-center gap-2 rounded-full border border-line pr-3 pl-1 text-xs text-muted hover:border-line-strong">
            <span className="size-6 rounded-full border border-line" style={{ background: t.accentColor }} />
            {m.ap_custom_color()}
            <input
              type="color"
              value={t.accentColor}
              onChange={(e) => set('accentColor')(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={m.ap_custom_color()}
            />
          </label>
        </div>
      </Group>

      <Group title={m.ap_font()} hint={m.ap_font_hint()}>
        <div className="grid grid-cols-1 gap-1.5" role="radiogroup" aria-label={m.ap_font()}>
          {FONT_IDS.map((id) => {
            const font = FONTS[id]
            const active = t.font === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set('font')(id)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
                  active ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                )}
              >
                <span style={{ fontFamily: font.stack }} className="text-[15px]">
                  {font.label}
                  <span className="ml-2 text-muted">Ağ Şı İç Ğü</span>
                </span>
                <span className="text-xs text-muted">{font.kind === 'serif' ? m.ap_serif() : m.ap_sans()}</span>
              </button>
            )
          })}
        </div>
      </Group>

      <Group title={m.ap_size_spacing()}>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
          <span className="text-[13px] text-muted">{m.ap_font_size()}</span>
          <Segmented
            stretch
            value={t.fontSize}
            onChange={set('fontSize')}
            aria-label={m.ap_font_size()}
            options={[
              { value: 'sm', label: m.ap_small() },
              { value: 'md', label: m.ap_normal() },
              { value: 'lg', label: m.ap_large() },
            ]}
          />
          <span className="text-[13px] text-muted">{m.ap_spacing()}</span>
          <Segmented
            stretch
            value={t.spacing}
            onChange={set('spacing')}
            aria-label={m.ap_spacing()}
            options={[
              { value: 'compact', label: m.ap_compact() },
              { value: 'normal', label: m.ap_normal() },
              { value: 'relaxed', label: m.ap_relaxed() },
            ]}
          />
          <span className="text-[13px] text-muted">{m.ap_header_align()}</span>
          <Segmented
            stretch
            value={t.headerAlign}
            onChange={set('headerAlign')}
            aria-label={m.ap_header_align()}
            options={[
              { value: 'left', label: m.ap_left() },
              { value: 'center', label: m.ap_center() },
            ]}
          />
        </div>
      </Group>

      <Group title={m.ap_columns()} hint={t.columns === 2 ? m.ap_columns_hint() : undefined}>
        <Segmented
          stretch
          value={String(t.columns) as '1' | '2'}
          onChange={(v) => set('columns')(v === '2' ? 2 : 1)}
          aria-label={m.ap_columns()}
          options={[
            { value: '1', label: m.layout_one_column() },
            { value: '2', label: m.layout_two_columns() },
          ]}
        />
        {t.columns === 2 && (
          <ul className="mt-1 flex flex-col divide-y divide-line rounded-lg border border-line">
            {sections.map((section) => {
              const side = t.sideSections.includes(section.id)
              return (
                <li key={section.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[13px]">{sectionTitle(cv.language, section.type, section.title)}</span>
                  <Segmented
                    size="sm"
                    value={side ? 'side' : 'main'}
                    onChange={(v) => (v === 'side') !== side && toggleSideSection(section.id)}
                    aria-label={m.ap_column_for({ name: sectionTitle(cv.language, section.type, section.title) })}
                    options={[
                      { value: 'side', label: m.ap_side_column() },
                      { value: 'main', label: m.ap_main_column() },
                    ]}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Group>

      <Group title={m.ap_photo()} hint={cv.personal.photo ? undefined : m.ap_photo_none()}>
        <label className="flex items-center justify-between gap-3">
          <span className="text-[13px]">{m.ap_photo_show()}</span>
          <Switch
            checked={t.showPhoto}
            onCheckedChange={set('showPhoto')}
            aria-label={m.ap_photo_show()}
          />
        </label>
      </Group>

      <Group title={m.ap_order()} hint={m.ap_order_hint()}>
        <SectionOrder sections={cv.sections} language={cv.language} />
      </Group>
    </div>
  )
}
