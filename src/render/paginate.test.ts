import { afterEach, describe, expect, it, vi } from 'vitest'
import { paginate } from './paginate'

/**
 * jsdom düzen (layout) hesaplamaz: bütün kutular 0 ölçülür. Burada ölçüm taklit edilerek sayfalamanın
 * kararları denetlenir; gerçek tarayıcıdaki davranış (base.css'in ölçüm sırasında animasyonu
 * kapatması dahil) e2e/draw.spec.ts'te.
 */

const PAGE = { width: 794, height: 1123 }

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function shell(source: string) {
  const doc = document.implementation.createHTMLDocument('t')
  doc.body.innerHTML = `<div id="cv-source"><div class="cv tpl-zarif cols-1">${source}</div></div><div id="cv-pages"></div>`
  return doc
}

const header = (name: string) =>
  `<div data-flow="header"><header class="cv-header" data-block=""><div class="cv-identity"><h1 class="cv-name"><span class="cv-name-text">${name}</span></h1><ul class="cv-contact"><li>ad@ornek.com</li></ul></div></header></div>`
const MAIN = '<div data-flow="main"><div class="entry" data-block="" data-item-id="a"><div class="entry-body rich"><p>metin</p></div></div></div>'

/** Sayfa kutusu gerçek boyutunda; başka her öğe sayfanın içinde, küçük. */
function mockLayout(overrides: (el: Element) => DOMRect | undefined = () => undefined) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return overrides(this) ?? (this.classList.contains('page') ? rect(0, 0, PAGE.width, PAGE.height) : rect(60, 60, 100, 20))
  })
}

/** jsdom'da Range.getClientRects yok: metin kutusu, metne göre taklit edilir. */
function mockTextRects(rectFor: (text: string) => DOMRect[]) {
  const proto = Range.prototype as unknown as { getClientRects?: () => DOMRect[] }
  proto.getClientRects = function (this: Range) {
    return rectFor(this.startContainer.textContent ?? '')
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (Range.prototype as unknown as { getClientRects?: unknown }).getClientRects
})

describe('sayfalama: başlık taşması raporlanır', () => {
  it('sığan başlıkta uyarı yok', () => {
    mockLayout()
    mockTextRects(() => [rect(60, 60, 300, 40)])
    const result = paginate(shell(header('Deniz Aksoy') + MAIN))
    expect(result).toMatchObject({ pageCount: 1, headerClipped: false, clipped: false, oversized: [] })
  })

  it('adın satırı sayfanın sağından taşıyorsa headerClipped ve clipped', () => {
    mockLayout()
    mockTextRects((text) => (text.includes('Abdurrahmanoğullarından') ? [rect(60, 60, 900, 80)] : [rect(60, 60, 300, 20)]))
    const result = paginate(shell(header('Abdurrahmanoğullarından') + MAIN))
    expect(result.headerClipped).toBe(true)
    expect(result.clipped).toBe(true)
    // Kayıt uyarısı değil: uzun kayıt listesine girmez.
    expect(result.oversized).toEqual([])
  })

  it('ortalı başlıkta soldan taşma da yakalanır; 1,5 px\'e kadar pay var', () => {
    mockLayout()
    mockTextRects(() => [rect(-40, 60, PAGE.width + 80, 80)])
    expect(paginate(shell(header('Uzun Ad') + MAIN)).headerClipped).toBe(true)
    mockTextRects(() => [rect(-1, 60, PAGE.width + 2, 80)])
    expect(paginate(shell(header('Uzun Ad') + MAIN)).headerClipped).toBe(false)
  })

  it('başlık sayfadan uzunsa (alttan taşma) raporlanır', () => {
    mockLayout((el) => (el.classList.contains('cv-header') ? rect(0, 0, PAGE.width, PAGE.height + 200) : undefined))
    mockTextRects(() => [rect(60, 60, 300, 20)])
    expect(paginate(shell(header('Deniz Aksoy') + MAIN))).toMatchObject({ headerClipped: true, clipped: true })
  })

  it('fotoğraf sayfadan taşıyorsa raporlanır', () => {
    mockLayout((el) => (el.tagName === 'IMG' ? rect(PAGE.width - 20, 40, 100, 100) : undefined))
    mockTextRects(() => [rect(60, 60, 300, 20)])
    const source = header('Deniz Aksoy').replace('<div class="cv-identity">', '<img class="cv-photo" alt=""><div class="cv-identity">')
    expect(paginate(shell(source + MAIN)).headerClipped).toBe(true)
  })

  it('kayıtlardaki taşma başlık uyarısı vermez (yalnız başlık ölçülür)', () => {
    mockLayout()
    mockTextRects((text) => (text === 'metin' ? [rect(60, 60, 5000, 20)] : [rect(60, 60, 300, 20)]))
    expect(paginate(shell(header('Deniz Aksoy') + MAIN)).headerClipped).toBe(false)
  })

  it('ölçülemeyen belgede (düzen yok) karar verilmez', () => {
    // Taklit yok: jsdom'un 0 ölçüleri ve eksik Range.getClientRects'i.
    const result = paginate(shell(header('Deniz Aksoy') + MAIN))
    expect(result).toMatchObject({ pageCount: 1, headerClipped: false, clipped: false })
  })
})

describe('sayfalama: ölçüm animasyondan etkilenmez', () => {
  it('bütün ölçümler #cv-pages[data-measuring] altında yapılır; bitince öznitelik kalkar', () => {
    const doc = shell(
      header('Deniz Aksoy') +
        '<div data-flow="main"><h2 class="section-title" data-block="" data-keep-with-next=""></h2><div class="entry sg sg-added" data-block="" data-item-id="yeni"><div class="entry-body rich"><p>öneri</p></div></div></div>',
    )
    const pages = doc.getElementById('cv-pages')!
    const during: boolean[] = []
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      during.push(pages.hasAttribute('data-measuring'))
      return rect(0, 0, 0, 0)
    })
    paginate(doc)
    expect(during.length).toBeGreaterThan(0)
    expect(during.every(Boolean)).toBe(true)
    expect(pages.hasAttribute('data-measuring')).toBe(false)
    expect(pages.querySelector('.sg-added')).not.toBeNull()
  })

  it('sayfalama hata verse de öznitelik kalmaz (animasyonlar kapalı kalmasın)', () => {
    const doc = shell(header('Deniz Aksoy') + MAIN)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => {
      throw new Error('ölçüm hatası')
    })
    expect(() => paginate(doc)).toThrow('ölçüm hatası')
    expect(doc.getElementById('cv-pages')!.hasAttribute('data-measuring')).toBe(false)
  })
})
