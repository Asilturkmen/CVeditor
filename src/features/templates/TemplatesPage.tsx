import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { db } from '@/db/db'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { TEMPLATE_LIST, type TemplateDef, type TemplateId } from '@/render/templates'
import { NewCvDialog } from './NewCvDialog'
import { TEMPLATE_TEXT } from './templateText'
import { useSampleCv } from './useSampleCv'

function TemplateCard({ template, onChoose }: { template: TemplateDef; onChoose: () => void }) {
  const sample = useSampleCv(template.id)
  const text = TEMPLATE_TEXT[template.id]
  return (
    <button
      type="button"
      onClick={onChoose}
      className="group flex flex-col gap-4 text-left focus-visible:outline-none"
      aria-label={m.templates_choose({ name: text.name() })}
    >
      <div
        className={cn(
          'relative w-full rounded-2xl border border-line bg-canvas p-5',
          'transition-[transform,box-shadow,border-color] duration-250 ease-[var(--ease-out-soft)]',
          'group-hover:-translate-y-1 group-hover:border-line-strong group-hover:shadow-lg',
          'group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg',
        )}
      >
        <div className="aspect-[210/297] w-full overflow-hidden rounded-[3px] shadow-md">
          <CvFrame cv={sample} scale="fit" fitPadding={0} firstPageOnly title={text.name()} />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4 px-1">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            {text.name()}
            <span className="rounded-full border border-line px-2 py-px text-[11px] font-medium text-muted">
              {text.layout()}
            </span>
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted">{text.description()}</p>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent opacity-80 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
          {m.templates_use()}
          <ArrowRight className="size-4" />
        </span>
      </div>
    </button>
  )
}

export function TemplatesPage() {
  const count = useLiveQuery(() => db.cvs.count())
  const [chosen, setChosen] = useState<TemplateId | null>(null)
  if (count === undefined) return null
  const firstVisit = count === 0

  return (
    <div className="animate-fade-in">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstVisit ? m.templates_welcome_title() : m.templates_title()}
        </h1>
        <p className="mt-1.5 text-muted">{firstVisit ? m.templates_welcome_body() : m.templates_subtitle()}</p>
      </div>
      <div className="grid max-w-[920px] grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2">
        {TEMPLATE_LIST.map((template) => (
          <TemplateCard key={template.id} template={template} onChoose={() => setChosen(template.id)} />
        ))}
      </div>
      <p className="mt-12 max-w-2xl text-sm text-muted">{m.templates_more_soon()}</p>
      <NewCvDialog templateId={chosen} onClose={() => setChosen(null)} />
    </div>
  )
}
