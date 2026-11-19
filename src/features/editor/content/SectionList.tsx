import { DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowDown, ArrowUp, MoreHorizontal, PenLine, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isItemEmpty } from '@/cv/factory'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, CvLanguage, Section, SectionType } from '@/cv/schema'
import { SECTION_TYPES } from '@/cv/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { DragHandle } from '@/components/ui/DragHandle'
import { Input } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { toast } from '@/components/ui/toast'
import {
  addItem,
  addSection,
  moveItem,
  moveSection,
  removeSection,
  renameSection,
  restoreSection,
  toggleSectionHidden,
} from '@/editor/actions'
import { useEditor } from '@/editor/store'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { focusWhenSettled } from '@/lib/focus'
import { scrollBehavior } from '@/lib/motion'
import { m } from '@/paraglide/messages'
import { itemLabel, rowParts } from '../labels'
import { CopyToCvDialog } from './CopyToCvDialog'
import { dndScreenReaderInstructions, useDndAnnouncements } from './dndA11y'
import { ADD_ITEM_LABELS, SECTION_LABELS } from './fieldDefs'
import { HideToggle, INLINE_TYPES, InlineItem, OutlineItem, SummaryItem } from './ItemRow'
import { useSortDnd, useStableIds } from './keyboardSort'
import { afterMenusClosed, revealRow } from './reveal'
import { DragGhost, SortOverlay } from './SortOverlay'
import { useSortableStyle, VERTICAL_ONLY } from './sortableStyle'

/** Her çizimde aynı kalan olay işleyicisi (DndContext'e yeni işlev verip bağlamını tazelemesin). */
function useStableHandler<A extends unknown[]>(fn: (...args: A) => void) {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: A) => ref.current(...args), [])
}

function SectionTitle({ section, language }: { section: Section; language: CvLanguage }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const title = sectionTitle(language, section.type, section.title)
  const buttonRef = useRef<HTMLButtonElement>(null)
  /** Klavyeyle (Enter/Escape) bitti: odak tetikleyiciye döner. Dışarı tıklanarak bitince dönmez. */
  const refocus = useRef(false)
  /** Enter'dan sonra gelen blur aynı adı ikinci kez işlemesin; Escape'ten sonraki blur kaydetmesin. */
  const finished = useRef(false)

  useEffect(() => {
    if (editing || !refocus.current) return
    refocus.current = false
    buttonRef.current?.focus()
  }, [editing])

  const finish = (save: boolean, viaKeyboard: boolean) => {
    if (finished.current) return
    finished.current = true
    if (save) {
      const trimmed = value.trim()
      renameSection(section.id, trimmed && trimmed !== sectionTitle(language, section.type, null) ? trimmed : null)
    }
    refocus.current = viaKeyboard
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        controlSize="sm"
        value={value}
        aria-label={m.section_rename()}
        // Taslak ad CV'de değil bu kutuda durur: Ctrl+Z kutunun kendi geri alıdır (CV'yi geri almaz).
        data-native-undo
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(true, true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            finish(false, true)
          }
        }}
        className="max-w-60 text-title-3"
      />
    )
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      data-section-title
      onClick={() => {
        finished.current = false
        setValue(title)
        setEditing(true)
      }}
      className={cn(
        'press press-wide flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-fill-4',
        section.hidden ? 'text-fg-3' : 'text-fg',
      )}
      aria-label={m.section_rename_named({ name: title })}
    >
      <span className="min-w-0 text-title-3 break-words">{title}</span>
      <PenLine aria-hidden className="size-3.5 shrink-0 text-fg-2" />
    </button>
  )
}

/** Bölümün ⋯ menüsü: varsayılan başlık, yukarı/aşağı taşı, sil. */
function SectionMenu({
  section,
  language,
  index,
  count,
  onRequestDelete,
}: {
  section: Section
  language: CvLanguage
  index: number
  count: number
  onRequestDelete: (section: Section) => void
}) {
  const title = sectionTitle(language, section.type, section.title)
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={m.section_actions({ name: title })} icon={<MoreHorizontal />} tooltip={false} />
      </MenuTrigger>
      <MenuContent>
        {section.title && (
          <MenuItem icon={<RotateCcw />} onSelect={() => renameSection(section.id, null)}>
            {m.section_reset_title({ name: sectionTitle(language, section.type, null) })}
          </MenuItem>
        )}
        <MenuItem icon={<ArrowUp />} disabled={index === 0} onSelect={() => moveSection(index, index - 1)}>
          {m.common_move_up()}
        </MenuItem>
        <MenuItem icon={<ArrowDown />} disabled={index >= count - 1} onSelect={() => moveSection(index, index + 1)}>
          {m.common_move_down()}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} danger onSelect={() => onRequestDelete(section)}>
          {m.section_delete()}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

function addAndOpen(sectionId: string) {
  const id = addItem(sectionId)
  if (id) useEditorUi.getState().focusItem(id, true)
}

