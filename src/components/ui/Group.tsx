import { ChevronRight } from 'lucide-react'
import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Satır iç boşluğu: inspector 12px (`md`), Ayarlar ve geniş sayfa 16px (`lg`). Grup başlığı, satır
 * metni ve grup altı notu bu değerle AYNI x'te başlar (ortak sol kenar).
 */
type Inset = 'md' | 'lg'
const insetPx: Record<Inset, number> = { md: 12, lg: 16 }

/**
 * Grup: ilgili satırlar tek beyaz blokta (yarıçap 12, açıkta ince gölge, koyuda gölgesiz), aralarında
 * metnin x'inden başlayan ince ayırıcı. Ayırıcıyı grup koyar (koşullu satırda çift çizgi olmaz).
 * Kutu içinde kutu yok: grup içindeki alan çıplaktır (`FormRow` + `BareInput`).
 * Başlık: `title` (inspector bölümü `size="section"` title-3; Ayarlar `size="settings"` title-2),
 * yanında düz sayı (`count`, rozet değil) ve sağda ikon düğmeleri (`actions`). Altında not (`footer`).
 */
export function Group({
  title,
  count,
  leading,
  actions,
  footer,
  children,
  inset = 'md',
  size = 'section',
  className,
  bodyClassName,
  id,
  'aria-label': ariaLabel,
}: {
  title?: ReactNode
  count?: ReactNode
  /** Başlığın solunda (sürükleme tutamağı). */
  leading?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  inset?: Inset
  size?: 'section' | 'settings'
  className?: string
  bodyClassName?: string
  id?: string
  'aria-label'?: string
}) {
  const headingId = useId()
  const px = insetPx[inset]
  const style = { '--row-px': `${px}px` } as CSSProperties
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : ariaLabel}
      className={cn('min-w-0', className)}
      style={style}
    >
      {(title || actions) && (
        <div
          className="mb-2 flex min-h-7 items-center gap-2"
          style={{ paddingLeft: leading ? 0 : px, paddingRight: 4 }}
        >
          {leading}
          {title && (
            <h3 id={headingId} className={cn('min-w-0 text-fg', size === 'settings' ? 'text-title-2' : 'text-title-3')}>
              {title}
            </h3>
          )}
          {count !== undefined && count !== null && <span className="text-body text-fg-2 tabular-nums">{count}</span>}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className={cn('group-rows overflow-hidden rounded-xl bg-content shadow-1', bodyClassName)}>{children}</div>
      {footer && (
        <div className="mt-2 text-callout text-fg-2" style={{ paddingLeft: px, paddingRight: px }}>
          {footer}
        </div>
      )}
    </section>
  )
}

/** Satırın ortak düzeni: başlık + açıklama solda, kontrol sağda dikey ortalı. */
interface GroupRowProps {
  title: ReactNode
  description?: ReactNode
  /** Solda ikon (16px) ya da küçük resim. Varsa ayırıcı metnin x'inden başlar. */
  leading?: ReactNode
  /** Sağda kontrol: `md` (28px) düğme, anahtar, segmented, düz ikincil değer metni. */
  trailing?: ReactNode
  /** Satır bir düğmedir (gezinen satır): hover/basılı dolgu, sağda ok. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  /** Gezinen satırın sağındaki ok (`onClick` varken varsayılan açık). */
  chevron?: boolean
  selected?: boolean
  disabled?: boolean
  /** Satırın tamamı bir kontrolün etiketi olsun (anahtar/onay kutusu): kontrolün `id`'si. */
  htmlFor?: string
  /** Leading genişliği (px); ayırıcının başlangıcı için. Varsayılan 16 (ikon) + 12 aralık. */
  leadingWidth?: number
  className?: string
  id?: string
}

/**
 * Gruplu satır (Ayarlar, liste). En az 44px (açıklamalıyla ~56); başlık body birincil, açıklama callout
 * ikincil, 2px altta. Uzun metin sarar, satır büyür; "…" ile kesilmez. Sağdaki değer düz ikincil yazı
 * (rozet değil). Seçili satır yumuşak vurgu zemini.
 */
