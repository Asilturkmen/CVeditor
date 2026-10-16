import { DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Copy, Eye, EyeOff, MoreHorizontal, PenLine, Plus, RotateCcw, Send, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { isItemEmpty } from '@/cv/factory'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, CvLanguage, DateRange, Section, SectionType, YearMonth } from '@/cv/schema'
import { SECTION_TYPES } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { toast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  addItem,
  addSection,
  duplicateItem,
  moveItem,
  moveSection,
  removeItem,
  removeSection,
  renameSection,
  restoreItem,
  restoreSection,
  setItemField,
  toggleItemHidden,
  toggleSectionHidden,
} from '@/editor/actions'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { itemLabel } from '../labels'
import { CopyToCvDialog } from './CopyToCvDialog'
import { DateRangeField, YearMonthField } from './DateFields'
import { dndScreenReaderInstructions, useDndAnnouncements } from './dndA11y'
import { ADD_ITEM_LABELS, ITEM_FIELDS, SECTION_LABELS, type FieldDef } from './fieldDefs'
import { useSortDnd } from './keyboardSort'
import { RichTextField } from './RichTextField'
import { DragHandle } from './sortable'
import { useSortableStyle, verticalOnly } from './sortableStyle'

function HideToggle({ hidden, onToggle, label }: { hidden: boolean; onToggle: () => void; label: string }) {
  const text = hidden ? m.common_show() : m.common_hide()
  return (
    <Tooltip content={`${text}: ${label}`}>
      <Button variant="ghost" size="icon-sm" aria-label={`${text}: ${label}`} aria-pressed={hidden} onClick={onToggle}>
        {hidden ? <EyeOff /> : <Eye />}
      </Button>
    </Tooltip>
  )
}

/** Kayıt alanları: bölüm türüne göre tanımlı (fieldDefs). */
function ItemFields({ sectionId, type, item }: { sectionId: string; type: Exclude<SectionType, 'summary'>; item: AnyItem }) {
  const record = item as unknown as Record<string, unknown>
  const set = (key: string) => (value: unknown) => setItemField(sectionId, item.id, key, value)
  const render = (f: FieldDef): ReactNode => {
    switch (f.kind) {
      case 'rich':
        return (
          <div key={f.key} className="col-span-2 flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">{f.label()}</span>
            <RichTextField
              label={f.label()}
              value={(record[f.key] as string) ?? ''}
              onChange={set(f.key)}
              placeholder={f.placeholder?.()}
            />
          </div>
        )
      case 'range':
        return (
          <div key={f.key} className="col-span-2">
            <DateRangeField value={record[f.key] as DateRange} onChange={set(f.key)} />
          </div>
        )
      case 'month':
        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">{f.label()}</span>
            <YearMonthField label={f.label()} value={record[f.key] as YearMonth | null} onChange={set(f.key)} />
          </div>
        )
      default:
        return (
          <Field key={f.key} label={f.label()} className={cn(f.wide && 'col-span-2')}>
            {(id) => (
              <Input
                id={id}
                type={f.kind === 'url' ? 'text' : f.kind}
                inputMode={f.kind === 'url' ? 'url' : undefined}
                value={(record[f.key] as string) ?? ''}
                placeholder={f.placeholder?.()}
                onChange={(e) => set(f.key)(e.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
        )
    }
  }
  return <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">{ITEM_FIELDS[type].map(render)}</div>
}

function deleteItemWithUndo(section: Section, item: AnyItem) {
  const removed = removeItem(section.id, item.id)
  if (!removed) return
  if (isItemEmpty(item)) return
  toast({
    message: m.toast_item_deleted({ name: itemLabel(section.type, item) || m.editor_untitled() }),
    action: { label: m.common_undo(), run: () => restoreItem(section.id, removed) },
  })
}

const ItemCard = memo(function ItemCard({
  section,
  item,
  onCopyToCv,
}: {
  section: Section
  item: AnyItem
  onCopyToCv: (item: AnyItem) => void
}) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(item.id)
  const focusItem = useEditorUi((s) => s.focusItem)
  const blurItem = useEditorUi((s) => s.blurItem)
  const focused = useEditorUi((s) => s.focusedItemId === item.id)
  const label = itemLabel(section.type, item) || m.editor_untitled()
  const type = section.type as Exclude<SectionType, 'summary'>
  const compact = type === 'skills' || type === 'languages'

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`item-${item.id}`}
      onFocusCapture={() => focusItem(item.id)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && blurItem(item.id)}
      className={cn(
        'rounded-xl border bg-surface transition-[box-shadow,border-color,opacity] duration-200',
        focused ? 'border-accent-line' : 'border-line',
        isDragging && 'shadow-lg ring-1 ring-accent-line',
        item.hidden && 'opacity-60',
      )}
    >
      <div className={cn('flex items-center gap-1.5 pr-1.5 pl-1.5', compact ? 'py-1.5' : 'border-b border-line py-1.5')}>
        <DragHandle label={m.drag_item()} {...attributes} {...listeners} />
        <span
          title={label}
          className={cn('line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug font-medium break-words', !itemLabel(section.type, item) && 'text-faint')}
        >
          {label}
        </span>
        {item.hidden && (
          <span className="rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-medium text-muted">{m.common_hidden()}</span>
        )}
        <HideToggle hidden={item.hidden} label={label} onToggle={() => toggleItemHidden(section.id, item.id)} />
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={m.item_actions({ name: label })}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              icon={<Copy />}
              onSelect={() => {
                const id = duplicateItem(section.id, item.id)
                if (id) focusItem(id, true)
              }}
            >
              {m.item_duplicate()}
            </MenuItem>
            <MenuItem icon={<Send />} onSelect={() => onCopyToCv(item)}>
              {m.item_copy_to_cv()}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => deleteItemWithUndo(section, item)}>
              {m.common_delete()}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className={cn(compact ? 'px-3 pb-3' : 'p-3')}>
        <ItemFields sectionId={section.id} type={type} item={item} />
      </div>
    </div>
  )
})

