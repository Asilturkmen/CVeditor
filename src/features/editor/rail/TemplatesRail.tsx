import { Check } from 'lucide-react'
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Cv } from '@/cv/schema'
import { Segmented } from '@/components/ui/Segmented'
import { switchTemplate } from '@/editor/actions'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { getTemplate, settingsForTemplate, TEMPLATE_LIST, TEMPLATES, type TemplateId } from '@/render/templates'
import { TEMPLATE_TEXT } from '@/features/templates/templateText'

type ColumnFilter = 'all' | '1' | '2'

/**
 * Şablon küçük resmi: kullanıcının kendi CV'si bu şablonla, seçince olacağı gibi (switchTemplate ile aynı
 * kural, settingsForTemplate). Tıklama uygular; her seçim tek geri alma adımı.
 */
const TemplateThumb = memo(function TemplateThumb({ cv, id, active }: { cv: Cv; id: TemplateId; active: boolean }) {
  const preview = useMemo<Cv>(() => {
    if (active) return cv
    return { ...cv, templateId: id, template: settingsForTemplate(getTemplate(cv.templateId), TEMPLATES[id], cv.template, cv.sections) }
  }, [cv, id, active])
  const text = TEMPLATE_TEXT[id]
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-template-id={id}
      onClick={() => switchTemplate(id)}
      className="group flex min-w-0 flex-col gap-2 rounded-md text-left outline-offset-4"
    >
      <span
        className={cn(
          'relative block aspect-[210/297] w-full overflow-hidden rounded-sm bg-paper shadow-thumb transition-[box-shadow,translate] duration-150 ease-out',
          active
            ? 'ring-3 ring-accent ring-offset-3 ring-offset-window'
            : 'group-hover:-translate-y-px group-hover:shadow-2 motion-reduce:group-hover:translate-y-0',
        )}
      >
        <CvFrame cv={preview} scale="fit" fitPadding={0} firstPageOnly title={text.name()} />
        {active && (
          <span className="absolute top-1.5 right-1.5 flex size-5 animate-[check-in_300ms_var(--spring-bouncy)] items-center justify-center rounded-full bg-accent text-accent-fg shadow-2">
            <Check aria-hidden className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-headline text-fg">{text.name()}</span>
        <span className="text-callout text-fg-2">{text.layout()}</span>
      </span>
    </button>
  )
})

export function TemplatesRail({ cv }: { cv: Cv }) {
  const [filter, setFilter] = useState<ColumnFilter>('all')
  // 14 küçük resim her değişiklikte yeniden çizilir; yazarken öncelik panelde kalsın.
  const thumbCv = useDeferredValue(cv)
  const activeId = getTemplate(cv.templateId).id
  // "Tek ya da iki sütun" şablonlar iki süzgeçte de görünür.
  const list = TEMPLATE_LIST.filter((t) => filter === 'all' || (t.columns as readonly number[]).includes(Number(filter)))
  const listRef = useRef<HTMLDivElement>(null)

  // Ray açılınca seçili şablon görünür olsun.
  useEffect(() => {
    listRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1 pb-6">
      <div className="flex items-center gap-2 pb-2">
        <span aria-hidden className="text-callout text-fg-2">
          {m.rail_columns()}
        </span>
        <Segmented
          size="sm"
          stretch
          className="min-w-0 flex-1"
          value={filter}
          onChange={setFilter}
          aria-label={m.rail_columns()}
          options={[
            { value: 'all', label: m.rail_filter_all() },
            { value: '1', label: m.rail_filter_one() },
            { value: '2', label: m.rail_filter_two() },
          ]}
        />
      </div>
      <p aria-live="polite" className="pb-3 text-callout text-fg-2">
        {m.rail_template_count({ count: list.length })} · {m.ap_template_hint()}
      </p>
      <div role="radiogroup" aria-label={m.ap_template()} className="grid grid-cols-2 gap-x-2 gap-y-5">
        {list.map((t) => (
          <TemplateThumb key={t.id} cv={thumbCv} id={t.id} active={t.id === activeId} />
        ))}
      </div>
    </div>
  )
}
