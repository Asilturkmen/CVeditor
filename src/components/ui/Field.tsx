import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'
import { bareControlClass, controlClass } from './controlClass'

type ControlSize = 'sm' | 'md'

/**
 * Tek başına metin alanı. `controlSize`: md 36px (varsayılan) · sm 28px (inspector içinde tek başına).
 * Grup içinde çıplak alan için `BareInput` (FormRow ile).
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { controlSize?: ControlSize }>(
  function Input({ className, controlSize = 'md', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          controlClass,
          controlSize === 'sm' ? 'h-7 rounded-md px-2.5' : 'h-9 px-3',
          'phone:h-11',
          className,
        )}
        {...props}
      />
    )
  },
)

/** Çok satırlı kullanıcı metni: body-user 14/21. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlClass, 'px-3 py-2 text-body-user', className)} {...props} />
  },
)

/**
 * Native açılır liste (pop-up düğme görünümü): sağda çift ok. Zemin ve yazı rengi açıkça verilir
 * (Windows koyu tema). Özel görünümlü liste için `SelectMenu`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { controlSize?: ControlSize }>(
  function Select({ className, children, controlSize = 'md', ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          controlClass,
          'appearance-none bg-[image:var(--chevrons)] bg-[length:12px] bg-no-repeat',
          controlSize === 'sm' ? 'h-7 rounded-md bg-[position:right_8px_center] pr-7 pl-2.5' : 'h-9 bg-[position:right_12px_center] pr-8 pl-3',
          'phone:h-11 [&_option]:bg-elevated [&_option]:text-fg',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)

/** Grup içindeki çıplak tek satırlık alan (FormRow'un değer bölgesi). 32px. */
export const BareInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function BareInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(bareControlClass, 'h-8 phone:h-11', className)} {...props} />
})

/** Grup içindeki çıplak çok satırlı alan: kullanıcı metni 14/21, en az 4 satır. */
export const BareTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function BareTextarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(bareControlClass, 'min-h-[6.5rem] resize-y py-2 text-body-user', className)}
        {...props}
      />
    )
  },
)

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  /** Hata metni, alanın altında. Alana `aria-invalid` ve `aria-describedby={`${id}-error`}` ver. */
  error?: ReactNode
  className?: string
  children: (id: string) => ReactNode
}

/**
 * Etiket + tek başına alan (dialog, galeri sayfaları). Etiket her zaman görünür; yer tutucu etiket yerine
 * geçmez. Etiket 12/500 ikincil, ipucu 12 ikincil. Grup içindeki satır düzeni için `FormRow`.
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-callout font-medium text-fg-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p id={`${id}-error`} className="text-callout text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-callout text-fg-2">{hint}</p>
      )}
    </div>
  )
}