function SummaryEditor({ section, language }: { section: Section; language: CvLanguage }) {
  const item = section.items[0] as AnyItem | undefined
  const focusItem = useEditorUi((s) => s.focusItem)
  const blurItem = useEditorUi((s) => s.blurItem)
  if (!item) {
    return (
      <Button size="sm" variant="ghost" onClick={() => addItem(section.id)}>
        <Plus />
        {m.add_summary()}
      </Button>
    )
  }
  const content = (item as unknown as { content: string }).content
  return (
    <div
      id={`item-${item.id}`}
      onFocusCapture={() => focusItem(item.id)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && blurItem(item.id)}
      className="rounded-xl"
    >
      <RichTextField
        label={sectionTitle(language, 'summary', section.title)}
        value={content}
        onChange={(html) => setItemField(section.id, item.id, 'content', html)}
        placeholder={m.ph_summary()}
      />
    </div>
  )
}

function SectionTitle({ section, language }: { section: Section; language: CvLanguage }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const title = sectionTitle(language, section.type, section.title)

  if (editing) {
    const commit = () => {
      const trimmed = value.trim()
      renameSection(section.id, trimmed && trimmed !== sectionTitle(language, section.type, null) ? trimmed : null)
      setEditing(false)
    }
    return (
      <Input
        autoFocus
        value={value}
        aria-label={m.section_rename()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-7 max-w-56 text-sm font-semibold"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(title)
        setEditing(true)
      }}
      className="group/title flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-2"
      aria-label={m.section_rename_named({ name: title })}
    >
      <span className="min-w-0 text-[15px] font-semibold tracking-tight break-words">{title}</span>
      <PenLine className="size-3.5 shrink-0 text-faint transition-colors group-hover/title:text-text group-focus-visible/title:text-text" />
    </button>
  )
}

const SectionCard = memo(function SectionCard({
  section,
  language,
  onCopyToCv,
  onRequestDelete,
}: {
  section: Section
  language: CvLanguage
  onCopyToCv: (section: Section, item: AnyItem) => void
  onRequestDelete: (section: Section) => void
}) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(section.id)
  const dnd = useSortDnd()
  const title = sectionTitle(language, section.type, section.title)
  const items = section.items as AnyItem[]
  const focusItem = useEditorUi((s) => s.focusItem)
  const itemName = (id: UniqueIdentifier) => {
    const item = items.find((i) => i.id === id)
    return (item && itemLabel(section.type, item)) || m.editor_untitled()
  }
  const itemAnnouncements = useDndAnnouncements(itemName)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    dnd.reset()
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from >= 0 && to >= 0) moveItem(section.id, from, to)
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={title}
      className={cn(
        'rounded-2xl transition-[box-shadow,background-color] duration-200',
        isDragging && 'bg-bg shadow-lg ring-1 ring-line',
      )}
    >
      <header className="flex items-center gap-1.5 py-2">
        <DragHandle label={m.drag_section()} {...attributes} {...listeners} />
        <SectionTitle section={section} language={language} />
        {section.type !== 'summary' && items.length > 0 && (
          <span className="text-xs text-faint tabular-nums">
            <span aria-hidden>{items.length}</span>
            <span className="sr-only">{m.ux_section_item_count({ count: items.length })}</span>
          </span>
        )}
        {section.hidden && (
          <span className="rounded-full bg-surface-2 px-1.5 py-px text-[11px] font-medium text-muted">{m.common_hidden()}</span>
        )}
        <div className="ml-auto flex items-center">
          <HideToggle hidden={section.hidden} label={title} onToggle={() => toggleSectionHidden(section.id)} />
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={m.section_actions({ name: title })}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              {section.title && (
                <MenuItem icon={<RotateCcw />} onSelect={() => renameSection(section.id, null)}>
                  {m.section_reset_title({ name: sectionTitle(language, section.type, null) })}
                </MenuItem>
              )}
              <MenuItem icon={<Trash2 />} danger onSelect={() => onRequestDelete(section)}>
                {m.section_delete()}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>
      <div className={cn('flex flex-col gap-2.5 pb-2 pl-7.5 transition-opacity', section.hidden && 'opacity-60')}>
        {section.type === 'summary' ? (
          <SummaryEditor section={section} language={language} />
        ) : (
          <>
            <DndContext
              sensors={dnd.sensors}
              collisionDetection={dnd.collisionDetection}
              modifiers={[verticalOnly]}
              accessibility={{ announcements: itemAnnouncements, screenReaderInstructions: dndScreenReaderInstructions }}
              onDragStart={dnd.reset}
              onDragCancel={dnd.reset}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.map((item) => (
                  <ItemCard key={item.id} section={section} item={item} onCopyToCv={(it) => onCopyToCv(section, it)} />
                ))}
              </SortableContext>
            </DndContext>
            {items.length === 0 && <p className="text-[13px] text-muted">{m.section_empty()}</p>}
            <div>
              <Button
                size="sm"
                variant="ghost"
                className="-ml-1 text-accent hover:text-accent"
                onClick={() => {
                  const id = addItem(section.id)
                  if (id) focusItem(id, true)
                }}
              >
                <Plus />
                {ADD_ITEM_LABELS[section.type]()}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
})

