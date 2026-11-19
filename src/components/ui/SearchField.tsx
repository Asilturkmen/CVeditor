import { Search, X } from 'lucide-react'
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Kbd } from './Badge'
import { controlClass } from './controlClass'

/**
 * Arama alanı: 36px, yarıçap 10, solda 16px büyüteç (ikincil), değer varken sağda temizle (✕),
 * boşken sağda kısayol (`shortcut`, ör. "/"). Genişliği çağıran verir (sayfa başlığında 240px).
 */
export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
    value: string
    onValueChange: (value: string) => void
    shortcut?: string
    /** Temizle düğmesinin erişilebilir adı. */
    clearLabel?: string
    wrapperClassName?: string
  }
>(function SearchField({ value, onValueChange, shortcut, clearLabel, className, wrapperClassName, ...props }, ref) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-2" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          controlClass,
          'h-9 pr-9 pl-9 phone:h-11 [&::-webkit-search-cancel-button]:hidden',
          className,
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel ?? m.common_clear()}
          onClick={() => onValueChange('')}
          className="press press-sm absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-2 hover:bg-fill-3 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut && <Kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 pointer-coarse:hidden">{shortcut}</Kbd>
      )}
    </div>
  )
})
