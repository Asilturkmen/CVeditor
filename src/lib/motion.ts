/** Kullanıcı "hareketi azalt" dediyse kaydırma animasyonsuz yapılır. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** `scrollIntoView` / `scrollTo` için davranış: `prefers-reduced-motion`'a uyar. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth'
}
