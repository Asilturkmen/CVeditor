import type { LucideIcon } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * "İçerik yok" görünümü: çerçevesiz, ortalı (ortalamanın izinli olduğu yer). 40px ikon (üçüncül renk),
 * başlık title-1, açıklama en çok 360px, tek birincil eylem (`Button size="lg"`), varsa ikinci eylem yanında.
 * Kesikli çerçeve YOK; o yalnız sürükleme sırasında bırakma hedefi için (`DropZone`).
 * Metin ne olduğunu ve ne yapılacağını söyler.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
  headingLevel = 2,
}: {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon && <Icon aria-hidden className="mb-4 size-10 text-fg-3" strokeWidth={1.5} />}
      <Heading className="text-title-1 text-fg">{title}</Heading>
      {description && <p className="mt-2 max-w-90 text-body text-fg-2">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Bırakma hedefi: yalnız sürükleme sırasında (ya da dosya bekleyen alan) 2px kesikli vurgu kenarı +
 * yumuşak vurgu zemini. Dinlenmede kesiksiz gri dolgu.
 */
export function DropZone({
  active,
  children,
  className,
  ...props
}: {
  active: boolean
  children: ReactNode
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-active={active ? '' : undefined}
      className={cn(
        'rounded-xl border-2 border-transparent bg-fill-4 transition-colors duration-150',
        'data-[active]:border-dashed data-[active]:border-accent data-[active]:bg-accent-soft',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
