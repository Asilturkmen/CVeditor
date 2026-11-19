import { DropdownMenu } from 'radix-ui'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Menü (⋯ ve açılır eylem listeleri). Yüzey opak, yarıçap 12, iç boşluk 4, öğe 32px / yarıçap 8.
 * Vurgu (hover + klavye) gri dolgu; metin değişmez. Yıkıcı öğe en altta, ayırıcıdan sonra.
 * Bir menüde ikon ya hepsinde ya hiçbirinde.
 */
export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuGroup = DropdownMenu.Group

export const menuContentClass = 'pop z-50 max-w-80 min-w-45 rounded-xl bg-elevated p-1 shadow-3 outline-none'

export function MenuContent({
  children,
  align = 'end',
  side = 'bottom',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'center'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={8}
        className={cn(menuContentClass, className)}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export const menuItemClass =
  'flex min-h-8 cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-body outline-none select-none ' +
  'data-[highlighted]:bg-fill-4 active:bg-fill-3 data-[disabled]:text-fg-3 data-[disabled]:active:bg-transparent ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

function Trailing({ hint, shortcut }: { hint?: ReactNode; shortcut?: ReactNode }) {
  return (
    <>
      {hint && <span className="text-callout text-fg-2">{hint}</span>}
      {shortcut && <span className="text-callout text-fg-2 tabular-nums">{shortcut}</span>}
    </>
  )
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
  hint,
  shortcut,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  /** Devre dışı öğenin nedeni ya da kısa not (sağda, ikincil renk). */
  hint?: ReactNode
  /** Klavye kısayolu (sağda, ikincil renk). */
  shortcut?: ReactNode
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(menuItemClass, danger ? 'text-danger' : 'text-fg', !danger && '[&_svg]:text-fg')}
    >
      {icon}
      <span className="flex-1">{children}</span>
      <Trailing hint={hint} shortcut={shortcut} />
    </DropdownMenu.Item>
  )
}

/** Açık/kapalı menü öğesi: seçiliyken solda onay işareti (ikonlu öğelerle aynı girinti). */
export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  disabled,
  shortcut,
}: {
  children: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  shortcut?: ReactNode
}) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      onSelect={(e) => e.preventDefault()}
      className={cn(menuItemClass, 'text-fg')}
    >
      <span className="flex size-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Check className="text-fg" />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="flex-1">{children}</span>
      <Trailing shortcut={shortcut} />
    </DropdownMenu.CheckboxItem>
  )
}

/** Tek seçimli öğe listesi (ör. Sığdır · Genişliğe sığdır · %100). */
export function MenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
      {children}
    </DropdownMenu.RadioGroup>
  )
}

export function MenuRadioItem({
  value,
  children,
  disabled,
  shortcut,
}: {
  value: string
  children: ReactNode
  disabled?: boolean
  shortcut?: ReactNode
}) {
  return (
    <DropdownMenu.RadioItem value={value} disabled={disabled} className={cn(menuItemClass, 'text-fg')}>
      <span className="flex size-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Check className="text-fg" />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="flex-1">{children}</span>
      <Trailing shortcut={shortcut} />
    </DropdownMenu.RadioItem>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-2.5 my-1 h-px bg-separator" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="flex min-h-7 items-center px-2.5 text-callout text-fg-2">{children}</DropdownMenu.Label>
  )
}
