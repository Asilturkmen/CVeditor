import { isItemEmpty } from '@/cv/factory'
import type { AnyItem, Cv, Section } from '@/cv/schema'

/** Çizilecek bölümler: gizli olmayan ve en az bir dolu, görünür kaydı olanlar. */
export function visibleSections(cv: Cv): Section[] {
  return cv.sections.filter(
    (s) => !s.hidden && (s.items as AnyItem[]).some((i) => !i.hidden && !isItemEmpty(i)),
  )
}
