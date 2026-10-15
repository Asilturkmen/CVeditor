import { ArrowUp, Check, ChevronDown, Loader2, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { toast } from '@/components/ui/Toaster'
import { Tooltip } from '@/components/ui/Tooltip'
import { applySuggestions } from '@/editor/actions'
import { generateMockSuggestions } from '@/editor/mockSuggestions'
import { useEditorUi, type AiScope, type Suggestion } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { itemLabel } from '../labels'

function scopeLabel(cv: Cv, scope: AiScope): string {
  if (scope.kind === 'all') return m.ai_scope_all()
  const section = cv.sections.find((s) => s.id === scope.sectionId)
  if (!section) return m.ai_scope_all()
  const title = sectionTitle(cv.language, section.type, section.title)
  if (scope.kind === 'section') return title
  const item = (section.items as AnyItem[]).find((i) => i.id === scope.itemId)
  return item ? `${title}: ${itemLabel(section.type, item) || m.editor_untitled()}` : title
}

function suggestionTarget(cv: Cv, s: Suggestion): string {
  if (s.target === 'personal') return m.editor_personal_title()
  const section = cv.sections.find((x) => x.id === s.sectionId)
  if (!section) return ''
  const item = (section.items as AnyItem[]).find((i) => i.id === s.target)
  const title = sectionTitle(cv.language, section.type, section.title)
  const label = item ? itemLabel(section.type, item) : ''
  return section.type === 'summary' || !label ? title : `${title} · ${label}`
}

/** Önerilerin gözden geçirilmesi: tek tek ya da toplu kabul/ret. */
function SuggestionReview({ cv }: { cv: Cv }) {
  const suggestions = useEditorUi((s) => s.suggestions)
  const remove = useEditorUi((s) => s.removeSuggestions)
  const focusItem = useEditorUi((s) => s.focusItem)

  const accept = (list: Suggestion[]) => {
    applySuggestions(list)
    remove(list.map((s) => s.id))
    toast({ message: m.ai_accepted({ count: list.length }) })
  }
  const reject = (list: Suggestion[]) => remove(list.map((s) => s.id))

  return (
    <div className="flex max-h-[46vh] flex-col animate-rise-in">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <p className="flex-1 text-[13px] font-semibold">
          {m.ai_review_title({ count: suggestions.length })}
          <span className="ml-2 rounded-full bg-warn-soft px-1.5 py-px text-[11px] font-medium text-warn">
            {m.badge_sample()}
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={() => reject(suggestions)}>
          {m.ai_reject_all()}
        </Button>
        <Button size="sm" variant="primary" onClick={() => accept(suggestions)}>
          <Check />
          {m.ai_accept_all()}
        </Button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
            onMouseEnter={() => s.target !== 'personal' && focusItem(s.target)}
          >
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#e7c34a]" aria-hidden />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => s.target !== 'personal' && focusItem(s.target, true)}
            >
              <span className="block truncate text-[13px] font-medium">{suggestionTarget(cv, s)}</span>
              <span className="block text-xs text-muted">{s.note}</span>
            </button>
            <Tooltip content={m.ai_reject()}>
              <Button size="icon-sm" variant="ghost" aria-label={m.ai_reject()} onClick={() => reject([s])}>
                <X />
              </Button>
            </Tooltip>
            <Tooltip content={m.ai_accept()}>
              <Button size="icon-sm" variant="ghost" className="text-ok hover:text-ok" aria-label={m.ai_accept()} onClick={() => accept([s])}>
                <Check />
              </Button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Sağ altta sabit prompt kutusu. Kapsam varsayılanı Tüm CV; istenirse bölüm
 * ya da tek kayda daraltılır. V1'de istek atılmaz: örnek öneri üretilir.
 */
export function PromptBox({ cv }: { cv: Cv }) {
  const scope = useEditorUi((s) => s.aiScope)
  const setScope = useEditorUi((s) => s.setAiScope)
  const suggestions = useEditorUi((s) => s.suggestions)
  const setSuggestions = useEditorUi((s) => s.setSuggestions)
  const focusedItemId = useEditorUi((s) => s.focusedItemId)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  // Kapsamdaki bölüm/kayıt silinirse Tüm CV'ye dön.
  useEffect(() => {
    if (scope.kind === 'all') return
    const section = cv.sections.find((s) => s.id === scope.sectionId)
    const missing = !section || (scope.kind === 'item' && !(section.items as AnyItem[]).some((i) => i.id === scope.itemId))
    if (missing) setScope({ kind: 'all' })
  }, [cv.sections, scope, setScope])

  const focusedSection = focusedItemId
    ? cv.sections.find((s) => (s.items as AnyItem[]).some((i) => i.id === focusedItemId))
    : undefined
  const focusedItem = focusedSection
    ? (focusedSection.items as AnyItem[]).find((i) => i.id === focusedItemId)
    : undefined

  const submit = () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    timer.current = setTimeout(() => {
      setBusy(false)
      const list = generateMockSuggestions(cv, scope)
      if (list.length === 0) {
        toast({ message: m.ai_no_suggestions() })
        return
      }
      setSuggestions(list)
      setPrompt('')
    }, 1100)
  }

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    setBusy(false)
  }

  if (suggestions.length > 0) {
    return (
      <div className="border-t border-line bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.04)]">
        <SuggestionReview cv={cv} />
      </div>
    )
  }

  return (
    <div className="border-t border-line bg-surface px-3 pt-2.5 pb-3">
      <div
        className={cn(
          'rounded-xl border border-line bg-bg transition-[border-color,box-shadow] duration-150',
          'focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15',
        )}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={2}
          disabled={busy}
          placeholder={m.ai_placeholder()}
          aria-label={m.ai_label()}
          className="block w-full resize-none bg-transparent px-3 pt-2.5 text-sm leading-relaxed placeholder:text-faint focus:outline-none"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 max-w-[70%] items-center gap-1 rounded-md px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label={m.ai_scope_label()}
              >
                <span className="text-faint">{m.ai_scope_prefix()}</span>
                <span className="truncate text-text">{scopeLabel(cv, scope)}</span>
                <ChevronDown className="size-3.5 shrink-0" />
              </button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem onSelect={() => setScope({ kind: 'all' })}>{m.ai_scope_all()}</MenuItem>
              {focusedSection && focusedItem && focusedSection.type !== 'summary' && (
                <MenuItem
                  onSelect={() => setScope({ kind: 'item', sectionId: focusedSection.id, itemId: focusedItem.id })}
                >
                  {m.ai_scope_selected({ name: itemLabel(focusedSection.type, focusedItem) || m.editor_untitled() })}
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuLabel>{m.ai_scope_sections()}</MenuLabel>
              {cv.sections.map((s) => (
                <MenuItem key={s.id} onSelect={() => setScope({ kind: 'section', sectionId: s.id })}>
                  {sectionTitle(cv.language, s.type, s.title)}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-faint" role="status">
            {busy && <Loader2 className="size-3 animate-spin" />}
            {busy ? m.ai_working() : m.ai_enter_hint()}
          </span>
          {busy ? (
            <Tooltip content={m.ai_stop()}>
              <Button size="icon-sm" variant="secondary" aria-label={m.ai_stop()} onClick={cancel}>
                <Square className="!size-3 fill-current" />
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content={m.ai_send()}>
              <Button size="icon-sm" variant="primary" aria-label={m.ai_send()} disabled={!prompt.trim()} onClick={submit}>
                <ArrowUp />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <p className="mt-2 px-1 text-[11.5px] leading-snug text-faint">{m.ai_privacy_note()}</p>
    </div>
  )
}
