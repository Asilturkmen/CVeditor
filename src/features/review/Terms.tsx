import type { ReactNode } from 'react'

/**
 * Anahtar kelime: düz metin, satır içi liste öğesi; terimler arasında süs ayırıcı `·` (hap/çip
 * değil, DESIGN "değer hap içine alınmaz"). Eksik/Var ayrımı listenin başlığında (renk tek işaret değil).
 * `present` geriye uyum için kalır; görünümü değiştirmez.
 */
export function TermChip({
  children,
  title,
  'aria-label': ariaLabel,
}: {
  present?: boolean
  children: ReactNode
  title?: string
  'aria-label'?: string
}) {
  return (
    <li
      title={title}
      aria-label={ariaLabel}
      className="inline text-body text-fg after:mx-1.5 after:text-fg-3 after:content-['·'] last:after:content-none"
    >
      {children}
    </li>
  )
}

/** Başlık (isteğe bağlı ikonla) + düz sayı + (varsa) açıklama + terimler tek paragraf gibi akar. */
export function TermList({
  title,
  count,
  hint,
  icon,
  children,
}: {
  title: string
  count: number
  hint?: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <h4 className="flex items-center gap-1.5 text-headline text-fg">
        {icon && (
          <span aria-hidden className="flex [&_svg]:size-4">
            {icon}
          </span>
        )}
        {title}
        <span className="font-normal text-fg-2 tabular-nums">{count}</span>
      </h4>
      {hint && count > 0 && <p className="mt-0.5 text-callout text-fg-2">{hint}</p>}
      {count > 0 && (
        <ul className="mt-1.5 break-words" aria-label={title}>
          {children}
        </ul>
      )}
    </div>
  )
}
