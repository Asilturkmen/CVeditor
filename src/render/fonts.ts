import type { FontId } from '@/cv/schema'
import { FONT_FACE_CSS } from './fontFaces.generated'

export interface FontDef {
  id: FontId
  label: string
  /** CSS font-family değeri; yedekler PDF'e gömülmez, yalnız yükleme sırasında */
  stack: string
  kind: 'sans' | 'serif'
}

export const FONTS: Record<FontId, FontDef> = {
  inter: { id: 'inter', label: 'Inter', stack: "'CV Inter', Arial, sans-serif", kind: 'sans' },
  'ibm-plex-sans': {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    stack: "'CV IBM Plex Sans', Arial, sans-serif",
    kind: 'sans',
  },
  'source-sans-3': {
    id: 'source-sans-3',
    label: 'Source Sans 3',
    stack: "'CV Source Sans 3', Arial, sans-serif",
    kind: 'sans',
  },
  'source-serif-4': {
    id: 'source-serif-4',
    label: 'Source Serif 4',
    stack: "'CV Source Serif 4', Georgia, serif",
    kind: 'serif',
  },
  literata: { id: 'literata', label: 'Literata', stack: "'CV Literata', Georgia, serif", kind: 'serif' },
}

/** Yazı tiplerinin sunulduğu adres; V2'de sunucu kendi adresini verir. */
export function fontFaceCss(base = '/fonts/'): string {
  return FONT_FACE_CSS.replaceAll('__FONT_BASE__', base)
}
