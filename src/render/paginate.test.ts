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

/**
 * Düzen taklidi: sütun 0'dan COL_H'ye; sütundaki bloklar alt alta dizilir (aralık yok). Bir öğenin
 * yüksekliği `data-h`'si, yoksa (ya da bölünmüş parçaysa) çocuklarının toplamı.
 */
const COL_H = 1000

function mockFlow() {
  const height = (el: Element): number =>
    el.hasAttribute('data-h') && !el.classList.contains('is-split')
      ? Number(el.getAttribute('data-h'))
      : Array.from(el.children).reduce((sum, c) => sum + height(c), 0)
  const box = (el: Element): DOMRect => {
    if (el.classList.contains('page')) return rect(0, 0, PAGE.width, PAGE.height)
    if (el.classList.contains('col')) return rect(0, 0, 300, COL_H)
    const parent = el.parentElement
    if (!parent) return rect(0, 0, 300, height(el))
    let top = box(parent).top
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) top += height(s)
    return rect(0, top, 300, height(el))
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return box(this)
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(COL_H)
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ paddingTop: '0px', paddingBottom: '0px' } as CSSStyleDeclaration)
}

const heading = (sec: string, h = 30) =>
  `<h2 class="section-title" data-block="" data-keep-with-next="" data-section-id="${sec}" data-h="${h}"><span>${sec}</span></h2>`
const line = (sec: string, id: string, h = 20) =>
  `<div class="entry entry-skills" data-block="" data-section-id="${sec}" data-item-id="${id}" data-h="${h}"><div class="entry-line">${id}</div></div>`
const filler = (id: string, h: number) =>
  `<div class="entry entry-experience" data-block="" data-section-id="deneyim" data-item-id="${id}" data-h="${h}"><div class="entry-head">${id}</div></div>`
const lines = (sec: string, ids: string[], h = 20) => heading(sec) + ids.map((id) => line(sec, id, h)).join('')
/** Bir sayfadan uzun kayıt: başlık + `bullets` madde (her biri `h` px). */
const long = (id: string, bullets: number, h = 100) =>
  `<div class="entry entry-experience" data-block="" data-section-id="deneyim" data-item-id="${id}"><div class="entry-head" data-h="30">${id}</div><div class="entry-body rich"><ul>${Array.from(
    { length: bullets },
    (_, i) => `<li data-h="${h}">${id}-${i + 1}</li>`,
  ).join('')}</ul></div></div>`

/** Her sayfanın ana sütunu: bölüm başlığı "#<bölüm>", kayıt kimliği, bölünmüş parçada maddeler. */
function layout(source: string) {
  mockFlow()
  const doc = shell(`<div data-flow="main">${source}</div>`)
  const result = paginate(doc)
  const pages = Array.from(doc.querySelectorAll('#cv-pages > .page')).map((page) =>
    Array.from(page.querySelectorAll('.col-main > *')).flatMap((el) =>
      el.hasAttribute('data-keep-with-next')
        ? [`#${el.getAttribute('data-section-id')}`]
        : el.classList.contains('is-split')
          ? [`${el.getAttribute('data-item-id')}[${el.querySelectorAll('li').length}]`]
          : [el.getAttribute('data-item-id')!],
    ),
  )
  return { result, pages }
}