const SectionCard = memo(function SectionCard({
  section,
  language,
  index,
  count,
  onCopyToCv,
  onRequestDelete,
}: {
  section: Section
  language: CvLanguage
  index: number
  count: number
  onCopyToCv: (type: SectionType, item: AnyItem) => void
  onRequestDelete: (section: Section) => void
}) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(section.id)
  const dnd = useSortDnd()
  const title = sectionTitle(language, section.type, section.title)
  const items = section.items as AnyItem[]
  const ids = useStableIds(items.map((i) => i.id))
  const hiddenCount = items.filter((i) => i.hidden).length
  const isSummary = section.type === 'summary'
  const inline = INLINE_TYPES.has(section.type)
  const empty = items.length === 0

  // Duyurucu her zaman son adı okur (useDndAnnouncements en son işlevi saklar).
  const itemName = (id: UniqueIdentifier) => {
    const item = items.find((i) => i.id === id)
    return (item && itemLabel(section.type, item)) || m.editor_untitled()
  }
  const announcements = useDndAnnouncements(itemName)
  const accessibility = useMemo(() => ({ announcements, screenReaderInstructions: dndScreenReaderInstructions }), [announcements])

  const onDragEnd = useStableHandler(({ active, over }: DragEndEvent) => {
    dnd.reset()
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from >= 0 && to >= 0) moveItem(section.id, from, to)
  })

  const addLabel = ADD_ITEM_LABELS[section.type]()

  /** Sürüklenen kaydın kopyası (grubun dışında, gövdede çizilir; grup onu kırpmaz). */
  const ghost = (id: UniqueIdentifier) => {
    const item = items.find((i) => i.id === id)
    if (!item) return null
    const parts = rowParts(section.type, item, language)
    return <DragGhost title={parts.title || m.editor_untitled()} meta={parts.meta || undefined} trailing={parts.date || undefined} />
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={title}
      data-section-id={section.id}
      className={cn('rounded-xl transition-[box-shadow,background-color,scale] duration-200', isDragging && 'z-30 scale-[1.01] bg-window shadow-3')}
    >
      <header className="mb-2 flex min-h-9 items-center gap-1 pr-1 pl-1">
        <DragHandle label={m.drag_section()} {...attributes} {...listeners} className="h-8 self-center" />
        <SectionTitle section={section} language={language} />
        {!isSummary && items.length > 0 && (
          <span className="ml-1 text-body text-fg-2 tabular-nums">
            <span aria-hidden>
              {items.length}
              {hiddenCount > 0 && ` · ${m.section_hidden_count({ count: hiddenCount })}`}
            </span>
            <span className="sr-only">
              {m.ux_section_item_count({ count: items.length })}
              {hiddenCount > 0 && `, ${m.section_hidden_count({ count: hiddenCount })}`}
            </span>
          </span>
        )}
        {section.hidden && <Badge className="ml-1">{m.common_hidden()}</Badge>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!isSummary && !empty && (
            <Button variant="plain" className="px-2" data-add-item aria-label={addLabel} onClick={() => addAndOpen(section.id)}>
              <Plus />
              {m.add_short()}
            </Button>
          )}
          <HideToggle hidden={section.hidden} label={title} onToggle={() => toggleSectionHidden(section.id)} />
          <SectionMenu section={section} language={language} index={index} count={count} onRequestDelete={onRequestDelete} />
        </div>
      </header>
      <div className="group-rows overflow-hidden rounded-xl bg-content shadow-1 [--row-px:12px]">
        {empty ? (
          <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 px-[var(--row-px)] py-2">
            <span className="text-body text-fg-2">{m.section_empty()}</span>
            <Button variant="plain" className="-ml-2 px-2" data-add-item onClick={() => addAndOpen(section.id)}>
              <Plus />
              {addLabel}
            </Button>
          </div>
        ) : isSummary ? (
          <SummaryItem sectionId={section.id} sectionTitleText={title} item={items[0]} language={language} />
        ) : (
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
              {items.map((item, i) =>
                inline ? (
                  <InlineItem key={item.id} sectionId={section.id} type={section.type} item={item} language={language} index={i} count={items.length} onCopyToCv={onCopyToCv} />
                ) : (
                  <OutlineItem key={item.id} sectionId={section.id} type={section.type} item={item} language={language} index={i} count={items.length} onCopyToCv={onCopyToCv} />
                ),
              )}
            </SortableContext>
            <SortOverlay render={ghost} />
          </DndContext>
        )}
      </div>
    </section>
  )
})

