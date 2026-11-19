import { describe, expect, it } from 'vitest'
import { HOST_RESET, shadowCopyOfPages } from './printMirror'
import { documentShell } from './renderCv'

/** `:host{a:b;c:d}` → [['a','b'], ['c','d']] (bildirim sırasıyla) */
function declarations(rule: string): [string, string][] {
  const body = /\{([^}]*)\}/.exec(rule)?.[1] ?? ''
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const at = d.indexOf(':')
      return [d.slice(0, at).trim(), d.slice(at + 1).trim()]
    })
}

describe('baskı aynası / geçiş kopyası: barındıran belgeden stil sızmaz', () => {
  const host = declarations(HOST_RESET)
  const names = host.map(([name]) => name)

  it('kalıtılan her şey önce sıfırlanır (all: initial ilk bildirim)', () => {
    expect(host[0]).toEqual(['all', 'initial'])
    expect(names.indexOf('display')).toBeGreaterThan(0)
  })

  it("uygulamanın yazı tipi ayarları ('ss01', harf aralığı, font-variant, renk şeması) açıkça sıfırlanır", () => {
    const map = new Map(host)
    expect(map.get('font-feature-settings')).toBe('normal')
    expect(map.get('font-variant')).toBe('normal')
    expect(map.get('letter-spacing')).toBe('normal')
    expect(map.get('color-scheme')).toBe('light')
  })

  it('CV belgesinin gövde kuralındaki (base.css `body`) ayarlar aynada da var', () => {
    // Gerçek CSS ile karşılaştırma tarayıcıda yapılır (e2e/preview.spec.ts: hesaplanan stiller
    // iframe ile ayna arasında aynı); burada bildirimlerin yerinde olduğu denetlenir.
    const map = new Map(host)
    expect(map.get('color')).toBe('var(--ink)')
    expect(map.get('font-family')).toBe('var(--font)')
    expect(map.get('font-size')).toBe('var(--fs)')
    expect(map.get('line-height')).toBe('var(--lh)')
    expect(map.get('text-rendering')).toBe('optimizeLegibility')
    expect(map.get('font-kerning')).toBe('normal')
    expect(map.get('font-synthesis')).toBe('none')
    expect(map.get('overflow-wrap')).toBe('break-word')
    expect(map.get('print-color-adjust')).toBe('exact')
  })

  it('gölge kökteki stil: CV CSS\'i (:root → :host) + sıfırlama; sayfalar kopyalanır', () => {
    const doc = new DOMParser().parseFromString(documentShell({ lang: 'tr' }), 'text/html')
    doc.getElementById('cv-styles')!.textContent = ':root{--ink:#111}.page{width:210mm}'
    doc.getElementById('cv-pages')!.innerHTML = '<div class="page"><p>metin</p></div>'
    const el = document.createElement('div')
    expect(shadowCopyOfPages(doc, el, '.ek{gap:0}')).toBe(true)
    const css = el.shadowRoot!.querySelector('style')!.textContent ?? ''
    expect(css).toContain(':host{--ink:#111}')
    expect(css).not.toContain(':root')
    // Sıfırlama CV değişkenlerinden sonra, ek stilden önce gelir.
    expect(css.indexOf(HOST_RESET)).toBeGreaterThan(css.indexOf('--ink:#111'))
    expect(css.indexOf('.ek{gap:0}')).toBeGreaterThan(css.indexOf(HOST_RESET))
    expect(el.shadowRoot!.querySelector('#cv-pages .page p')!.textContent).toBe('metin')
    // `all:initial` barındıranın dilini (yerel ayar) de sıfırlar: kopyanın kökü CV dilini kendisi taşır.
    expect(el.shadowRoot!.querySelector('#cv-pages')!.getAttribute('lang')).toBe('tr')
  })

  it('sayfa yoksa kopya kurulmaz', () => {
    const doc = new DOMParser().parseFromString(documentShell({ lang: 'tr' }), 'text/html')
    expect(shadowCopyOfPages(doc, document.createElement('div'))).toBe(false)
  })
})
