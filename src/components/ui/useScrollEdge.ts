import { useEffect, useState, type RefObject } from 'react'

/**
 * Kaydırma kenarı: verilen kap (yoksa pencere) kaydırılmışsa true. Çubuğa `data-scrolled` olarak
 * ver; çizgi yalnız içerik çubuğun altına girince belirir (150ms).
 */
export function useScrollEdge(ref?: RefObject<HTMLElement | null>, edge: 'top' | 'bottom' = 'top') {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref?.current ?? null
    const target: HTMLElement | Window = el ?? window
    const read = () => {
      if (el) {
        setScrolled(edge === 'top' ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)
      } else {
        const doc = document.documentElement
        setScrolled(edge === 'top' ? window.scrollY > 0 : window.scrollY + window.innerHeight < doc.scrollHeight - 1)
      }
    }
    read()
    target.addEventListener('scroll', read, { passive: true })
    const observer = el ? new ResizeObserver(read) : null
    if (el) {
      observer!.observe(el)
      for (const child of Array.from(el.children)) observer!.observe(child)
    }
    return () => {
      target.removeEventListener('scroll', read)
      observer?.disconnect()
    }
  }, [ref, edge])
  return scrolled
}
