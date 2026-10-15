import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Cv, TemplateSettings } from '@/cv/schema'
import { CvSource, type SuggestionMap } from './CvMarkup'
import { escapeHtml } from './diff'
import { FONTS, fontFaceCss } from './fonts'
import baseCss from './styles/base.css?raw'
import { getTemplate } from './templates'

export interface RenderOptions {
  suggestions?: SuggestionMap
  /** Boş ad yerine soluk yer tutucu (yalnız önizleme; baskıda gizli) */
  placeholders?: boolean
  emptyHint?: string
}

export function renderCvSource(cv: Cv, options: RenderOptions = {}): string {
  return renderToStaticMarkup(
    createElement(CvSource, {
      cv,
      suggestions: options.suggestions,
      placeholders: options.placeholders,
      emptyHint: options.emptyHint,
    }),
  )
}

const FONT_SIZES: Record<TemplateSettings['fontSize'], string> = { sm: '9.25pt', md: '9.75pt', lg: '10.5pt' }

const SPACING: Record<TemplateSettings['spacing'], Record<string, string>> = {
  compact: { '--block-gap': '2.2mm', '--section-gap': '4.2mm', '--pad-x': '14mm', '--pad-y': '12mm', '--lh': '1.32' },
  normal: { '--block-gap': '3mm', '--section-gap': '5.6mm', '--pad-x': '16mm', '--pad-y': '14mm', '--lh': '1.4' },
  relaxed: { '--block-gap': '4mm', '--section-gap': '7mm', '--pad-x': '18mm', '--pad-y': '16mm', '--lh': '1.48' },
}

/** CV'ye özgü değişkenler: şablon CSS'leri yalnız bunları okur. */
export function cvVariables(settings: TemplateSettings): string {
  const vars: Record<string, string> = {
    '--accent': settings.accentColor,
    '--accent-ink': `color-mix(in srgb, ${settings.accentColor} 82%, #000)`,
    '--ink': '#1c1c1e',
    '--muted': '#5a5a60',
    '--rule': '#d6d6db',
    '--paper': '#ffffff',
    '--font': FONTS[settings.font].stack,
    '--fs': FONT_SIZES[settings.fontSize],
    ...SPACING[settings.spacing],
  }
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`
}

/** Bir CV'yi çizmek için gereken bütün CSS (yazı tipleri hariç). */
export function cvStyles(cv: Cv): string {
  return `${baseCss}\n${getTemplate(cv.templateId).css}\n${cvVariables(cv.template)}`
}

/**
 * Önizleme iframe'inin ve yazdırılan belgenin iskeleti. İçerik sonradan
 * #cv-source'a yazılır ve paginate() ile #cv-pages'e dağıtılır.
 */
export function documentShell(options: { lang: string; fontBase?: string; title?: string }): string {
  return `<!doctype html><html lang="${escapeHtml(options.lang)}"><head><meta charset="utf-8"><title>${escapeHtml(options.title ?? 'CV')}</title><style id="cv-fonts">${fontFaceCss(options.fontBase)}</style><style id="cv-styles"></style><style id="cv-host"></style></head><body><div id="cv-source"></div><div id="cv-pages"></div></body></html>`
}
