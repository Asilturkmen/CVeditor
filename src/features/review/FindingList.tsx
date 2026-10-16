import { CircleCheck, CircleX, Lightbulb, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CATEGORIES, sortFindings, type Category, type Finding, type FindingTarget, type Severity } from '@/review/rules'

const SEVERITY: Record<Severity, { label: () => string; counted: (count: number) => string; icon: ReactNode; tone: string }> = {
  problem: { label: () => m.rv_sev_problem(), counted: (count) => m.rv_sev_problem_n({ count }), icon: <CircleX />, tone: 'text-danger' },
  warn: { label: () => m.rv_sev_warn(), counted: (count) => m.rv_sev_warn_n({ count }), icon: <TriangleAlert />, tone: 'text-warn' },
  info: { label: () => m.rv_sev_info(), counted: (count) => m.rv_sev_info_n({ count }), icon: <Lightbulb />, tone: 'text-muted' },
  ok: { label: () => m.rv_sev_ok(), counted: (count) => m.rv_sev_ok_n({ count }), icon: <CircleCheck />, tone: 'text-ok' },
}

const CATEGORY_LABELS: Record<Category, () => string> = {
  okunabilirlik: () => m.rv_cat_okunabilirlik(),
  iletisim: () => m.rv_cat_iletisim(),
  yapi: () => m.rv_cat_yapi(),
  tarihler: () => m.rv_cat_tarihler(),
  icerik: () => m.rv_cat_icerik(),
  bicim: () => m.rv_cat_bicim(),
}

/** Ölçüt değil sayım: kaç kontrol hangi durumda. */
export function SeverityCounts({ findings }: { findings: Finding[] }) {
  const order: Severity[] = ['problem', 'warn', 'info', 'ok']
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]" aria-label={m.rv_results_label()}>
      {order.map((s) => {
        const count = findings.filter((f) => f.severity === s).length
        return (
          <li key={s} className={cn('flex items-center gap-1.5', count === 0 && 'opacity-55')}>
            <span className={cn('[&_svg]:size-4', SEVERITY[s].tone)}>{SEVERITY[s].icon}</span>
            <span className="font-semibold tabular-nums">{count}</span>
            <span className="text-muted">{SEVERITY[s].counted(count)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function FindingRow({ finding, onEdit }: { finding: Finding; onEdit?: (target: FindingTarget) => void }) {
  const sev = SEVERITY[finding.severity]
  return (
    <li className="flex items-start gap-3 px-4 py-3" data-finding={finding.id} data-severity={finding.severity}>
      <span className={cn('mt-[3px] shrink-0 [&_svg]:size-4', sev.tone)} aria-hidden>
        {sev.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="leading-snug">
          <span className={cn('mr-2 text-[12.5px] font-semibold', sev.tone)}>{sev.label()}</span>
          <span className="font-medium break-words">{finding.title}</span>
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{finding.detail}</p>
      </div>
      {finding.target && onEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="-my-0.5 text-accent hover:text-accent"
          aria-label={m.rv_edit_label({ title: finding.title })}
          onClick={() => onEdit(finding.target!)}
        >
          {m.rv_edit()}
        </Button>
      )}
    </li>
  )
}

/** Kategoriye göre gruplu bulgular; her grupta önce sorunlar, en sonda geçenler. */
export function FindingGroups({
  findings,
  showPassed,
  onEdit,
}: {
  findings: Finding[]
  showPassed: boolean
  onEdit?: (target: FindingTarget) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES.map((category) => {
        const all = sortFindings(findings.filter((f) => f.category === category))
        if (!all.length) return null
        const visible = showPassed ? all : all.filter((f) => f.severity !== 'ok')
        const passed = all.length - visible.length
        return (
          <section key={category} aria-labelledby={`rv-cat-${category}`}>
            <h2 id={`rv-cat-${category}`} className="mb-2 text-[15px] font-semibold tracking-tight">
              {CATEGORY_LABELS[category]()}
            </h2>
            {visible.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {visible.map((f) => (
                  <FindingRow key={f.id} finding={f} onEdit={onEdit} />
                ))}
              </ul>
            )}
            {passed > 0 && (
              <p className={cn('flex items-center gap-1.5 text-[13px] text-muted', visible.length > 0 && 'mt-2')}>
                <CircleCheck className="size-3.5 text-ok" aria-hidden />
                {m.rv_group_passed({ count: passed })}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
