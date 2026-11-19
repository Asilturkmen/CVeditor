import type { CSSProperties } from 'react'
import { isRangeInverted, yearOptions } from '@/cv/dates'
import type { DateRange, YearMonth } from '@/cv/schema'
import { Checkbox } from '@/components/ui/Checkbox'
import { controlOnContentClass } from '@/components/ui/controlClass'
import { Select } from '@/components/ui/Field'
import { FormRow } from '@/components/ui/Group'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'

/** Ay adları arayüz dilinde; dil başına bir kez kurulur (Intl biçimleyicisi pahalı, her çizimde değil). */
const monthCache = new Map<string, string[]>()
function monthNames(): string[] {
  const locale = getLocale()
  let names = monthCache.get(locale)
  if (!names) {
    const format = new Intl.DateTimeFormat(locale, { month: 'long' })
    names = Array.from({ length: 12 }, (_, i) => format.format(new Date(2024, i, 1)))
    monthCache.set(locale, names)
  }
  return names
}

/** Ay + yıl seçicisi (native liste: uzun, düz liste). Grup içinde gri dolgulu 28px. */
export function YearMonthField({
  value,
  onChange,
  label,
  id,
  disabled,
  invalid,
  describedBy,
}: {
  value: YearMonth | null
  onChange: (value: YearMonth | null) => void
  label: string
  /** Etiketin bağlanacağı ilk seçici (ay). */
  id?: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const months = monthNames()
  const select = cn(controlOnContentClass, invalid && 'shadow-[inset_0_0_0_1px_var(--danger)]')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-1.5" role="group" aria-label={label}>
      <Select
        id={id}
        controlSize="sm"
        aria-label={`${label} · ${m.date_month()}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled || !value}
        value={value?.month ?? ''}
        onChange={(e) => value && onChange({ ...value, month: e.target.value ? Number(e.target.value) : null })}
        className={select}
      >
        <option value="">{m.date_no_month()}</option>
        {months.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        controlSize="sm"
        aria-label={`${label} · ${m.date_year()}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        value={value?.year ?? ''}
        onChange={(e) => onChange(e.target.value ? { year: Number(e.target.value), month: value?.month ?? null } : null)}
        className={select}
      >
        <option value="">{m.date_year_placeholder()}</option>
        {yearOptions(value?.year).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  )
}

/** Tek tarih satırı (sertifika, ödül). */
export function MonthRow({ label, value, onChange, labelWidth }: { label: string; value: YearMonth | null; onChange: (v: YearMonth | null) => void; labelWidth: number }) {
  return (
    <FormRow label={label} labelWidth={labelWidth}>
      {(id) => <YearMonthField id={id} label={label} value={value} onChange={onChange} />}
    </FormRow>
  )
}

/**
 * Tarih aralığı: Başlangıç ve Bitiş ayrı satır (etiket solda), altında "Devam ediyor". Devam eden işte
 * bitiş seçilmez; yerine ne yazılacağı görünür. Bitiş başlangıçtan önceyse hata alanın hemen altında.
 * Satırlar çağıranın gruplu kabına doğrudan girer (aralarındaki ayırıcıyı kap koyar).
 */
export function DateRangeRows({ value, onChange, labelWidth }: { value: DateRange; onChange: (value: DateRange) => void; labelWidth: number }) {
  const inverted = isRangeInverted(value)
  return (
    <>
      <FormRow label={m.date_start()} labelWidth={labelWidth}>
        {(id) => <YearMonthField id={id} label={m.date_start()} value={value.start} onChange={(start) => onChange({ ...value, start })} />}
      </FormRow>
      <FormRow label={m.date_end()} labelWidth={labelWidth} error={inverted ? m.date_inverted() : undefined}>
        {(id, describedBy) =>
          value.current ? (
            <span id={id} className="flex h-7 items-center px-2 text-body text-fg">
              {m.ux_date_present()}
            </span>
          ) : (
            <YearMonthField
              id={id}
              label={m.date_end()}
              value={value.end}
              invalid={inverted}
              describedBy={describedBy}
              onChange={(end) => onChange({ ...value, end })}
            />
          )
        }
      </FormRow>
      {/* Bitiş satırının parçası: üstünde ayırıcı yok (--sep-inset 100%). */}
      <div
        className="-mt-1 px-[var(--row-px)] pb-2"
        style={{ paddingLeft: `calc(var(--row-px) + ${labelWidth + 12 + 8}px)`, '--sep-inset': '100%' } as CSSProperties}
      >
        <Checkbox checked={value.current} onCheckedChange={(current) => onChange({ ...value, current })} label={m.date_current()} />
      </div>
    </>
  )
}
