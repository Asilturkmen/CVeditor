import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Üst düzey gezinme hap sekmeleri (CV'lerim · Şablonlar · İnceleme): her biri 28px kapsül bağlantı.
 * Seçili: gri dolgu + 600; diğerleri zeminsiz 400, hover hafif dolgu. Seçili zemini tek öğedir ve
 * sekmeler arasında yayla kayar. Alt çizgi yok. Bağlantılar `navPillClass` alır ve seçili olana
 * `aria-current="page"` verilir (router `Link` bunu kendisi yapar). Aynı nesnenin yüzleri için `Segmented`.
 */
export function NavPills({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)
  const [animate, setAnimate] = useState(false)

  // Her çizimde seçili bağlantıyı ölç (rota değişince aria-current yer değiştirir).
  useLayoutEffect(() => {
    const nav = ref.current
    if (!nav) return
    const measure = () => {
      const current = nav.querySelector<HTMLElement>('[aria-current="page"]')
      setPill((prev) => {
        if (!current) return null
        const next = { x: current.offsetLeft, width: current.offsetWidth }
        return prev && prev.x === next.x && prev.width === next.width ? prev : next
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    const mutations = new MutationObserver(measure)
    mutations.observe(nav, { attributes: true, subtree: true, attributeFilter: ['aria-current'] })
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])

  // İlk konumlandırmadan sonra kaydırma animasyonu açılır (ilk boyamada kayma olmasın).
  useLayoutEffect(() => {
    if (pill && !animate) requestAnimationFrame(() => setAnimate(true))
  }, [pill, animate])

  return (
    <nav ref={ref} aria-label={ariaLabel} className={cn('relative flex items-center gap-1', className)}>
      {pill && (
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-0 h-7 rounded-full bg-fill-3 phone:h-11',
            animate && 'transition-[transform,width] duration-300 ease-spring-smooth',
          )}
          style={{ width: pill.width, transform: `translateX(${pill.x}px) translateY(-50%)` }}
        />
      )}
      {children}
    </nav>
  )
}

/** Hap sekme bağlantısının sınıfı. */
export const navPillClass =
  'press relative z-10 inline-flex h-7 items-center rounded-full px-3 text-body whitespace-nowrap text-fg font-normal ' +
  'hover:bg-fill-4 aria-[current=page]:font-semibold aria-[current=page]:hover:bg-transparent phone:h-11'
