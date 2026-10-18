import type { FontId } from '@/cv/schema'
import { FONT_FACE_CSS, FONT_FACES } from './fontFaces.generated'
import type { DisplayFontKey, FontKey } from './templateMeta'

export interface FontDef {
  id: FontKey
  label: string
  /** CSS font-family değeri; yedekler PDF'e gömülmez, yalnız yükleme sırasında */
  stack: string
  kind: 'sans' | 'serif' | 'mono'
}

const font = (id: FontKey, label: string, kind: FontDef['kind']): FontDef => ({
  id,
  label,
  stack: `'CV ${label}', ${kind === 'serif' ? 'Georgia, serif' : kind === 'mono' ? "'Courier New', monospace" : 'Arial, sans-serif'}`,
  kind,
})

/** Gövde yazı tipleri: Görünüm sekmesinde seçilir (TemplateSettings.font). */
export const FONTS: Record<FontId, FontDef> = {
  inter: font('inter', 'Inter', 'sans'),
  'ibm-plex-sans': font('ibm-plex-sans', 'IBM Plex Sans', 'sans'),
  'source-sans-3': font('source-sans-3', 'Source Sans 3', 'sans'),
  manrope: font('manrope', 'Manrope', 'sans'),
  'space-grotesk': font('space-grotesk', 'Space Grotesk', 'sans'),
  archivo: font('archivo', 'Archivo', 'sans'),
  'source-serif-4': font('source-serif-4', 'Source Serif 4', 'serif'),
  literata: font('literata', 'Literata', 'serif'),
  'eb-garamond': font('eb-garamond', 'EB Garamond', 'serif'),
}

/** Görünüm sekmesindeki sıra: önce düz (sans), sonra tırnaklı (serif). */
export const BODY_FONT_ORDER: FontId[] = [
  'inter',
  'ibm-plex-sans',
  'source-sans-3',
  'manrope',
  'space-grotesk',
  'archivo',
  'source-serif-4',
  'literata',
  'eb-garamond',
]

/** Yalnız şablonların ad ve başlıklarında kullanılan aileler (seçilmez). */
export const DISPLAY_FONTS: Record<DisplayFontKey, FontDef> = {
  poppins: font('poppins', 'Poppins', 'sans'),
  'dm-serif-display': font('dm-serif-display', 'DM Serif Display', 'serif'),
  'playfair-display': font('playfair-display', 'Playfair Display', 'serif'),
  'ibm-plex-mono': font('ibm-plex-mono', 'IBM Plex Mono', 'mono'),
  fraunces: font('fraunces', 'Fraunces', 'serif'),
}

export function fontDef(id: FontKey): FontDef {
  return (FONTS as Record<string, FontDef>)[id] ?? DISPLAY_FONTS[id as DisplayFontKey] ?? FONTS.inter
}

/** Ailenin CSS adı (stack'in ilk öğesi, tırnaklı) */
export const familyOf = (def: FontDef) => def.stack.split(',')[0].trim()

/**
 * `document.fonts.load` için yüz tanımları ("700 12px 'CV Inter'"): ailenin sunulan
 * bütün yüzleri. Ölçümden önce yüklenmezse satır kırılımı sonradan değişir.
 */
export function fontLoadQueries(def: FontDef): string[] {
  const family = familyOf(def)
  const faces = FONT_FACES[family.replace(/'/g, '')] ?? ['400']
  return faces.map((face) => `${face} 12px ${family}`)
}

/** Yazı tiplerinin sunulduğu adres; V2'de sunucu kendi adresini verir. */
export function fontFaceCss(base = '/fonts/'): string {
  return FONT_FACE_CSS.replaceAll('__FONT_BASE__', base)
}
