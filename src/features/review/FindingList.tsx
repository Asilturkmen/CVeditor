import { CircleCheck, CircleX, Lightbulb, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Disclosure } from '@/components/ui/Disclosure'
import { Group } from '@/components/ui/Group'
import { InlineNotice } from '@/components/ui/Notice'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CATEGORIES, sortFindings, type Category, type Finding, type FindingTarget, type Severity } from '@/review/rules'

const SEVERITY: Record<Severity, { label: () => string; counted: (count: number) => string; icon: ReactNode; tone: string }> = {
  problem: { label: () => m.rv_sev_problem(), counted: (count) => m.rv_sev_problem_n({ count }), icon: <CircleX />, tone: 'text-danger' },
  warn: { label: () => m.rv_sev_warn(), counted: (count) => m.rv_sev_warn_n({ count }), icon: <TriangleAlert />, tone: 'text-warn' },
  info: { label: () => m.rv_sev_info(), counted: (count) => m.rv_sev_info_n({ count }), icon: <Lightbulb />, tone: 'text-fg-2' },
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

/** Ölçüt değil sayım: kaç kontrol hangi durumda. Sıfır olan ikincil renkte (opaklıkla soldurma yok). */
export function SeverityCounts({ findings }: { findings: Finding[] }) {
  const order: Severity[] = ['problem', 'warn', 'info', 'ok']
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body" aria-label={m.rv_results_label()}>
      {order.map((s) => {
        const count = findings.filter((f) => f.severity === s).length
        return (
          <li key={s} className={cn('flex items-center gap-1.5', count === 0 ? 'text-fg-2' : 'text-fg')}>
            <span className={cn('[&_svg]:size-4', count === 0 ? 'text-fg-3' : SEVERITY[s].tone)} aria-hidden>
              {SEVERITY[s].icon}
            </span>
            <span className="font-semibold tabular-nums">{count}</span>
            <span>{SEVERITY[s].counted(count)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Bulgu satırı: solda durum ikonu (şekil + renk), başlık ve nedeni; sağda durum ve kategori adı
 * (renk tek işaret değil) ve varsa "Düzenle". Geçen kontrollerde kategori yazılmaz (zaten kategori
 * başlığı altında).
 */
function FindingRow({
  finding,
  onEdit,
  showCategory,
}: {
  finding: Finding
  onEdit?: (target: FindingTarget) => void
  showCategory: boolean
}) {
  const sev = SEVERITY[finding.severity]
  const target = finding.target
  return (
    <li className="flex items-start gap-3 px-[var(--row-px)] py-3" data-finding={finding.id} data-severity={finding.severity}>
      <span className={cn('mt-px shrink-0 [&_svg]:size-4', sev.tone)} aria-hidden>
        {sev.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-body font-medium break-words text-fg">{finding.title}</p>
          <p className="shrink-0 text-callout text-fg-2">
            {sev.label()}
            {showCategory && <> · {CATEGORY_LABELS[finding.category]()}</>}
          </p>
        </div>
        <p className="text-callout break-words text-fg-2">{finding.detail}</p>
      </div>
      {target && onEdit && (
        <Button
          variant="plain"
          className="-my-1 -mr-2"
          aria-label={m.rv_edit_label({ title: finding.title })}
          onClick={() => onEdit(target)}
        >
          {m.rv_edit()}
        </Button>
      )}
    </li>
  )
}

/**
 * Sonuç listesi: önce düzeltilecekler (sorun, uyarı, öneri; önem sırasıyla) tek grupta, sonra
 * "Geçen N kontrol" kapalı açılır satırı; açılınca geçenler kategori kategori.
 */
export function FindingGroups({ findings, onEdit }: { findings: Finding[]; onEdit?: (target: FindingTarget) => void }) {
  const todo = sortFindings(findings.filter((f) => f.severity !== 'ok'))
  const passed = findings.filter((f) => f.severity === 'ok')
  return (
    <div className="flex flex-col gap-6">
      {todo.length > 0 ? (
        <Group title={m.rv_todo_title()} count={todo.length} inset="lg">
          <ul className="group-rows" aria-label={m.rv_todo_title()}>
            {todo.map((f) => (
              <FindingRow key={f.id} finding={f} onEdit={onEdit} showCategory />
            ))}
          </ul>
        </Group>
      ) : (
        <InlineNotice tone="ok" className="px-4">
          {m.rv_todo_none()}
        </InlineNotice>
      )}

      {passed.length > 0 && (
        // Özet satırının oku grup başlıklarıyla aynı x'te (16px); açılan içerik tam genişlik (içeriği kırpan kapta negatif boşluk yok).
        <Disclosure summary={m.rv_passed_summary({ count: passed.length })} className="[&>button]:ml-3">
          <div className="flex flex-col gap-5 pt-2">
            {CATEGORIES.map((category) => {
              const rows = passed.filter((f) => f.category === category)
              if (!rows.length) return null
              return (
                <Group key={category} title={CATEGORY_LABELS[category]()} inset="lg">
                  <ul className="group-rows" aria-label={CATEGORY_LABELS[category]()}>
                    {rows.map((f) => (
                      <FindingRow key={f.id} finding={f} showCategory={false} />
                    ))}
                  </ul>
                </Group>
              )
            })}
          </div>
        </Disclosure>
      )}
    </div>
  )
}
