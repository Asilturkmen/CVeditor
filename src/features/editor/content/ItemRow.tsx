import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, MoreHorizontal, Send, Trash2 } from 'lucide-react'
import { memo, useCallback, type KeyboardEvent, type ReactNode } from 'react'
import { isItemEmpty } from '@/cv/factory'
import type { AnyItem, CvLanguage, DateRange, SectionType, YearMonth } from '@/cv/schema'
import { OutlineRow } from '@/components/ui/Disclosure'
import { DragHandle } from '@/components/ui/DragHandle'
import { BareInput } from '@/components/ui/Field'
import { FormRow } from '@/components/ui/Group'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { toast } from '@/components/ui/toast'
import { bareControlClass } from '@/components/ui/controlClass'
import { duplicateItem, moveItem, removeItem, restoreItem, setItemField, toggleItemHidden } from '@/editor/actions'
import { useEditor } from '@/editor/store'
import { isRowOpen, useEditorUi, type Suggestion } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { focusWhenSettled } from '@/lib/focus'
import { m } from '@/paraglide/messages'
import { FieldSuggestion, PendingDot, RemoveSuggestion } from '../ai/suggestions'
import { fieldSuggestion, pendingKind } from '../ai/suggestionLogic'
import { itemLabel, rowParts } from '../labels'
import { DateRangeRows, MonthRow } from './DateFields'
import { ITEM_FIELDS, type FieldDef } from './fieldDefs'
import { FORM_LABEL_WIDTH } from './PersonalForm'
import { RichTextField } from './RichTextField'
import { useSortableStyle } from './sortableStyle'
import { DRAG_SOURCE_CLASS } from './SortOverlay'

export type ItemType = Exclude<SectionType, 'summary'>

/** Beceri ve dil kayıtları başlıksız, satır içi formdur (satırın kendisi alandır). */
export const INLINE_TYPES: ReadonlySet<SectionType> = new Set(['skills', 'languages'])

export function HideToggle({ hidden, onToggle, label }: { hidden: boolean; onToggle: () => void; label: string }) {
  const text = hidden ? m.common_show() : m.common_hide()
  return (
    <IconButton
      label={`${text}: ${label}`}
      icon={hidden ? <EyeOff /> : <Eye />}
      aria-pressed={hidden}
      onClick={onToggle}
      className={hidden ? 'text-fg-2' : undefined}
    />
  )
}

function deleteItemWithUndo(sectionId: string, type: SectionType, item: AnyItem) {
  const section = useEditor.getState().cv?.sections.find((s) => s.id === sectionId)
  const items = (section?.items ?? []) as AnyItem[]
  const index = items.findIndex((i) => i.id === item.id)
  const neighbour = items[index + 1] ?? items[index - 1]
  const removed = removeItem(sectionId, item.id)
  if (!removed) return
  // Odak mantıklı bir yere gider: komşu kaydın işlem düğmesi, kayıt kalmadıysa bölümün "ekle" düğmesi.
  focusWhenSettled(() =>
    neighbour
      ? document.getElementById(`item-${neighbour.id}`)?.querySelector<HTMLElement>('[data-item-actions]')
      : document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"] [data-add-item]`),
  )
  if (isItemEmpty(item)) return
  toast({
    message: m.toast_item_deleted({ name: itemLabel(type, item) || m.editor_untitled() }),
    action: { label: m.common_undo(), run: () => restoreItem(sectionId, removed) },
  })
}

/**
 * Satır özellikleri ilkel değerler: bölüm nesnesi verilmez (içindeki bir kayıt yazılınca bölüm nesnesi
 * yenilenir; onu alan her kardeş satırın memo'su bozulur ve her tuşta bütün bölüm yeniden çizilirdi).
 */
interface RowProps {
  sectionId: string
  type: SectionType
  item: AnyItem
  language: CvLanguage
  index: number
  count: number
  onCopyToCv: (type: SectionType, item: AnyItem) => void
}

