import { useId } from 'react'
import { isRangeInverted } from '@/cv/dates'
import type { DateRange, YearMonth } from '@/cv/schema'
import { controlClass, Select } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'

const monthNames = () =>
  Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(getLocale(), { month: 'long' }).format(new Date(2024, i, 1)),
  )

const thisYear = new Date().getFullYear()
const YEARS = Array.from({ length: thisYear + 6 - 1960 }, (_, i) => thisYear + 5 - i)

export function YearMonthField({
  value,
  onChange,
  label,
  disabled,
  invalid,
}: {
  value: YearMonth | null
  onChange: (value: YearMonth | null) => void
  label: string
  disabled?: boolean
  invalid?: boolean
}) {
  const months = monthNames()
  return (
    <div className="grid grid-cols-[1fr_88px] gap-1.5" role="group" aria-label={label}>
      <Select
        aria-label={`${label} · ${m.date_month()}`}
        disabled={disabled || !value}
        value={value?.month ?? ''}
        onChange={(e) => value && onChange({ ...value, month: e.target.value ? Number(e.target.value) : null })}
        className={cn(invalid && 'border-danger')}
      >
        <option value="">{m.date_no_month()}</option>
        {months.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        aria-label={`${label} · ${m.date_year()}`}
        disabled={disabled}
        value={value?.year ?? ''}
        onChange={(e) =>
          onChange(e.target.value ? { year: Number(e.target.value), month: value?.month ?? null } : null)
        }
        className={cn(invalid && 'border-danger')}
      >
        <option value="">{m.date_year_placeholder()}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function DateRangeField({ value, onChange }: { value: DateRange; onChange: (value: DateRange) => void }) {
  const currentId = useId()
  const inverted = isRangeInverted(value)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted">{m.date_start()}</span>
          <YearMonthField label={m.date_start()} value={value.start} onChange={(start) => onChange({ ...value, start })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-muted">{m.date_end()}</span>
            <label htmlFor={currentId} className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-muted">
              <input
                id={currentId}
                type="checkbox"
                checked={value.current}
                onChange={(e) => onChange({ ...value, current: e.target.checked })}
                className="size-3.5 accent-[var(--accent)]"
              />
              {m.date_current()}
            </label>
          </div>
          {value.current ? (
            // Devam eden işte bitiş seçilmez; boş ve gri seçiciler yerine ne yazılacağını göster.
            <div className={cn(controlClass, 'flex h-9 items-center bg-surface-2 px-3 text-sm text-muted hover:border-line')}>
              {m.ux_date_present()}
            </div>
          ) : (
            <YearMonthField
              label={m.date_end()}
              value={value.end}
              invalid={inverted}
              onChange={(end) => onChange({ ...value, end })}
            />
          )}
        </div>
      </div>
      {inverted && <p className="text-xs text-danger">{m.date_inverted()}</p>}
    </div>
  )
}
