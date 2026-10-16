import { GripVertical } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'

/** Sıralanabilir listelerin tutamağı (yardımcılar: sortableStyle.ts). */
export function DragHandle({ label, ...props }: HTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        className="flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-faint transition-colors hover:bg-surface-2 hover:text-muted active:cursor-grabbing"
        {...props}
      >
        <GripVertical className="size-4" />
      </button>
    </Tooltip>
  )
}
