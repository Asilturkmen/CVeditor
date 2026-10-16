import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core'
import { useLayoutEffect, useRef, useState } from 'react'
import { m } from '@/paraglide/messages'

// Ekran okuyucu metinleri arayüz dilinde (messages/*.json, dnd_ önekli).
export const dndText = {
  get roleDescription() {
    return m.dnd_role_description()
  },
  get instructions() {
    return m.dnd_instructions()
  },
  picked: (name: string, pos: number, total: number) => m.dnd_picked({ name, pos, total }),
  over: (name: string, pos: number, total: number) => m.dnd_over({ name, pos, total }),
  outside: (name: string) => m.dnd_outside({ name }),
  dropped: (name: string, pos: number, total: number) => m.dnd_dropped({ name, pos, total }),
  droppedNoChange: (name: string) => m.dnd_dropped_no_change({ name }),
  cancelled: (name: string) => m.dnd_cancelled({ name }),
}

export const dndScreenReaderInstructions: ScreenReaderInstructions = {
  get draggable() {
    return dndText.instructions
  },
}

/** Sıralanabilir listede konum bilgisi (1'den başlar). */
function position(data: { current?: Record<string, unknown> } | undefined) {
  const sortable = data?.current?.sortable as { index: number; items: UniqueIdentifier[] } | undefined
  return sortable ? { pos: sortable.index + 1, total: sortable.items.length } : null
}

/**
 * Ekran okuyucu duyuruları; `nameOf` kimliği okunur ada çevirir (kimlikler UUID).
 * Sürükleme başlarken dnd-kit öğeyi kendi üstünde sayıp hemen `onDragOver` da
 * yollar; o ilk duyuru "Tuttun" iletisini ezmesin diye atlanır.
 */
export function useDndAnnouncements(nameOf: (id: UniqueIdentifier) => string): Announcements {
  const latest = useRef(nameOf)
  useLayoutEffect(() => {
    latest.current = nameOf
  })
  const [announcements] = useState<Announcements>(() => {
    let justStarted = false
    const name = (id: UniqueIdentifier) => latest.current(id)
    return {
      onDragStart: ({ active }) => {
        justStarted = true
        const p = position(active.data)
        return dndText.picked(name(active.id), p?.pos ?? 1, p?.total ?? 1)
      },
      onDragOver: ({ active, over }) => {
        const first = justStarted
        justStarted = false
        if (first && over?.id === active.id) return undefined
        if (!over) return dndText.outside(name(active.id))
        const p = position(over.data)
        return p ? dndText.over(name(active.id), p.pos, p.total) : undefined
      },
      onDragEnd: ({ active, over }) => {
        justStarted = false
        const p = over ? position(over.data) : null
        if (!over || over.id === active.id || !p) return dndText.droppedNoChange(name(active.id))
        return dndText.dropped(name(active.id), p.pos, p.total)
      },
      onDragCancel: ({ active }) => {
        justStarted = false
        return dndText.cancelled(name(active.id))
      },
    }
  })
  return announcements
}