describe('sayfalama: satır dizilerinde yetim ve dul (SET-14 §5.5)', () => {
  it('dibe tek satır düşecekse başlık ve satır sonraki sayfaya geçer (yetim)', () => {
    const { pages } = layout(filler('f', 940) + lines('beceri', ['a', 'b', 'c']))
    expect(pages).toEqual([['f'], ['#beceri', 'a', 'b', 'c']])
  })

  it('son satır tek başına sonraki sayfaya düşmez; önceki sayfada 2 satır kalır (dul)', () => {
    const { pages } = layout(filler('f', 900) + lines('beceri', ['a', 'b', 'c', 'd']))
    expect(pages).toEqual([['f', '#beceri', 'a', 'b'], ['c', 'd']])
  })

  it('iki satırlık bölüm (Diller: Türkçe, İngilizce) bölünmez, başlığıyla taşınır', () => {
    const { pages } = layout(filler('f', 940) + lines('diller', ['tr', 'en']))
    expect(pages).toEqual([['f'], ['#diller', 'tr', 'en']])
  })

  it('üç satırlık bölüm 2+1 bölünmez (Araçlar satırı başlıksız sayfada kalmaz)', () => {
    const { pages } = layout(filler('f', 920) + lines('beceri', ['diller', 'catilar', 'araclar']))
    expect(pages).toEqual([['f'], ['#beceri', 'diller', 'catilar', 'araclar']])
  })

  it('her iki sayfada 2+ satır kalıyorsa dokunulmaz', () => {
    const { pages } = layout(filler('f', 900) + lines('beceri', ['a', 'b', 'c', 'd', 'e', 'f2', 'g']))
    expect(pages).toEqual([['f', '#beceri', 'a', 'b', 'c'], ['d', 'e', 'f2', 'g']])
  })

  it('sonraki bölüm ayrı dizidir: bölümler arası sayfa sonu kural dışı', () => {
    const { pages } = layout(filler('f', 870) + lines('beceri', ['a', 'b']) + lines('diller', ['tr', 'en']))
    // beceri: 870+30+40 = 940; diller başlığı + tr = 990 sığar, en sığmaz → tr yetim, başlığıyla taşınır.
    expect(pages).toEqual([['f', '#beceri', 'a', 'b'], ['#diller', 'tr', 'en']])
  })

  it('önceki sayfada başka içerik kalmayacaksa taşınmaz (boş sayfa yok)', () => {
    const { pages, result } = layout(heading('beceri') + line('beceri', 'a', 960) + line('beceri', 'b'))
    expect(pages).toEqual([['#beceri', 'a'], ['b']])
    expect(result.pageCount).toBe(2)
  })

  it('satır olmayan kayıtlar (deneyim) bu kurala girmez', () => {
    const { pages } = layout(filler('f', 900) + heading('deneyim') + filler('e1', 40) + filler('e2', 40))
    expect(pages).toEqual([['f', '#deneyim', 'e1'], ['e2']])
  })

  it('tek sütunda iki sayfalık uzun dizi: hiçbir sayfada tek satır yok, satır kaybolmaz', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `s${i}`)
    const { pages } = layout(filler('f', 450) + lines('beceri', ids))
    expect(pages.flat().filter((x) => x.startsWith('s'))).toEqual(ids)
    for (const page of pages) {
      const count = page.filter((x) => x.startsWith('s')).length
      expect(count === 0 || count >= 2).toBe(true)
    }
    expect(pages.every((p) => p.length > 0)).toBe(true)
  })
})

describe('sayfalama: bölünen kayıtta yetim ve dul madde (SET-14 §5.5)', () => {
  it('son madde sonraki sayfada tek kalmaz', () => {
    // 60 + 30 + 9×100 = 990: 9 madde sığar, 10. madde tek kalırdı → 8 + 2.
    const { pages, result } = layout(filler('f', 60) + long('x', 10))
    expect(pages).toEqual([['f', 'x[8]'], ['x[2]']])
    expect(result.oversized).toEqual([{ sectionId: 'deneyim', itemId: 'x' }])
  })

  it('ilk parçada tek madde kalacaksa kayıt sonraki sayfadan başlar', () => {
    const { pages } = layout(filler('f', 800) + long('x', 12))
    expect(pages).toEqual([['f'], ['x[9]'], ['x[3]']])
  })

  it('taze sayfada bile sığmayan maddeler: döngü yok, her madde bir kez', () => {
    // Başlık taze ilk sayfada kalır (orada da sığmayacaktı); maddeler birer sayfada.
    const { pages, result } = layout(long('x', 2, 980))
    expect(pages).toEqual([['x[0]'], ['x[1]'], ['x[1]']])
    expect(result.pageCount).toBe(3)
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
