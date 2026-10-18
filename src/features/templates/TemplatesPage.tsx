import { useLiveQuery } from 'dexie-react-hooks'
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
      className="group flex min-w-0 flex-col gap-3 text-left focus-visible:outline-none"
      aria-label={m.templates_choose({ name: text.name() })}
      data-template={template.id}
    >
      <div
        className={cn(
          'w-full rounded-2xl border border-line bg-canvas p-3',
          'transition-[transform,box-shadow,border-color] duration-250 ease-[var(--ease-out-soft)]',
          'group-hover:-translate-y-1 group-hover:border-line-strong group-hover:shadow-lg',
          'group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg',
        )}
      >
        <div className="aspect-[210/297] w-full overflow-hidden rounded-[3px] shadow-md">
          <CvFrame cv={sample} scale="fit" fitPadding={0} firstPageOnly title={text.name()} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-0.5">
        <h2 className="text-[15px] font-semibold tracking-tight">{text.name()}</h2>
        <span className="flex flex-wrap gap-1">
          {text.tags().map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2 py-px text-[11px] font-medium text-muted">
              {tag}
            </span>
          ))}
        </span>
        <p className="text-[13px] leading-snug text-muted">{text.description()}</p>
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
      {/* 10 şablon kategorisiz tek ızgarada: geniş ekranda 5 sütun, iki satır. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
        {TEMPLATE_LIST.map((template) => (
          <TemplateCard key={template.id} template={template} onChoose={() => setChosen(template.id)} />
        ))}
      </div>
      <p className="mt-12 max-w-2xl text-sm text-muted">{m.templates_more_soon()}</p>
      <NewCvDialog templateId={chosen} onClose={() => setChosen(null)} />
    </div>
  )
}
