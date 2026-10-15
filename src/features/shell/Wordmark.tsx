import { cn } from '@/lib/cn'

/** Logo yerine yazı: ad kesinleşince logo gelecek. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline text-[17px] font-semibold tracking-[-0.02em] text-text', className)}>
      CV<span className="text-accent">editör</span>
    </span>
  )
}
