import type { Modifier } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { dndText } from './dndA11y'

/** Sıralanabilir listelerin ortak parçaları (İçerik'teki bölüm/kayıt listesi, Görünüm'deki bölüm sırası); tutamak: sortable.tsx. */

export const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function useSortableStyle(id: string) {
  const sortable = useSortable({ id, attributes: { roleDescription: dndText.roleDescription } })
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 20 : undefined,
    position: 'relative' as const,
  }
  return { ...sortable, style }
}