/** Bölüm ekle: önce eklenebilenler; CV'de olanlar altta "Eklendi" ile, tıklanınca o bölüme götürür. */
function AddSectionMenu({ sections }: { sections: Section[] }) {
  const existing = new Map(sections.map((s) => [s.type, s.id]))
  const addable = SECTION_TYPES.filter((t) => t === 'custom' || !existing.has(t))
  const added = SECTION_TYPES.filter((t) => t !== 'custom' && existing.has(t))
  const add = (type: SectionType) => {
    const id = addSection(type)
    const section = useEditor.getState().cv?.sections.find((s) => s.id === id)
    const first = (section?.items as AnyItem[] | undefined)?.[0]
    if (first) useEditorUi.getState().focusItem(first.id, true)
  }
  const goTo = (type: SectionType) => {
    const id = existing.get(type)
    const el = id ? document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`) : null
    if (!el) return
    el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    afterMenusClosed(() => el.querySelector<HTMLElement>('[data-section-title]')?.focus({ preventScroll: true }))
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="lg" className="w-full" data-add-section>
          <Plus />
          {m.section_add()}
        </Button>
      </MenuTrigger>
      <MenuContent align="center" side="top" className="w-72">
        <MenuLabel>{m.section_add_label()}</MenuLabel>
        {addable.map((type) => (
          <MenuItem key={type} onSelect={() => add(type)}>
            {SECTION_LABELS[type]()}
          </MenuItem>
        ))}
        {added.length > 0 && (
          <>
            <MenuSeparator />
            <MenuLabel>{m.section_existing_label()}</MenuLabel>
            {added.map((type) => (
              <MenuItem key={type} hint={m.section_added()} onSelect={() => goTo(type)}>
                {SECTION_LABELS[type]()}
              </MenuItem>
            ))}
          </>
        )}
      </MenuContent>
    </Menu>
  )
}

/**
 * İçerik sekmesi: bölümler anahat olarak. Bölüm başlığı satırı (⠿ ad ✎ sayı, + Ekle, 👁, ⋯), altında
 * beyaz grupta kayıt satırları. Bölümler ve kayıtlar sürükleyerek ya da klavyeyle sıralanır.
 */
export const SectionList = memo(function SectionList({ sections, language, cvId }: { sections: Section[]; language: CvLanguage; cvId: string }) {
  const dnd = useSortDnd()
  const [copying, setCopying] = useState<{ type: SectionType; item: AnyItem } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Section | null>(null)
  const scrollTarget = useEditorUi((s) => s.scrollTarget)
  const ids = useStableIds(sections.map((s) => s.id))

  // Önizlemede tıklanan (ya da yeni eklenen, öneriden seçilen) kayıt: satır açılır, panel oraya kayar,
  // kısa süre vurgulanır, ilk alana imleç gelir. Hedef bir kez tüketilir: İçerik sekmesine her dönüşte
  // (bu bileşen yeniden kurulur) eski hedefe kaydırıp odağı çalmaz.
  useEffect(() => {
    if (!scrollTarget) return
    const ui = useEditorUi.getState()
    ui.consumeScrollTarget(scrollTarget.nonce)
    const { id } = scrollTarget
    const all = useEditor.getState().cv?.sections ?? []
    const section = all.find((s) => (s.items as AnyItem[]).some((i) => i.id === id))
    if (id === 'personal' || (section && !INLINE_TYPES.has(section.type))) ui.setRowOpen(id, true)
    // Açılan satırın alanları çizilsin, sonra kaydır ve odakla. (Temizlikte iptal edilmez: hedefi
    // tüketmek bu etkiyi yeniden çalıştırır.)
    requestAnimationFrame(() => requestAnimationFrame(() => revealRow(id)))
  }, [scrollTarget])

  const sectionName = (id: UniqueIdentifier) => {
    const s = sections.find((x) => x.id === id)
    return s ? sectionTitle(language, s.type, s.title) : ''
  }
  const announcements = useDndAnnouncements(sectionName)
  const accessibility = useMemo(() => ({ announcements, screenReaderInstructions: dndScreenReaderInstructions }), [announcements])

  const onDragEnd = useStableHandler(({ active, over }: DragEndEvent) => {
    dnd.reset()
    if (!over || active.id === over.id) return
    const from = sections.findIndex((s) => s.id === active.id)
    const to = sections.findIndex((s) => s.id === over.id)
    if (from >= 0 && to >= 0) moveSection(from, to)
  })

  const doDelete = useCallback(
    (section: Section) => {
      const all = useEditor.getState().cv?.sections ?? []
      const index = all.findIndex((s) => s.id === section.id)
      const neighbour = all[index + 1] ?? all[index - 1]
      const removed = removeSection(section.id)
      if (!removed) return
      // Odak mantıklı bir yere gider: komşu bölümün başlığı, bölüm kalmadıysa "Bölüm ekle".
      focusWhenSettled(() =>
        neighbour
          ? document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(neighbour.id)}"] [data-section-title]`)
          : document.querySelector<HTMLElement>('[data-add-section]'),
      )
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

  const onCopyToCv = useCallback((type: SectionType, item: AnyItem) => setCopying({ type, item }), [])

  return (
    <div className="flex flex-col gap-6">
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
          <div data-section-list className="flex flex-col gap-6">
            {sections.map((section, i) => (
              <SectionCard
                key={section.id}
                section={section}
                language={language}
                index={i}
                count={sections.length}
                onCopyToCv={onCopyToCv}
                onRequestDelete={requestDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <AddSectionMenu sections={sections} />

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
            <Button size="lg" autoFocus onClick={() => setConfirmDelete(null)}>
              {m.common_cancel()}
            </Button>
            <Button
              size="lg"
              variant="destructive"
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
        <p className="text-body text-fg-2">{m.section_delete_hint()}</p>
      </Dialog>
    </div>
  )
})
