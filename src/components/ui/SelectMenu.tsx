import { Select as S } from 'radix-ui'
import { Check, ChevronsUpDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { menuItemClass } from './Menu'

export interface SelectMenuOption {
  value: string
  label: ReactNode
  /** Düğmede gösterilecek kısa metin (menüdeki etiket uzun/biçimliyse). */
  short?: ReactNode
  disabled?: boolean
  /** Öğe metnine stil (ör. yazı tipi seçicide her seçenek kendi yazı tipinde). */
  style?: CSSProperties
}

export interface SelectMenuGroup {
  label?: ReactNode
  options: SelectMenuOption[]
}

/**
 * Açılır düğme (macOS pop-up button): 28px, yarıçap 8, gri dolgu; solda seçili değer, sağda 12px çift ok.
 * Menü, seçili öğe düğmenin tam üstüne gelecek biçimde açılır; seçili öğenin solunda onay işareti.
 * 2-5 öğe ve yer varsa bunun yerine `Segmented` kullan. `bare`: grup satırında zeminsiz.
 */
export function SelectMenu({
  value,
  onValueChange,
  options,
  groups,
  id,
  size = 'md',
  bare,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  value: string
  onValueChange: (value: string) => void
  options?: SelectMenuOption[]
  groups?: SelectMenuGroup[]
  id?: string
  size?: 'sm' | 'md'
  bare?: boolean
  disabled?: boolean
  placeholder?: ReactNode
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
}) {
  const all = groups ?? [{ options: options ?? [] }]
  const selected = all.flatMap((g) => g.options).find((o) => o.value === value)
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn(
          'press inline-flex max-w-full min-w-0 items-center justify-between gap-1.5 text-left text-body text-fg',
          size === 'sm' ? 'h-6 rounded-sm pr-1.5 pl-2 text-callout' : 'h-7 rounded-md pr-2 pl-3',
          bare ? 'hover:bg-fill-4 active:bg-fill-3 data-[state=open]:bg-fill-4' : 'bg-fill-3 hover:bg-fill-2 active:bg-fill-1 data-[state=open]:bg-fill-2',
          'phone:h-11 disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
      >
        <span className="min-w-0 break-words">
          <S.Value placeholder={<span className="text-fg-2">{placeholder}</span>}>
            {selected?.short !== undefined ? <span style={selected.style}>{selected.short}</span> : undefined}
          </S.Value>
        </span>
        <S.Icon asChild>
          <ChevronsUpDown aria-hidden className="size-3 shrink-0 text-fg-2" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="item-aligned"
          className="pop z-50 max-h-[min(70dvh,var(--radix-select-content-available-height))] max-w-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl bg-elevated shadow-3"
        >
          <S.Viewport className="p-1">
            {all.map((group, gi) => (
              <S.Group key={gi}>
                {gi > 0 && <S.Separator className="mx-2.5 my-1 h-px bg-separator" />}
                {group.label && (
                  <S.Label className="flex min-h-7 items-center px-2.5 pl-8 text-callout text-fg-2">{group.label}</S.Label>
                )}
                {group.options.map((o) => (
                  <S.Item key={o.value} value={o.value} disabled={o.disabled} className={cn(menuItemClass, 'gap-1.5 pl-2 text-fg')}>
                    <span className="flex size-4 items-center justify-center">
                      <S.ItemIndicator>
                        <Check className="size-3.5" />
                      </S.ItemIndicator>
                    </span>
                    <S.ItemText>
                      <span style={o.style}>{o.label}</span>
                    </S.ItemText>
                  </S.Item>
                ))}
              </S.Group>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
