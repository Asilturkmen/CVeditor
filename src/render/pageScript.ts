import { drawDocument } from './drawDocument'
import { paginate } from './paginate'

/** Enjekte edilen betiğin sayfada tanımladığı fonksiyonun adı: `window.__cvDraw(input)`. */
export const PAGE_DRAW_GLOBAL = '__cvDraw'

/**
 * Sunucu için: `drawDocument` ile `paginate`'i bir tarayıcı sayfasına taşıyan betik. Sayfada
 * `window.__cvDraw(input: DrawInput): Promise<DrawResult>` tanımlar; önizlemenin (CvFrame)
 * çağırdığı fonksiyonların aynısıdır, ayrı bir kopya ya da derleme adımı yoktur.
 *
 *   await page.setContent(documentShell({ lang, fontBase }))
 *   await page.addScriptTag({ content: pageDrawScript() })
 *   const result = await page.evaluate((input) => window.__cvDraw(input), input)
 *
 * İki fonksiyon `toString()` ile alınır; ikisi de kendi başına çalışır (modül düzeyine başvurmaz).
 * Sunucu paketi derlenirken hedef ES2020+ olmalı ve `keepNames` gibi fonksiyon gövdesine yardımcı
 * çağrı ekleyen seçenekler kapalı kalmalı (küçültme sorun değil).
 */
export function pageDrawScript(): string {
  return `window.${PAGE_DRAW_GLOBAL}=(function(){var paginate=${paginate.toString()};var draw=${drawDocument.toString()};return function(input){return draw(document,input,{paginate:paginate})}})();`
}
