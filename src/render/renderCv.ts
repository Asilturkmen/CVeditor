import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Cv, TemplateSettings } from '@/cv/schema'
import { CvSource, type SuggestionMap } from './CvMarkup'
import { colorVariables } from './colors'
import { escapeHtml } from './diff'
import { FONTS, fontDef, fontFaceCss, type FontDef } from './fonts'
import baseCss from './styles/base.css?raw'
import { activeColorSet, getTemplate, resolvedBaseColor, type TemplateDef } from './templates'

export interface RenderOptions {
  suggestions?: SuggestionMap
  /** Boş ad yerine soluk yer tutucu, fotoğraf yerinde "Fotoğraf ekle" kutusu (yalnız önizleme; baskıda gizli) */
  placeholders?: boolean
  emptyHint?: string
  /** Fotoğraf yer tutucusunun yazısı (placeholders ile) */
  photoHint?: string
}

export function renderCvSource(cv: Cv, options: RenderOptions = {}): string {
  return renderToStaticMarkup(
    createElement(CvSource, {
      cv,
      suggestions: options.suggestions,
      placeholders: options.placeholders,
      emptyHint: options.emptyHint,
      photoHint: options.photoHint,
    }),
  )
}

const FONT_SIZES: Record<TemplateSettings['fontSize'], string> = { sm: '9.25pt', md: '9.75pt', lg: '10.5pt' }

const SPACING: Record<TemplateSettings['spacing'], Record<string, string>> = {
  compact: { '--block-gap': '2.2mm', '--section-gap': '4.2mm', '--pad-x': '14mm', '--pad-y': '12mm', '--lh': '1.32' },
  normal: { '--block-gap': '3mm', '--section-gap': '5.6mm', '--pad-x': '16mm', '--pad-y': '14mm', '--lh': '1.4' },
  relaxed: { '--block-gap': '4mm', '--section-gap': '7mm', '--pad-x': '18mm', '--pad-y': '16mm', '--lh': '1.48' },
}

/** Şablonun ve CV'nin yazı tipleri: gövde (Görünüm'deki seçim), başlık ve eş aralıklı aile. */
export function cvFonts(template: TemplateDef, settings: Pick<TemplateSettings, 'font'>): { body: FontDef; display: FontDef; mono: FontDef } {
  const body = FONTS[settings.font] ?? FONTS.inter
  return {
    body,
    display: fontDef(template.fonts.display),
    mono: template.fonts.mono ? fontDef(template.fonts.mono) : body,
  }
}

/**
 * CV'ye özgü değişkenler: şablon CSS'leri yalnız bunları okur (sözleşme: base.css başı).
 * Renkler colors.ts'te türetilir; ayarlar şablonun hazır bir takımıyla aynıysa o takımın
 * elle seçilmiş tonları (ColorSet.vars) türetilenlerin yerine geçer.
 */
export function cvVariables(settings: TemplateSettings, template: TemplateDef = getTemplate('')): string {
  const fonts = cvFonts(template, settings)
  const vars: Record<string, string> = {
    ...colorVariables({
      accent: settings.accentColor,
      base: resolvedBaseColor(template, settings),
      paper: template.paper,
      ink: template.ink,
      muted: template.muted,
      rule: template.rule,
    }),
    ...activeColorSet(template, settings)?.vars,
    '--font': fonts.body.stack,
    '--font-display': fonts.display.stack,
    '--font-mono': fonts.mono.stack,
    '--fs': FONT_SIZES[settings.fontSize],
    ...SPACING[settings.spacing],
  }
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`
}

/** Bir CV'yi çizmek için gereken bütün CSS (yazı tipleri hariç). */
export function cvStyles(cv: Cv): string {
  const template = getTemplate(cv.templateId)
  return `${baseCss}\n${template.css}\n${cvVariables(cv.template, template)}`
}

/**
 * Önizleme iframe'inin ve yazdırılan belgenin iskeleti. İçerik sonradan
 * #cv-source'a yazılır ve paginate() ile #cv-pages'e dağıtılır.
 */
export function documentShell(options: { lang: string; fontBase?: string; title?: string }): string {
  return `<!doctype html><html lang="${escapeHtml(options.lang)}"><head><meta charset="utf-8"><title>${escapeHtml(options.title ?? 'CV')}</title><style id="cv-fonts">${fontFaceCss(options.fontBase)}</style><style id="cv-styles"></style><style id="cv-host"></style></head><body><div id="cv-source"></div><div id="cv-pages"></div></body></html>`
}