function AddSectionMenu({ existing }: { existing: Set<SectionType> }) {
  const focusItem = useEditorUi((s) => s.focusItem)
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button className="w-full justify-center border-dashed shadow-none">
          <Plus />
          {m.section_add()}
        </Button>
      </MenuTrigger>
      <MenuContent align="center">
        <MenuLabel>{m.section_add_label()}</MenuLabel>
        {SECTION_TYPES.map((type) => {
          const used = type !== 'custom' && existing.has(type)
          return (
            <MenuItem
              key={type}
              disabled={used}
              hint={used ? m.section_already_added() : undefined}
              onSelect={() => {
                addSection(type)
                setTimeout(() => {
                  const el = document.querySelector('[data-section-list] > :last-child')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  focusItem(null)
                }, 50)
              }}
            >
              {SECTION_LABELS[type]()}
            </MenuItem>
          )
        })}
      </MenuContent>
    </Menu>
  )
}

export function SectionList({ sections, language, cvId }: { sections: Section[]; language: CvLanguage; cvId: string }) {
  const dnd = useSortDnd()
  const [copying, setCopying] = useState<{ type: SectionType; item: AnyItem } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Section | null>(null)
  const scrollTarget = useEditorUi((s) => s.scrollTarget)
  const lastNonce = useRef(0)

  // Önizlemede tıklanan kayda kaydır ve kısa süre vurgula.
  useEffect(() => {
    if (!scrollTarget || scrollTarget.nonce === lastNonce.current) return
    lastNonce.current = scrollTarget.nonce
    const el = document.getElementById(scrollTarget.id === 'personal' ? 'personal-card' : `item-${scrollTarget.id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('animate-flash')
    void el.offsetWidth
    el.classList.add('animate-flash')
    // İlk alana imleç: tıklayıp hemen yazmaya başlanabilsin.
    el.querySelector<HTMLElement>('input, [contenteditable="true"]')?.focus({ preventScroll: true })
  }, [scrollTarget])

  const sectionName = (id: UniqueIdentifier) => {
    const s = sections.find((x) => x.id === id)
    return s ? sectionTitle(language, s.type, s.title) : ''
  }
  const sectionAnnouncements = useDndAnnouncements(sectionName)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    dnd.reset()
    if (!over || active.id === over.id) return
    const from = sections.findIndex((s) => s.id === active.id)
    const to = sections.findIndex((s) => s.id === over.id)
    if (from >= 0 && to >= 0) moveSection(from, to)
  }

  const doDelete = useCallback(
    (section: Section) => {
      const removed = removeSection(section.id)
      if (!removed) return
      toast({
        message: m.toast_section_deleted({ name: sectionTitle(language, section.type, section.title) }),
        action: { label: m.common_undo(), run: () => restoreSection(removed) },
      })
    },
    [language],
  )

  const requestDelete = useCallback(
    (section: Section) => {
      const hasContent = (section.items as AnyItem[]).some((i) => !isItemEmpty(i))
      if (hasContent) setConfirmDelete(section)
      else doDelete(section)
    },
    [doDelete],
  )

  const onCopyToCv = useCallback((s: Section, item: AnyItem) => setCopying({ type: s.type, item }), [])

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={dnd.collisionDetection}
        modifiers={[verticalOnly]}
        accessibility={{ announcements: sectionAnnouncements, screenReaderInstructions: dndScreenReaderInstructions }}
        onDragStart={dnd.reset}
        onDragCancel={dnd.reset}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div data-section-list className="flex flex-col gap-3">
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                language={language}
                onCopyToCv={onCopyToCv}
                onRequestDelete={requestDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <AddSectionMenu existing={new Set(sections.map((s) => s.type))} />

      <CopyToCvDialog currentCvId={cvId} payload={copying} onClose={() => setCopying(null)} />
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={m.section_delete_title({
          name: confirmDelete ? sectionTitle(language, confirmDelete.type, confirmDelete.title) : '',
        })}
        description={m.section_delete_body()}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) doDelete(confirmDelete)
                setConfirmDelete(null)
              }}
            >
              {m.section_delete()}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{m.section_delete_hint()}</p>
      </Dialog>
    </div>
  )
}