function ItemMenu({ sectionId, type, item, index, count, onCopyToCv, label }: Omit<RowProps, 'language'> & { label: string }) {
  const focusItem = useEditorUi((s) => s.focusItem)
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={m.item_actions({ name: label })} icon={<MoreHorizontal />} tooltip={false} data-item-actions />
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          icon={<Copy />}
          onSelect={() => {
            const id = duplicateItem(sectionId, item.id)
            if (id) focusItem(id, true)
          }}
        >
          {m.item_duplicate()}
        </MenuItem>
        <MenuItem icon={<Send />} onSelect={() => onCopyToCv(type, item)}>
          {m.item_copy_to_cv()}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<ArrowUp />} disabled={index === 0} onSelect={() => moveItem(sectionId, index, index - 1)}>
          {m.common_move_up()}
        </MenuItem>
        <MenuItem icon={<ArrowDown />} disabled={index >= count - 1} onSelect={() => moveItem(sectionId, index, index + 1)}>
          {m.common_move_down()}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} danger onSelect={() => deleteItemWithUndo(sectionId, type, item)}>
          {m.common_delete()}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/** Tek alan satırı. Değişiklik geri çağrısı kararlı: zengin metin düzenleyicisi her tuşta yeniden çizilmez. */
const FieldRow = memo(function FieldRow({
  sectionId,
  itemId,
  def,
  value,
}: {
  sectionId: string
  itemId: string
  def: FieldDef
  value: unknown
}) {
  const set = useCallback((v: unknown) => setItemField(sectionId, itemId, def.key, v), [sectionId, itemId, def.key])
  const suggestion = useEditorUi((s) => fieldSuggestion(s.suggestions, itemId, def.key))
  let control: ReactNode
  switch (def.kind) {
    case 'rich':
      control = (
        <div className="py-1">
          <RichTextField variant="bare" label={def.label()} value={(value as string) ?? ''} onChange={set} placeholder={def.placeholder?.()} />
        </div>
      )
      break
    case 'range':
      // Satırlar doğrudan grubun içine girer (Başlangıç / Bitiş / Devam ediyor).
      return (
        <>
          <DateRangeRows value={value as DateRange} onChange={set} labelWidth={FORM_LABEL_WIDTH} />
          {suggestion && <FieldSuggestion s={suggestion} />}
        </>
      )
    case 'month':
      control = <MonthRow label={def.label()} value={value as YearMonth | null} onChange={set} labelWidth={FORM_LABEL_WIDTH} />
      break
    default:
      control = (
        <FormRow label={def.label()} labelWidth={FORM_LABEL_WIDTH}>
          {(id) => (
            <BareInput
              id={id}
              type={def.kind === 'url' ? 'text' : def.kind}
              inputMode={def.kind === 'url' ? 'url' : def.kind === 'email' ? 'email' : undefined}
              value={(value as string) ?? ''}
              placeholder={def.placeholder?.()}
              onChange={(e) => set(e.target.value)}
              autoComplete="off"
            />
          )}
        </FormRow>
      )
  }
  return (
    <div>
      {control}
      {suggestion && <FieldSuggestion s={suggestion} />}
    </div>
  )
})

function ItemFields({ sectionId, type, item }: { sectionId: string; type: ItemType; item: AnyItem }) {
  const record = item as unknown as Record<string, unknown>
  return (
    <div className="group-rows pl-[46px]">
      {ITEM_FIELDS[type].map((def) => (
        <FieldRow key={def.key} sectionId={sectionId} itemId={item.id} def={def} value={record[def.key]} />
      ))}
    </div>
  )
}

/** Açık kayıtta Escape: kayıt kapanır, odak satırın açma düğmesine döner (menü/pencere içindeki Escape değil). */
function closeOnEscape(e: KeyboardEvent<HTMLDivElement>, close: () => void) {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  const target = e.target as HTMLElement
  if (!e.currentTarget.contains(target) || target.closest('[aria-roledescription]')) return
  e.preventDefault()
  const button = e.currentTarget.querySelector<HTMLElement>('[aria-expanded]')
  close()
  button?.focus()
}

function removalFor(suggestions: Suggestion[], itemId: string) {
  return suggestions.find((s) => s.kind === 'removeItem' && s.itemId === itemId)
}

