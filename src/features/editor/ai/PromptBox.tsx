import { ArrowUp, Check, ChevronDown, Square, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { buildEditPayload, contactFieldsForPrompt } from '@/ai/payload'
import { operationsToSuggestions } from '@/ai/ops'
import { getAiProvider } from '@/ai/provider'
import { AI_LIMITS } from '@/ai/types'
import { parseEditResult } from '@/ai/validate'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv } from '@/cv/schema'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/toast'
import { Toolbar } from '@/components/ui/Toolbar'
import { isSuggestionFresh } from '@/editor/actions'
import { suggestionTargetId, useEditorUi, type AiScope, type Suggestion } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { withAiAuth } from '@/features/ai/aiAuth'
import { aiErrorMessage, isAiAbort } from '@/features/ai/aiErrorMessage'
import { AiPayloadDialog } from '@/features/ai/AiPayloadDialog'
import { ITEM_FIELDS } from '../content/fieldDefs'
import { itemLabel } from '../labels'
import { acceptSuggestions, firstChangedLine, rejectSuggestions } from './suggestionLogic'

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

/** Önerinin listede görünen başlığı (bölüm · kayıt) ve türü (alan adı / yeni kayıt / kaldırılacak). */
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
  field: 'bg-suggest',
  addItem: 'bg-ok',
  removeItem: 'bg-danger',
}

/**
 * Önerilerin listesi (prompt kutusunun yerini alır): başlık, "Örnek" rozeti, toplu Reddet/Kabul (her
 * zaman görünür, listenin üstünde); her satırda hedef ve tür. Seçili satırda (varsayılan ilki) açıklama
 * ve değişen ilk satır (eski → yeni) açılır. Satıra tıklamak kaydı da açar; fark kaydın içinde, alanın
 * altında okunur. Tepsi panelin en çok ~%35'i kadar yer kaplar, liste kendi içinde kayar.
 */
