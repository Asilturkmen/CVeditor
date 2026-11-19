import { cn } from '@/lib/cn'

/** Logo yerine yazı: "CV" + vurgu renginde "editör" (title-2, 17/22/600). Ad kesinleşince logo gelecek. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline text-title-2 whitespace-nowrap text-fg', className)}>
      CV<span className="text-accent">editör</span>
    </span>
  )
}
