import { ArrowUp, Check, ChevronDown, Loader2, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buildEditPayload } from '@/ai/payload'
import { operationsToSuggestions } from '@/ai/ops'
import { getAiProvider } from '@/ai/provider'
import { parseEditResult } from '@/ai/validate'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { toast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { applySuggestions, isSuggestionFresh } from '@/editor/actions'
import { pendingMarkerCss, suggestionTargetId, useEditorUi, type AiScope, type Suggestion } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { withAiAuth } from '@/features/ai/aiAuth'
import { aiErrorMessage, isAiAbort } from '@/features/ai/aiErrorMessage'
import { AiPayloadDialog, DemoBadge, WhatIsSentButton } from '@/features/ai/AiPayloadDialog'
import { ITEM_FIELDS } from '../content/fieldDefs'
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

const PERSONAL_LABELS: Record<string, () => string> = {
  headline: m.f_headline,
  email: m.f_email,
  phone: m.f_phone,
  location: m.f_location,
  website: m.f_website,
  linkedin: m.f_linkedin,
  github: m.f_github,
}

/** Önerinin listede görünen başlığı (bölüm · kayıt) ve alt satırı (tür / alan + açıklama). */
function describe(cv: Cv, s: Suggestion): { title: string; kind: string } {
  if (s.kind === 'field' && s.target === 'personal') {
    return { title: m.editor_personal_title(), kind: PERSONAL_LABELS[s.field]?.() ?? s.field }
  }
  const section = cv.sections.find((x) => x.id === s.sectionId)
  if (!section) return { title: '', kind: '' }
  const sTitle = sectionTitle(cv.language, section.type, section.title)
  const item =
    s.kind === 'addItem' ? s.item : (section.items as AnyItem[]).find((i) => i.id === (s.kind === 'field' ? s.target : s.itemId))
  const label = item ? itemLabel(section.type, item) : ''
  const title = section.type === 'summary' || !label ? sTitle : `${sTitle} · ${label}`
  if (s.kind === 'addItem') return { title, kind: m.ai2_kind_add() }
  if (s.kind === 'removeItem') return { title, kind: m.ai2_kind_remove() }
  const field = section.type === 'summary' ? undefined : ITEM_FIELDS[section.type].find((f) => f.key === s.field)
  return { title, kind: field?.label() ?? '' }
}

const DOT: Record<Suggestion['kind'], string> = {
  field: 'bg-[#e7c34a]',
  addItem: 'bg-ok',
  removeItem: 'bg-danger',
}

/**
 * Sağ paneldeki kartlarda bekleyen öneri işareti: kartın solundaki boşlukta
 * küçük nokta. Kartların id'si (item-…, personal-card) üzerinden; panel
 * bileşenlerine dokunmadan.
 */
function PendingMarkers({ suggestions }: { suggestions: Suggestion[] }) {
  const css = pendingMarkerCss(suggestions)
  return css ? <style>{css}</style> : null
}

/** Önerilerin gözden geçirilmesi: tek tek ya da toplu kabul/ret. */
function SuggestionReview({ cv, demo }: { cv: Cv; demo: boolean }) {
  const suggestions = useEditorUi((s) => s.suggestions)
  const remove = useEditorUi((s) => s.removeSuggestions)
  const focusItem = useEditorUi((s) => s.focusItem)
  const highlightItem = useEditorUi((s) => s.highlightItem)
  const revealSuggestion = useEditorUi((s) => s.revealSuggestion)
  const flashItems = useEditorUi((s) => s.flashItems)

  const accept = (list: Suggestion[]) => {
    const applied = applySuggestions(list)
    remove(list.map((s) => s.id))
    highlightItem(null)
    if (applied < list.length) toast({ message: m.ai_stale_skipped({ count: list.length - applied }) })
    if (applied > 0) {
      toast({ message: m.ai_accepted({ count: applied }) })
      flashItems(list.filter((s) => s.kind !== 'removeItem').map(suggestionTargetId))
    }
  }
  const reject = (list: Suggestion[]) => {
    remove(list.map((s) => s.id))
    highlightItem(null)
  }
  const show = (s: Suggestion) => {
    revealSuggestion(s.id)
    const target = suggestionTargetId(s)
    // Yeni kaydın panelde kartı yok; yalnız önizlemede gösterilir.
    if (s.kind !== 'addItem') focusItem(target, true)
  }

  return (
    <div className="flex max-h-[46vh] flex-col animate-rise-in">
      <PendingMarkers suggestions={suggestions} />
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <p className="flex-1 text-[13px] font-semibold">
          {m.ai_review_title({ count: suggestions.length })}
          {demo && <DemoBadge className="ml-2" />}
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
        {suggestions.map((s) => {
          const { title, kind } = describe(cv, s)
          return (
            <li
              key={s.id}
              className="group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
              onMouseEnter={() => highlightItem(suggestionTargetId(s))}
              onMouseLeave={() => highlightItem(null)}
            >
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[s.kind])} aria-hidden />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => show(s)}>
                <span className="block truncate text-[13px] font-medium">{title}</span>
                <span className="block text-xs text-muted">
                  {kind && (
                    <span className={cn('font-medium', s.kind === 'removeItem' ? 'text-danger' : s.kind === 'addItem' ? 'text-ok' : 'text-text')}>
                      {kind}
                    </span>
                  )}
                  {kind && s.note && ' · '}
                  {s.note}
                </span>
              </button>
              <Tooltip content={m.ai_reject()}>
                <Button size="icon-sm" variant="ghost" aria-label={m.ai_reject()} onClick={() => reject([s])}>
                  <X />
                </Button>
              </Tooltip>
              <Tooltip content={m.ai_accept()}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-ok hover:text-ok"
                  aria-label={m.ai_accept()}
                  onClick={() => accept([s])}
                >
                  <Check />
                </Button>
              </Tooltip>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Sağ altta sabit prompt kutusu. Kapsam varsayılanı Tüm CV; istenirse bölüm
 * ya da tek kayda daraltılır. İstek ai/ katmanından geçer: payload (yalnız
 * kapsam, maskeli) → sağlayıcı → doğrulama → öneriler.
 */
export function PromptBox({ cv }: { cv: Cv }) {
  const scope = useEditorUi((s) => s.aiScope)
  const setScope = useEditorUi((s) => s.setAiScope)
  const suggestions = useEditorUi((s) => s.suggestions)
  const setSuggestions = useEditorUi((s) => s.setSuggestions)
  const lastFocusedItemId = useEditorUi((s) => s.lastFocusedItemId)
  const provider = getAiProvider()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPayload, setShowPayload] = useState(false)
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  // Öneri bekleyen hedef sonradan değiştiyse (elle yazma, geri al) o öneri artık geçersiz.
  useEffect(() => {
    if (suggestions.length === 0) return
    const stale = suggestions.filter((s) => !isSuggestionFresh(cv, s))
    if (stale.length === 0) return
    useEditorUi.getState().removeSuggestions(stale.map((s) => s.id))
    toast({ message: m.ai_stale_removed({ count: stale.length }) })
  }, [cv, suggestions])

  // Kapsamdaki bölüm/kayıt silinirse Tüm CV'ye dön.
  useEffect(() => {
    if (scope.kind === 'all') return
    const section = cv.sections.find((s) => s.id === scope.sectionId)
    const missing = !section || (scope.kind === 'item' && !(section.items as AnyItem[]).some((i) => i.id === scope.itemId))
    if (missing) setScope({ kind: 'all' })
  }, [cv.sections, scope, setScope])

  const focusedSection = lastFocusedItemId
    ? cv.sections.find((s) => (s.items as AnyItem[]).some((i) => i.id === lastFocusedItemId))
    : undefined
  const focusedItem = focusedSection
    ? (focusedSection.items as AnyItem[]).find((i) => i.id === lastFocusedItemId)
    : undefined

  const submit = async () => {
    if (!prompt.trim() || busy) return
    // Öneriler isteğin gönderildiği andaki CV'ye göre kurulur; arada değişen alanın önerisi bayat sayılır.
    const snapshot = cv
    const { payload, unmask } = buildEditPayload(snapshot, scope, prompt)
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      const result = parseEditResult(await withAiAuth(() => provider.edit(payload, controller.signal), controller.signal))
      if (controller.signal.aborted) return
      const { suggestions: list, dropped } = operationsToSuggestions(snapshot, result, unmask, payload)
      if (dropped > 0) toast({ message: m.ai2_dropped({ count: dropped }) })
      if (list.length === 0) {
        toast({ message: provider.isDemo ? m.ai_no_suggestions_demo() : m.ai_no_suggestions() })
        return
      }
      setSuggestions(list)
      setPrompt('')
    } catch (error) {
      if (!isAiAbort(error) && !controller.signal.aborted) toast({ message: aiErrorMessage(error), tone: 'error' })
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }

  const cancel = () => {
    request.current?.abort()
    request.current = null
    setBusy(false)
  }

  if (suggestions.length > 0) {
    return (
      <div className="border-t border-line bg-surface shadow-[0_-8px_24px_rgb(0_0_0/0.04)]">
        <SuggestionReview cv={cv} demo={provider.isDemo} />
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
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
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
              <Button size="icon-sm" variant="primary" aria-label={m.ai_send()} disabled={!prompt.trim()} onClick={() => void submit()}>
                <ArrowUp />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[11.5px] text-faint">
        <span className="min-w-0 flex-1">{provider.isDemo ? m.ai_preview_note() : m.ai2_live_note()}</span>
        <WhatIsSentButton onClick={() => setShowPayload(true)} />
      </p>
      <AiPayloadDialog
        open={showPayload}
        onClose={() => setShowPayload(false)}
        build={() => buildEditPayload(cv, scope, prompt).payload}
        description={m.ai2_payload_desc()}
        rules={m.ai2_payload_rules()}
        demo={provider.isDemo}
      />
    </div>
  )
}
