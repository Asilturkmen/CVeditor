import { useState } from 'react'

/**
 * Değer bir önceki çizimdekinden farklıysa (ilk çizimde `initial`'dan farklıysa) true döner.
 * Prop değişince durumu sıfırlamanın React'in önerdiği yolu: efektte değil, çizim sırasında
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 *
 *   if (useChanged(open, false) && open) setAgreed(false)
 */
export function useChanged<T>(value: T, initial: T): boolean {
  const [previous, setPrevious] = useState(initial)
  if (Object.is(previous, value)) return false
  setPrevious(value)
  return true
}
