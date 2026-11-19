import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'warn' | 'danger' | 'ok' | 'info'

const icons = { warn: TriangleAlert, danger: CircleX, ok: CircleCheck, info: Info }
const iconColor: Record<Tone, string> = { warn: 'text-warn', danger: 'text-danger', ok: 'text-ok', info: 'text-fg-2' }

/**
 * Yüzen tek satırlık uyarı kapsülü (sayfa taşması, "bilgisayardan aç" notu): tuvalin üst ortasında,
 * opak yüzey + gölge 2, solda durum ikonu (renk yalnız ikonda), metin birincil. Renkli bant yok.
 * Metin sararsa kapsül yuvarlak dikdörtgene döner. Rol: kalıcı uyarıda `role="alert"`'i çağıran verir.
 */
export function FloatingNotice({
  tone = 'warn',
  children,
  action,
  className,
  role,
}: {
  tone?: Tone
  children: ReactNode
  action?: ReactNode
  className?: string
  role?: 'alert' | 'status'
}) {
  const Icon = icons[tone]
  return (
    <div
      role={role}
      className={cn(
        'inline-flex max-w-[min(92vw,560px)] items-center gap-2 rounded-[18px] bg-elevated py-2 pr-2 pl-3 text-body text-fg shadow-2',
        !action && 'pr-4',
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', iconColor[tone])} />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}

/**
 * Satır içi not (grup altı notu dışında kalan uyarı/bilgi satırı): solda 16px durum ikonu, metin birincil.
 * Gri kutu ya da renkli bant değil.
 */
export function InlineNotice({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = icons[tone]
  return (
    <p className={cn('flex items-start gap-2 text-body text-fg', className)}>
      <Icon aria-hidden className={cn('mt-px size-4 shrink-0', iconColor[tone])} />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
