import { DragOverlay, useDndContext, type DropAnimation, type UniqueIdentifier } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Sürüklenen satırın kopyası `document.body`'de çizilir: grup `overflow-hidden` olduğundan satırın
 * kendisi grubun dışına taşınca kırpılıyordu. Kaynak satır yerinde boş yuva olarak kalır (odak ve
 * klavyeyle sıralama onda sürer; ekran okuyucu duyuruları DndContext'ten gelir, değişmez).
 * Bırakınca kopya yuvaya 280ms `spring-snappy` ile oturur; azaltılmış harekette anında.
 */
function dropAnimation(): DropAnimation | null {
  if (prefersReducedMotion()) return null
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--spring-snappy').trim() || 'ease-out'
  return { duration: 280, easing }
}

export function SortOverlay({ render }: { render: (id: UniqueIdentifier) => ReactNode }) {
  const { active } = useDndContext()
  return createPortal(
    <DragOverlay dropAnimation={dropAnimation()} zIndex={60} style={{ height: 'auto' }}>
      {active ? render(active.id) : null}
    </DragOverlay>,
    document.body,
  )
}

/** Kaynak satırın sürükleme sırasındaki hâli: içeriği görünmez boş yuva (odak üzerinde kalır). */
export const DRAG_SOURCE_CLASS = 'bg-fill-4 [&>*]:opacity-0'

/**
 * Sürüklenen satırın görünümü: ⠿ + ad (+ soluk ek bilgi, sağda tarih). `bg-elevated`, yarıçap 10,
 * `shadow-3`, `scale(1.02)` (DESIGN §5 Sürükleme). Satır kopyası etkileşimsizdir, ekran okuyucudan gizli.
 */
export function DragGhost({ title, meta, trailing, className }: { title: ReactNode; meta?: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      data-drag-ghost
      className={cn(
        'flex min-h-11 scale-[1.02] cursor-grabbing items-center gap-1.5 rounded-lg bg-elevated py-2.5 pr-3 pl-2 shadow-3',
        className,
      )}
    >
      <GripVertical className="size-4 shrink-0 text-fg-3" />
      <span className="flex min-w-0 flex-1 flex-col pl-1">
        <span className="text-body font-semibold break-words text-fg">{title}</span>
        {meta && <span className="text-body break-words text-fg-2">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0 text-callout whitespace-nowrap text-fg-2 tabular-nums">{trailing}</span>}
    </div>
  )
}
