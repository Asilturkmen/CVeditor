import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge projenin token'larını tanısın: yoksa `text-body` (boyut) ile `text-fg` (renk)
 * aynı grupta sanılır ve biri silinir. Liste src/styles/app.css @theme ile aynı.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['title-lg', 'title-1', 'title-2', 'title-3', 'headline', 'body', 'body-user', 'callout', 'caption'],
      shadow: ['1', '2', '3', '4', 'page', 'thumb'],
      ease: ['sheet', 'spring-smooth', 'spring-snappy', 'spring-bouncy', 'out-soft', 'spring'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
