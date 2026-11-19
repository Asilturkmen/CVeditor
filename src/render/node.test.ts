// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error jsdom tür bildirimi taşımıyor (@types/jsdom kurulu değil)
import { JSDOM } from 'jsdom'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv } from '@/cv/schema'
import { fontLoadQueries } from './fonts'
import { pageDrawScript } from './pageScript'
import { cvFonts, cvStyles, documentShell, renderCvSource } from './renderCv'
import { configureSanitizer, sanitizeDiffHtml, sanitizeRichText, type SanitizerWindow } from './richtext'
import { getTemplate, templateSettingsFor } from './templates'

/**
 * Sunucu (/api/pdf) çizim paketini düz Node'da kullanır: `window` ve `document` yoktur. Bu dosya
 * paketin orada içe aktarılabildiğini ve zengin metnin jsdom penceresiyle süzüldüğünü gösterir.
 */

function sampleCv(): Cv {
  const sections = sampleSections('tr')
  return createCv({ name: 'Örnek', language: 'tr', templateId: 'bant', template: templateSettingsFor('bant', sections), personal: samplePersonal('tr'), sections })
}

const jsdomWindow = () => new JSDOM('').window as SanitizerWindow

afterEach(() => configureSanitizer(null))

describe('çizim paketi düz Node ortamında', () => {
  it('ortamda tarayıcı nesnesi yok (modüller üst düzeyde window/document kullanmadan yüklendi)', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })

  it('zengin metin içermeyen CV pencere olmadan çizilir', () => {
    const cv = createCv({ name: 'Boş', language: 'tr', templateId: 'zarif', template: templateSettingsFor('zarif', []), personal: samplePersonal('tr'), sections: [] })
    expect(renderCvSource(cv)).toContain('Deniz Aksoy')
  })

  it('zengin metinde pencere verilmemişse ne yapılacağını söyleyen hata', () => {
    expect(() => sanitizeRichText('<p>metin</p>')).toThrow('configureSanitizer')
    expect(() => renderCvSource(sampleCv())).toThrow('configureSanitizer')
  })

  it('jsdom penceresi verilince zengin metinli CV çizilir ve süzülür', () => {
    configureSanitizer(jsdomWindow())
    const cv = sampleCv()
    const experience = cv.sections.find((s) => s.type === 'experience')!
    experience.items[0].description =
      '<ul data-block=""><li>Madde <strong onclick="x()">kalın</strong> <a href="site.com/yol">bağlantı</a></li></ul><script>alert(1)</script><div>çıplak</div>satır<img src="https://ornek.com/x.png">'
    const html = renderCvSource(cv)
    expect(html).toContain('<div class="entry-body rich"><ul><li>Madde <strong>kalın</strong> <a href="https://site.com/yol">bağlantı</a></li></ul><p>çıplak</p><p>satır</p></div>')
    expect(html).not.toMatch(/<script|onclick|<img|alert\(1\)/)
    // Örnek CV'nin öbür zengin metinleri de çizildi.
    expect(html.match(/class="entry-body rich"/g)!.length).toBeGreaterThan(3)
    expect(html).toContain('Deneyim')
  })

  it('öneri farkı süzgeci de aynı pencereyle çalışır', () => {
    configureSanitizer(jsdomWindow())
    expect(sanitizeDiffHtml('<p>a <ins class="sg-ins x" data-a="1">b</ins><script>1</script></p>')).toBe('<p>a <ins class="sg-ins">b</ins></p>')
  })

  it('pencere değiştirilebilir ve geri alınabilir', () => {
    configureSanitizer(jsdomWindow())
    expect(sanitizeRichText('düz')).toBe('<p>düz</p>')
    configureSanitizer(null)
    expect(() => sanitizeRichText('düz')).toThrow('configureSanitizer')
  })

  it('sunucunun sayfaya göndereceği her parça Node\'da üretilir (stil, iskelet, yazı tipi sorguları, çizim betiği)', () => {
    configureSanitizer(jsdomWindow())
    const cv = sampleCv()
    // (Vitest CSS içe aktarmalarını boşaltır: burada yalnız CV değişkenleri görünür; taban ve
    // şablon CSS'i gerçek tarayıcıda e2e ile denetlenir.)
    const styles = cvStyles(cv)
    expect(styles).toContain(':root{--paper:')
    expect(styles).toContain('--accent:')
    const shell = documentShell({ lang: cv.language, fontBase: 'http://127.0.0.1:8787/fonts/' })
    expect(shell).toContain('<html lang="tr">')
    expect(shell).toContain('http://127.0.0.1:8787/fonts/')
    expect(shell).toContain('<div id="cv-source"></div><div id="cv-pages"></div>')
    const queries = Object.values(cvFonts(getTemplate(cv.templateId), cv.template)).flatMap(fontLoadQueries)
    expect(queries.length).toBeGreaterThan(0)
    expect(queries[0]).toMatch(/^\d{3}.* 12px 'CV /)
    expect(pageDrawScript()).toContain('window.__cvDraw=')
    // Girdi sayfaya JSON olarak gider.
    const input = { lang: cv.language, styles, html: renderCvSource(cv), fontQueries: queries }
    expect(JSON.parse(JSON.stringify(input))).toEqual(input)
  })
})