function SuggestionReview({ cv, demo }: { cv: Cv; demo: boolean }) {
  const suggestions = useEditorUi((s) => s.suggestions)
  const focusItem = useEditorUi((s) => s.focusItem)
  const highlightItem = useEditorUi((s) => s.highlightItem)
  const revealSuggestion = useEditorUi((s) => s.revealSuggestion)
  const setTab = useEditorUi((s) => s.setTab)
  const [chosen, setChosen] = useState<string | null>(null)
  const activeId = suggestions.some((s) => s.id === chosen) ? chosen : (suggestions[0]?.id ?? null)

  const show = (s: Suggestion) => {
    setChosen(s.id)
    revealSuggestion(s.id)
    // Yeni kaydın panelde satırı yok; yalnız önizlemede gösterilir.
    if (s.kind !== 'addItem') {
      setTab('content')
      focusItem(suggestionTargetId(s), true)
    }
  }

  return (
    // Üst çubuk 52px; tepsi (Toolbar'ın 20px dikey boşluğuyla) panel yüksekliğinin ~%35'i.
    <div className="flex max-h-[max(180px,calc((100dvh-52px)*0.35-20px))] flex-col overflow-hidden rounded-xl bg-content shadow-1 animate-rise-in">
      <div className="flex min-h-11 flex-wrap items-center gap-2 py-2 pr-2 pl-3">
        <p className="flex flex-1 items-center gap-2 text-headline text-fg">
          {m.ai_review_title({ count: suggestions.length })}
          {demo && <Badge tone="warn">{m.badge_sample()}</Badge>}
        </p>
        <Button onClick={() => rejectSuggestions(suggestions)}>{m.ai_reject_all()}</Button>
        <Button variant="primary" onClick={() => acceptSuggestions(suggestions)}>
          <Check />
          {m.ai_accept_all()}
        </Button>
      </div>
      <ul className="group-rows min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-separator [--row-px:12px]">
        {suggestions.map((s) => {
          const { title, kind } = describe(cv, s)
          const active = s.id === activeId
          const line = active && s.kind === 'field' ? firstChangedLine(s) : null
          return (
            <li
              key={s.id}
              className="flex items-start gap-1 py-1 pr-2 pl-1 transition-colors hover:bg-fill-4"
              onMouseEnter={() => highlightItem(suggestionTargetId(s))}
              onMouseLeave={() => highlightItem(null)}
            >
              <button
                type="button"
                aria-expanded={active}
                className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left outline-offset-[-3px]"
                onClick={() => show(s)}
              >
                <span className={cn('mt-[5px] size-2 shrink-0 rounded-full', DOT[s.kind])} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-body font-medium break-words text-fg">{title}</span>
                    {kind && (
                      <span className={cn('text-callout font-medium', s.kind === 'removeItem' ? 'text-danger' : s.kind === 'addItem' ? 'text-ok' : 'text-fg-2')}>
                        {kind}
                      </span>
                    )}
                  </span>
                  {active && s.note && <span className="text-callout break-words text-fg-2">{s.note}</span>}
                  {line && (line.before || line.after) && (
                    <span className="mt-0.5 text-callout break-words text-fg">
                      {line.before && <del className="text-fg-2 decoration-danger/70">{line.before}</del>}
                      {line.before && line.after && <span aria-hidden className="text-fg-3"> → </span>}
                      {line.after && <ins className="rounded-xs bg-suggest-soft no-underline">{line.after}</ins>}
                    </span>
                  )}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1 pt-1">
                <IconButton label={m.ai_reject()} icon={<X />} onClick={() => rejectSuggestions([s])} />
                <IconButton label={m.ai_accept()} icon={<Check />} className="text-ok" onClick={() => acceptSuggestions([s])} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Prompt çubuğu: panelin altında, iki sekmede de. Boşta tek satır ([Tüm CV ⌄] Ne değişsin? … Ne
 * gönderilir? [↑]); odakta ya da yazı varken büyür (en çok 5 satır), not, "Enter gönderir", iletişim
 * seçimi ve açık kayıtta "Yalnız bu kayıt" çipi görünür. İstek ai/ katmanından geçer: payload (yalnız
 * kapsam, maskeli) → sağlayıcı → doğrulama → öneriler. CV formu (`data-cv-form`) dışında: Ctrl+Z
 * burada yalnız metni geri alır.
 */
export function PromptBox({ cv, scrolled }: { cv: Cv; scrolled?: boolean }) {
  const scope = useEditorUi((s) => s.aiScope)
  const setScope = useEditorUi((s) => s.setAiScope)
  const suggestions = useEditorUi((s) => s.suggestions)
  const setSuggestions = useEditorUi((s) => s.setSuggestions)
  const lastFocusedItemId = useEditorUi((s) => s.lastFocusedItemId)
  const openRowId = useEditorUi((s) => (s.expandAll ? null : s.openRowId))
  const provider = getAiProvider()
  const [prompt, setPrompt] = useState('')
  // İletişim bilgileri yalnız açık seçimle gider (varsayılan kapalı); istekteki anahtar kelime yalnız ipucu.
  const [sendContact, setSendContact] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showPayload, setShowPayload] = useState(false)
  const [focused, setFocused] = useState(false)
  const request = useRef<AbortController | null>(null)
  const noteId = useId()

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

  const findItem = (id: string | null) => {
    if (!id) return null
    const section = cv.sections.find((s) => s.type !== 'summary' && (s.items as AnyItem[]).some((i) => i.id === id))
    const item = section && (section.items as AnyItem[]).find((i) => i.id === id)
    return section && item ? { section, item } : null
  }
  // Menüde "Seçili kayıt": en son odaklanılan kayıt (odak panelden çıkınca da kalır).
  const focused_ = findItem(lastFocusedItemId)
  // Çip: açık kayıt (anahatta tek açık satır), yoksa son odaklanılan.
  const current = findItem(openRowId) ?? focused_
  const currentScoped = !!current && scope.kind === 'item' && scope.itemId === current.item.id

  const submit = async () => {
    if (!prompt.trim() || busy) return
    // Öneriler isteğin gönderildiği andaki CV'ye göre kurulur; arada değişen alanın önerisi bayat sayılır.
    const snapshot = cv
    const { payload, restore } = buildEditPayload(snapshot, scope, prompt, { contact: sendContact })
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      const result = parseEditResult(await withAiAuth(() => provider.edit(payload, controller.signal), controller.signal))
      if (controller.signal.aborted) return
      const { suggestions: list, dropped } = operationsToSuggestions(snapshot, result, restore, payload)
      if (dropped > 0) toast({ message: m.ai2_dropped({ count: dropped }) })
      if (result.overflow > 0) toast({ message: m.ai2_overflow({ count: result.overflow, max: AI_LIMITS.operations }) })
      // Modelin kısa açıklaması (yer tutucuları yerelde geri konmuş; geri konamıyorsa gösterilmez)
      const note = result.message ? restore(result.message)?.trim().slice(0, 300) : undefined
      if (list.length === 0) {
        toast({ message: note || (provider.isDemo ? m.ai_no_suggestions_demo() : m.ai_no_suggestions()) })
        return
      }
      if (note) toast({ message: note })
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

  const contactHint = contactFieldsForPrompt(prompt).length > 0
  // Büyük hâl: odakta, yazı varken ya da istek sürerken.
  const expanded = focused || prompt.length > 0 || busy

  const payloadDialog = (
    <AiPayloadDialog
      open={showPayload}
      onClose={() => setShowPayload(false)}
      build={() => buildEditPayload(cv, scope, prompt, { contact: sendContact }).payload}
      description={m.ai2_payload_desc()}
      rules={
        <>
          {m.ai2_payload_rules()}
          <span className="mt-1.5 block font-medium text-fg" data-testid="ai-contact-state">
            {sendContact ? m.ai_contact_state_on() : m.ai_contact_state_off()}
          </span>
        </>
      }
      demo={provider.isDemo}
    />
  )

  if (suggestions.length > 0) {
    return (
      <Toolbar as="div" edge="top" scrolled={scrolled} className="block shrink-0 px-3 pt-2 pb-3">
        <SuggestionReview cv={cv} demo={provider.isDemo} />
      </Toolbar>
    )
  }

  const whatIsSent = (
    <button
      type="button"
      onClick={() => setShowPayload(true)}
      className="press shrink-0 rounded-sm px-1 text-callout font-medium text-fg underline decoration-fg-3 underline-offset-2 hover:decoration-fg"
    >
      {m.ai2_what_is_sent()}
    </button>
  )

  return (
    <Toolbar
      as="div"
      edge="top"
      scrolled={scrolled}
      className="block shrink-0 px-3 py-2"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-1 gap-y-1 rounded-xl bg-content px-1.5 shadow-1 transition-shadow duration-150',
          'focus-within:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_color-mix(in_srgb,var(--accent)_20%,transparent)]',
          expanded ? 'pt-1.5 pb-1.5' : 'min-h-9',
        )}
      >
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="press inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-sm px-1.5 text-left text-callout font-medium text-fg hover:bg-fill-4 data-[state=open]:bg-fill-4"
              aria-label={m.ai_scope_label()}
            >
              <span className="min-w-0 break-words">{scopeLabel(cv, scope)}</span>
              <ChevronDown aria-hidden className="size-3.5 shrink-0 text-fg-2" />
            </button>
          </MenuTrigger>
          <MenuContent align="start" side="top">
            <MenuLabel>{m.ai_scope_label()}</MenuLabel>
            <MenuItem onSelect={() => setScope({ kind: 'all' })}>{m.ai_scope_all()}</MenuItem>
            {focused_ && (
              <MenuItem onSelect={() => setScope({ kind: 'item', sectionId: focused_.section.id, itemId: focused_.item.id })}>
                {m.ai_scope_selected({ name: itemLabel(focused_.section.type, focused_.item) || m.editor_untitled() })}
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
        {expanded && current && (
          <button
            type="button"
            aria-pressed={currentScoped}
            onClick={() =>
              setScope(currentScoped ? { kind: 'all' } : { kind: 'item', sectionId: current.section.id, itemId: current.item.id })
            }
            className={cn(
              'press inline-flex h-6 items-center rounded-full px-2.5 text-callout font-medium transition-colors',
              currentScoped ? 'bg-accent-soft text-fg' : 'bg-fill-3 text-fg hover:bg-fill-2',
            )}
          >
            {m.ai_scope_this_item()}
          </button>
        )}
        {provider.isDemo && <Badge tone="warn">{m.badge_sample()}</Badge>}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={1}
          disabled={busy}
          placeholder={expanded ? m.ai_placeholder() : m.ai_placeholder_short()}
          aria-label={m.ai_label()}
          aria-describedby={noteId}
          className={cn(
            'block min-w-0 resize-none bg-transparent px-1.5 text-body-user text-fg placeholder:text-fg-2 focus:outline-none',
            '[field-sizing:content] max-h-[calc(5*21px+12px)] overflow-y-auto',
            // Boşta tek satır: yer tutucu sarmaz (kısa metin; sığmazsa kaydırılır, satır büyümez).
            expanded ? '-order-1 basis-full py-1.5' : 'h-8 flex-1 overflow-hidden py-[5px] whitespace-nowrap',
          )}
        />
        {expanded && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-1 text-callout text-fg" role="status">
            {busy && <Spinner size={12} />}
            {busy ? m.ai_working() : m.ai_enter_hint()}
          </span>
        )}
        {whatIsSent}
        {busy ? (
          <IconButton label={m.ai_stop()} variant="secondary" icon={<Square className="!size-3 fill-current" />} onClick={cancel} className="rounded-full" />
        ) : (
          <IconButton
            label={m.ai_send()}
            variant="primary"
            icon={<ArrowUp />}
            disabled={!prompt.trim()}
            onClick={() => void submit()}
            className="rounded-full"
          />
        )}
      </div>
      {expanded && (
        <div className="mt-2 flex flex-col gap-1.5 px-1 animate-rise-in">
          <Checkbox
            checked={sendContact}
            disabled={busy}
            onCheckedChange={setSendContact}
            label={m.ai_contact_toggle()}
            className="text-callout [&_label]:text-callout"
          />
          {!sendContact && contactHint && (
            <p className="text-callout text-fg" data-testid="ai-contact-hint">
              {m.ai_contact_hint()}
            </p>
          )}
          <p id={noteId} className="text-callout text-fg">
            {provider.isDemo ? m.ai_preview_note() : m.ai2_live_note()}
          </p>
        </div>
      )}
      {payloadDialog}
    </Toolbar>
  )
}