export function GroupRow({
  title,
  description,
  leading,
  trailing,
  onClick,
  chevron,
  selected,
  disabled,
  htmlFor,
  leadingWidth = 16,
  className,
  id,
}: GroupRowProps) {
  const descId = useId()
  const sepInset = leading ? `calc(var(--row-px) + ${leadingWidth + 12}px)` : undefined
  const body = (
    <>
      {leading && (
        <span className="flex shrink-0 items-center text-fg [&_svg]:size-4" style={{ width: leadingWidth }}>
          {leading}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 text-left">
        <span className={cn('text-body break-words', disabled ? 'text-fg-3' : 'text-fg')}>{title}</span>
        {description && (
          <span id={descId} className="text-callout break-words text-fg-2">
            {description}
          </span>
        )}
      </span>
    </>
  )
  const rowClass = cn(
    'flex min-h-11 w-full items-center gap-3 px-[var(--row-px)] phone:min-h-11',
    selected && 'bg-accent-soft',
    className,
  )
  const style = sepInset ? ({ '--sep-inset': sepInset } as CSSProperties) : undefined

  if (onClick) {
    return (
      <div className="relative" style={style} id={id}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-current={selected || undefined}
          className={cn(
            rowClass,
            'press press-wide outline-offset-[-3px] transition-colors hover:bg-fill-4 active:bg-fill-3 disabled:cursor-not-allowed disabled:hover:bg-transparent',
            selected && 'hover:bg-accent-soft',
          )}
        >
          {body}
          {trailing && <span className="flex shrink-0 items-center gap-2 text-body text-fg-2">{trailing}</span>}
          {(chevron ?? true) && <ChevronRight aria-hidden className="size-3 shrink-0 text-fg-3" />}
        </button>
      </div>
    )
  }

  if (htmlFor) {
    return (
      <div className={rowClass} style={style} id={id}>
        <label htmlFor={htmlFor} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch">
          {body}
        </label>
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
    )
  }

  return (
    <div className={rowClass} style={style} id={id}>
      {body}
      {trailing && <div className="flex shrink-0 items-center gap-2 text-body text-fg-2">{trailing}</div>}
    </div>
  )
}

/**
 * Inspector form satırı: solda 120px etiket (ikincil), sağda çıplak alan (`BareInput`, `SelectMenu`,
 * metin). 40px. Etiketsiz boş yere tıklamak alanı odaklar. `stacked`: etiket üstte, alan tam genişlik
 * (zengin metin, uzun etiket). Hata: alanın altında kırmızı callout; alana `aria-invalid` ver.
 */
export function FormRow({
  label,
  children,
  stacked,
  error,
  hint,
  labelWidth = 120,
  className,
}: {
  label: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
  stacked?: boolean
  error?: ReactNode
  hint?: ReactNode
  labelWidth?: number
  className?: string
}) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  const focusField = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const el = document.getElementById(id)
    if (el) {
      e.preventDefault()
      el.focus()
    }
  }
  return (
    <div className={cn('px-[var(--row-px)]', stacked ? 'py-2' : 'py-1', className)} onMouseDown={focusField}>
      <div
        className={cn(stacked ? 'flex flex-col gap-1' : 'grid min-h-8 items-center gap-x-3')}
        style={stacked ? undefined : { gridTemplateColumns: `${labelWidth}px minmax(0, 1fr)` }}
        onMouseDown={focusField}
      >
        <label htmlFor={id} className={cn('text-body break-words text-fg-2', stacked && 'px-2 pt-1')}>
          {label}
        </label>
        <div className="min-w-0">{children(id, note ? noteId : undefined)}</div>
      </div>
      {note && (
        <p
          id={noteId}
          className={cn('pb-1 text-callout', error ? 'text-danger' : 'text-fg-2')}
          style={stacked ? { paddingLeft: 8 } : { paddingLeft: labelWidth + 12 + 8 }}
        >
          {note}
        </p>
      )}
    </div>
  )
}
