import { cn } from '@/lib/cn'

/** Döner halka (yükleniyor). Varsayılan 14px; rengi yazı renginden. Bilgi taşımaz: yanında metin ya da `aria-busy` olur. */
export function Spinner({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={cn('shrink-0 animate-spin', className)}
      fill="none"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.75" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
