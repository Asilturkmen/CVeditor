import {
  closestCenter,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useState } from 'react'

/**
 * Kaydırılan panelde klavyeyle sıralama.
 *
 * dnd-kit'in hazır `sortableKeyboardCoordinates`'i hedefi geometriyle seçer ve
 * KeyboardSensor, yeni konum kaydırma kabının ortasını aşınca öğeyi taşımak yerine
 * kabı kaydırıp çıkar. Sağ panelde bu, ilk ok tuşunun yalnız paneli kaydırması
 * demekti. Burada:
 *  - hedef her zaman sıradaki komşu (dizin ±1), yüksekliği ne olursa olsun;
 *  - panel önce bizim tarafımızdan anında kaydırılır, öyle ki sensörün kendi
 *    kaydırma dalı devreye girmez ve her ok tuşu öğeyi gerçekten taşır;
 *  - klavyeyle sürüklerken çarpışma, seçilen hedefi döndürür (yükseklikleri farklı
 *    bölümlerde merkez uzaklığı yanlış komşuyu seçebiliyordu).
 */

type SortableData = { sortable?: { index: number; items: UniqueIdentifier[] } }

const MARGIN = 12

function scrollRect(el: Element) {
  if (el === document.scrollingElement) return { top: 0, bottom: window.innerHeight, height: window.innerHeight }
  const r = el.getBoundingClientRect()
  return { top: r.top, bottom: r.bottom, height: r.height }
}

/**
 * Kabı, öğenin yeni üst kenarı (`top`) KeyboardSensor'ün kendi kaydırmasını
 * tetiklemeyeceği banda düşecek kadar kaydırır: aşağı giderken üst yarı, yukarı
 * giderken alt yarı (kab en uçtaysa sensör zaten kaydırmaz).
 */
function settleScroll(el: Element, down: boolean, top: () => number, height: number) {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return
  const r = scrollRect(el)
  const center = r.top + r.height / 2
  const y = top()
  let wanted: number
  if (down) {
    // Üst yarı; mümkünse öğenin tamamı görünsün.
    wanted = Math.max(r.top + MARGIN, Math.min(center - 2, r.bottom - height - MARGIN))
    if (y >= r.top && y <= center - 1 && y + height <= r.bottom) return
  } else {
    wanted = center + 2
    if (y >= center + 1 && y <= r.bottom) return
  }
  const next = Math.min(max, Math.max(0, el.scrollTop + (y - wanted)))
  // Uca dayandıysa tam uca yasla: sensör `isTop/isBottom` görünce kaydırmaz.
  el.scrollTop = next >= max - 1 ? max + 1 : next <= 1 ? 0 : next
}

function createSortKeyboard() {
  const target = { current: null as UniqueIdentifier | null }

  const coordinateGetter: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
    const down = event.code === KeyboardCode.Down
    const up = event.code === KeyboardCode.Up
    if (event.code === KeyboardCode.Left || event.code === KeyboardCode.Right) {
      event.preventDefault()
      return undefined
    }
    if (!down && !up) return undefined
    event.preventDefault()

    const { active, over, collisionRect, droppableRects, scrollableAncestors } = context
    const sortable = (active?.data.current as SortableData | undefined)?.sortable
    if (!active || !collisionRect || !sortable) return undefined

    const items = sortable.items
    const activeIndex = items.indexOf(active.id)
    const currentIndex = items.indexOf(target.current ?? over?.id ?? active.id)
    const nextIndex = (currentIndex < 0 ? activeIndex : currentIndex) + (down ? 1 : -1)
    if (nextIndex < 0 || nextIndex >= items.length) return undefined

    const id = items[nextIndex]
    const rect = droppableRects.get(id)
    if (!rect) return undefined

    // Öğenin ineceği yuva: hedefin altına inerken alt kenarlar, üstüne çıkarken
    // üst kenarlar hizalanır (verticalListSortingStrategy'nin açtığı boşluk).
    // `rect` canlıdır: kaydırınca konumu kendiliğinden güncellenir.
    const slotTop = () => {
      if (nextIndex === activeIndex) return droppableRects.get(active.id)?.top ?? rect.top
      return nextIndex > activeIndex ? rect.top + rect.height - collisionRect.height : rect.top
    }
    for (const el of scrollableAncestors) settleScroll(el, down, slotTop, collisionRect.height)

    target.current = id
    return { x: currentCoordinates.x, y: slotTop() }
  }

  const collisionDetection: CollisionDetection = (args) => {
    // Klavye sürüklemesinde işaretçi koordinatı yoktur; hedefi biz seçtik.
    if (args.pointerCoordinates === null && target.current != null) {
      const id = target.current
      if (args.droppableContainers.some((c) => c.id === id)) return [{ id }]
    }
    return closestCenter(args)
  }

  return { coordinateGetter, collisionDetection, reset: () => (target.current = null) }
}

/** Fare/dokunma ve klavye sensörleri + klavyeye uygun çarpışma. Her DndContext için ayrı. */
export function useSortDnd() {
  const [{ coordinateGetter, collisionDetection, reset }] = useState(createSortKeyboard)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter, scrollBehavior: 'auto' }),
  )
  return { sensors, collisionDetection, reset }
}
