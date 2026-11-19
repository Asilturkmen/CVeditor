import { ChevronRight } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Açılır panel gövdesi: yükseklik 200ms'de açılır (azaltılmış harekette anında). İlk açılışa kadar
 * içerik kurulmaz; açıldıktan sonra kapalıyken de kurulu kalır ama `inert` (odak almaz, okunmaz).
 */
function Panel({ open, id, children, labelledBy }: { open: boolean; id: string; children: ReactNode; labelledBy: string }) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      inert={!open}
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">{mounted && children}</div>
    </div>
  )
}

/**
 * Anahat satırı (inspector kaydı, "Kişisel bilgiler", özet): kapalıyken tek satır (44px) — tutamak,
 * açma oku, ad, soluk ek bilgi (kurum · tarih), sağda ikon düğmeleri. Açılınca aynı grubun içinde,
 * kendi satırının altında genişler (ayrı kart açılmaz); açık kaydın adı 600. Satırın boş yeri de açar.
 * Gizli kayıt: `hidden` (ad üçüncül renk + üstü çizili; opaklıkla soldurma yok).
 */
export function OutlineRow({
  title,
  meta,
  open,
  onOpenChange,
  leading,
  actions,
  hidden,
  children,
  className,
  id,
  headingLevel,
}: {
  title: ReactNode
  /** Adın altında soluk bilgi (kurum, tarih). Sarar, kesilmez. */
  meta?: ReactNode
  /** Açma düğmesini başlık öğesine sar (WAI-ARIA akordeon deseni; ör. "Kişisel bilgiler" = h2). */
  headingLevel?: 2 | 3 | 4
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Solda sürükleme tutamağı (`DragHandle`). */
  leading?: ReactNode
  /** Sağda 28px ikon düğmeleri (göster/gizle, ⋯). */
  actions?: ReactNode
  hidden?: boolean
  children: ReactNode
  className?: string
  id?: string
}) {
  const panelId = useId()
  const buttonId = useId()
  const button = (
    <button
      type="button"
      id={buttonId}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => onOpenChange(!open)}
      className={cn(
        'flex min-w-0 flex-1 items-start gap-1.5 self-stretch rounded-sm px-1 text-left outline-offset-[-3px]',
        meta ? 'py-2.5' : 'py-3',
      )}
    >
      <ChevronRight
        aria-hidden
        className={cn(
          'mt-px size-4 shrink-0 text-fg-2 transition-transform duration-200 ease-out',
          open && 'rotate-90',
        )}
      />
      {/* Tek kural: ad üstte, ek bilgi (kurum, madde sayısı) her zaman altta; satır yüksekliği tutarlı. */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-body break-words',
            open ? 'font-semibold' : 'font-normal',
            hidden ? 'text-fg-3 line-through' : 'text-fg',
          )}
        >
          {title}
        </span>
        {meta && <span className="text-body break-words text-fg-2">{meta}</span>}
      </span>
    </button>
  )
  const Heading = headingLevel ? (`h${headingLevel}` as const) : null
  return (
    <div id={id} className={cn('min-w-0', className)}>
      <div className={cn('flex min-h-11 items-center gap-1', leading ? 'pl-1' : 'pl-[calc(var(--row-px)-4px)]', 'pr-2')}>
        {leading}
        {Heading ? <Heading className="flex min-w-0 flex-1 self-stretch">{button}</Heading> : button}
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      <Panel open={open} id={panelId} labelledBy={buttonId}>
        <div className="pb-3">{children}</div>
      </Panel>
    </div>
  )
}

/**
 * Bağımsız açılır satır ("▸ Geçen 24 kontrol", "Ham veriyi göster"): grup dışında, düz satır.
 * Başlık body birincil; ok döner. Kontrolsüz kullanım için `defaultOpen`.
 */
export function Disclosure({
  summary,
  children,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  className?: string
}) {
  const [inner, setInner] = useState(defaultOpen)
  const open = openProp ?? inner
  const set = (next: boolean) => {
    setInner(next)
    onOpenChange?.(next)
  }
  const panelId = useId()
  const buttonId = useId()
  return (
    <div className={className}>
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => set(!open)}
        className="press press-wide -ml-1 flex min-h-8 items-center gap-1.5 rounded-sm px-1 text-body text-fg hover:bg-fill-4"
      >
        <ChevronRight
          aria-hidden
          className={cn('size-4 shrink-0 text-fg-2 transition-transform duration-200 ease-out', open && 'rotate-90')}
        />
        {summary}
      </button>
      <Panel open={open} id={panelId} labelledBy={buttonId}>
        <div className="pt-2">{children}</div>
      </Panel>
    </div>
  )
}