/**
 * Kapalı kayıt: ⠿ ▸ ad · kurum, sağda tarih, 👁, ⋯ (44px). Tıklanınca aynı grupta yerinde açılır;
 * "Tümünü aç" kapalıyken öbür kayıt kapanır. Sürükleme kapalı satırlarla yapılır.
 */
export const OutlineItem = memo(function OutlineItem({ sectionId, type: sectionType, item, language, index, count, onCopyToCv }: RowProps) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(item.id)
  const open = useEditorUi((s) => isRowOpen(s, item.id))
  const pending = useEditorUi((s) => pendingKind(s.suggestions, item.id))
  const removal = useEditorUi((s) => removalFor(s.suggestions, item.id))
  const setRowOpen = useEditorUi((s) => s.setRowOpen)
  const focusItem = useEditorUi((s) => s.focusItem)
  const blurItem = useEditorUi((s) => s.blurItem)
  const type = sectionType as ItemType
  const label = itemLabel(sectionType, item) || m.editor_untitled()
  const parts = rowParts(sectionType, item, language)

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`item-${item.id}`}
      data-row
      data-label={label}
      onFocusCapture={() => focusItem(item.id)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && blurItem(item.id)}
      onKeyDown={open ? (e) => closeOnEscape(e, () => setRowOpen(item.id, false)) : undefined}
      className={cn(
        'bg-content',
        isDragging && DRAG_SOURCE_CLASS,
      )}
    >
      <OutlineRow
        open={open}
        onOpenChange={(next) => setRowOpen(item.id, next)}
        hidden={item.hidden}
        leading={<DragHandle label={m.drag_item()} {...attributes} {...listeners} />}
        title={
          <>
            <span data-row-title className={parts.title ? undefined : 'text-fg-2'}>
              {parts.title || (parts.meta ? '' : m.editor_untitled())}
            </span>
            {item.hidden && <span className="sr-only"> ({m.common_hidden()})</span>}
            <PendingDot kind={pending} />
          </>
        }
        meta={parts.meta || undefined}
        actions={
          <>
            {parts.date && <span className="mr-1 text-callout whitespace-nowrap text-fg-2 tabular-nums">{parts.date}</span>}
            <HideToggle hidden={item.hidden} label={label} onToggle={() => toggleItemHidden(sectionId, item.id)} />
            <ItemMenu sectionId={sectionId} type={sectionType} item={item} index={index} count={count} onCopyToCv={onCopyToCv} label={label} />
          </>
        }
      >
        {removal && <RemoveSuggestion s={removal} />}
        <ItemFields sectionId={sectionId} type={type} item={item} />
      </OutlineRow>
    </div>
  )
})

