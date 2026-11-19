import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { buttonClass } from './buttonClass'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Erişilebilir ad; ipucu da varsayılan olarak bu metni gösterir. Zorunlu. */
  label: string
  icon: ReactNode
  /** İpucuda etiketin yanında gösterilen kısayol ("Ctrl+Z"). */
  shortcut?: string
  /** İpucu yerine başka metin; `false` ipucusuz (ör. menü tetikleyicisi kendi ipucunu taşıyorsa). */
  tooltip?: ReactNode | false
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
  /** md 28 (varsayılan) · sm 24 · lg 36. Telefonda hepsi 44. */
  size?: 'sm' | 'md' | 'lg'
  /** Açık/seçili durum (menüsü açık, biçim etkin): gri zemin. `aria-pressed` ayrıca verilmeli. */
  active?: boolean
  /** Varsayılan nötr; yalnız gönder gibi tek birincil ikon eylemde `primary`. */
  variant?: 'ghost' | 'primary' | 'secondary'
}

/**
 * İkon düğmesi: dinlenmede zeminsiz, hover gri, basılı daha koyu + 0.94 ölçek. `aria-label` ve ipucu
 * her zaman var. İki ikon düğmesi arası 4px; geri al/yinele gibi gruplar `ToolbarGroup` içinde.
 * Menü tetikleyicisi olarak: `<MenuTrigger asChild><IconButton .../></MenuTrigger>`.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, shortcut, tooltip, tooltipSide, size = 'md', active, variant = 'ghost', className, type = 'button', ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={buttonClass({
        variant,
        size: size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon',
        className: cn(active && variant === 'ghost' && 'bg-fill-2', 'data-[state=open]:bg-fill-2', className),
      })}
      {...props}
    >
      {icon}
    </button>
  )
  if (tooltip === false) return button
  return (
    <Tooltip content={tooltip ?? label} shortcut={shortcut} side={tooltipSide}>
      {button}
    </Tooltip>
  )
})
