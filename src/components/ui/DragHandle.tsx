import { GripVertical } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'

/**
 * Sürükleme tutamağı: 16px ⠿ (üçüncül renk, hover birincil), tıklama alanı 24px × satır yüksekliği,
 * `grab` imleci. Her zaman görünür. dnd-kit `attributes` + `listeners` buraya yayılır; klavye
 * karşılığı (KeyboardSensor) ve ⋯ menüsünde "Yukarı taşı / Aşağı taşı" zorunlu.
 */
export const DragHandle = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }>(
  function DragHandle({ label, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label ?? m.common_drag_handle()}
        className={cn(
          'flex w-6 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-sm text-fg-3',
          'transition-colors duration-150 hover:text-fg active:cursor-grabbing',
          className,
        )}
        {...props}
      >
        <GripVertical className="size-4" />
      </button>
    )
  },
)