/** Satır içi kayıt (Beceri, Dil): ⠿ [Grup] [Beceriler…] 👁 ⋯ — başlık yok, satırın kendisi form. */
export const InlineItem = memo(function InlineItem({ sectionId, type, item, index, count, onCopyToCv }: RowProps) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableStyle(item.id)
  const pending = useEditorUi((s) => pendingKind(s.suggestions, item.id))
  const removal = useEditorUi((s) => removalFor(s.suggestions, item.id))
  const focusItem = useEditorUi((s) => s.focusItem)
  const blurItem = useEditorUi((s) => s.blurItem)
  const [first, second] = ITEM_FIELDS[type as ItemType]
  const record = item as unknown as Record<string, string>
  const label = itemLabel(type, item) || m.editor_untitled()
  const set = (key: string) => (value: string) => setItemField(sectionId, item.id, key, value)
  const firstSuggestion = useEditorUi((s) => fieldSuggestion(s.suggestions, item.id, first.key))
  const secondSuggestion = useEditorUi((s) => fieldSuggestion(s.suggestions, item.id, second.key))
  const text = item.hidden ? 'text-fg-3' : 'text-fg'

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`item-${item.id}`}
      data-row
      data-label={label}
      onFocusCapture={() => focusItem(item.id)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && blurItem(item.id)}
      className={cn(
        'bg-content',
        isDragging && DRAG_SOURCE_CLASS,
      )}
    >
      <div className="flex min-h-11 items-start gap-1 py-1.5 pr-2 pl-1">
        <DragHandle label={m.drag_item()} {...attributes} {...listeners} className="h-8 self-start" />
        <BareInput
          aria-label={first.label()}
          value={record[first.key] ?? ''}
          placeholder={first.placeholder?.()}
          onChange={(e) => set(first.key)(e.target.value)}
          autoComplete="off"
          className={cn('w-34 shrink-0 font-medium', text)}
        />
        {type === 'skills' ? (
          // Uzun beceri listesi kesilmez: alan içerikle büyür (tek mantıksal satır, Enter yok).
          <textarea
            aria-label={second.label()}
            rows={1}
            value={record[second.key] ?? ''}
            placeholder={second.placeholder?.()}
            onChange={(e) => set(second.key)(e.target.value.replace(/\s*\n\s*/g, ' '))}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            className={cn(bareControlClass, 'min-h-8 resize-none py-[7px] [field-sizing:content]', text)}
          />
        ) : (
          <BareInput
            aria-label={second.label()}
            value={record[second.key] ?? ''}
            placeholder={second.placeholder?.()}
            onChange={(e) => set(second.key)(e.target.value)}
            autoComplete="off"
            className={text}
          />
        )}
        <div className="flex h-8 shrink-0 items-center gap-1">
          <PendingDot kind={pending} />
          <HideToggle hidden={item.hidden} label={label} onToggle={() => toggleItemHidden(sectionId, item.id)} />
          <ItemMenu sectionId={sectionId} type={type} item={item} index={index} count={count} onCopyToCv={onCopyToCv} label={label} />
        </div>
      </div>
      {(removal || firstSuggestion || secondSuggestion) && (
        <div className="pb-1 pl-[34px]">
          {removal && <RemoveSuggestion s={removal} />}
          {firstSuggestion && <FieldSuggestion s={firstSuggestion} />}
          {secondSuggestion && <FieldSuggestion s={secondSuggestion} />}
        </div>
      )}
    </div>
  )
})

/** Özet: kapalıyken ilk cümle (sarar), açılınca zengin metin. Bölümde tek kayıt; sürükleme yok. */
export const SummaryItem = memo(function SummaryItem({
  sectionId,
  sectionTitleText,
  item,
  language,
}: {
  sectionId: string
  /** Bölümün görünen adı (düzenleyicinin erişilebilir adı). */
  sectionTitleText: string
  item: AnyItem
  language: CvLanguage
}) {
  const open = useEditorUi((s) => isRowOpen(s, item.id))
  const pending = useEditorUi((s) => pendingKind(s.suggestions, item.id))
  const suggestion = useEditorUi((s) => fieldSuggestion(s.suggestions, item.id, 'content'))
  const setRowOpen = useEditorUi((s) => s.setRowOpen)
  const focusItem = useEditorUi((s) => s.focusItem)
  const blurItem = useEditorUi((s) => s.blurItem)
  const content = (item as unknown as { content: string }).content
  const first = rowParts('summary', item, language).title
  const label = itemLabel('summary', item)
  const onChange = useCallback((html: string) => setItemField(sectionId, item.id, 'content', html), [sectionId, item.id])
  return (
    <div
      id={`item-${item.id}`}
      data-row
      data-label={label}
      onFocusCapture={() => focusItem(item.id)}
      onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && blurItem(item.id)}
      onKeyDown={open ? (e) => closeOnEscape(e, () => setRowOpen(item.id, false)) : undefined}
      className="bg-content"
    >
      <OutlineRow
        open={open}
        onOpenChange={(next) => setRowOpen(item.id, next)}
        title={
          <>
            {/* Açıkken ilk cümle başlıkta tekrarlanmaz (altındaki metin aynı cümleyle başlıyor). */}
            <span data-row-title className={first && !open ? undefined : 'text-fg-2'}>
              {open ? m.editor_summary_open() : first || m.editor_summary_empty()}
            </span>
            <PendingDot kind={pending} />
          </>
        }
      >
        <div className="pl-[22px]">
          <RichTextField
            variant="bare"
            showLabel={false}
            label={sectionTitleText}
            value={content}
            onChange={onChange}
            placeholder={m.ph_summary()}
          />
          {suggestion && <FieldSuggestion s={suggestion} />}
        </div>
      </OutlineRow>
    </div>
  )
})
