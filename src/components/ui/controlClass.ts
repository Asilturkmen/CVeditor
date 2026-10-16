import { cn } from '@/lib/cn'

/** Metin kutusu, açılır liste ve zengin metin alanının ortak görünümü. */
export const controlClass = cn(
  'w-full rounded-lg border border-line bg-surface text-text placeholder:text-faint',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'hover:border-line-strong',
  'focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent/15',
  'disabled:bg-surface-2 disabled:text-faint',
)
