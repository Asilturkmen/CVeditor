import { describe, expect, it } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv } from '@/cv/schema'
import { diffHtml, diffText } from './diff'
import { renderCvSource } from './renderCv'
import { displayUrl, sanitizeRichText, toHref } from './richtext'
import { templateSettingsFor, type TemplateId } from './templates'

function cvWith(templateId: TemplateId, language: 'tr' | 'en' = 'tr'): Cv {
  const sections = sampleSections(language)
  return createCv({
    name: 'Örnek',
    language,
    templateId,
    template: templateSettingsFor(templateId, sections),
    personal: samplePersonal(language),
    sections,
  })
}

function parse(html: string) {
  const doc = document.implementation.createHTMLDocument('t')
  doc.body.innerHTML = html
  return doc
}

describe('CV kaynağı (çizim)', () => {
  it('bölüm başlıkları CV dilinde gelir', () => {
    expect(renderCvSource(cvWith('zarif', 'tr'))).toContain('Deneyim')
    const en = renderCvSource(cvWith('zarif', 'en'))
    expect(en).toContain('Experience')
    expect(en).not.toContain('Deneyim')
  })

  it('her kayıt ayrı blok ve kalıcı kayıt id taşır', () => {
    const cv = cvWith('zarif')
    const doc = parse(renderCvSource(cv))
    const experience = cv.sections.find((s) => s.type === 'experience')!
    for (const item of experience.items) {
      expect(doc.querySelector(`[data-block][data-item-id="${item.id}"]`)).not.toBeNull()
    }
    expect(doc.querySelectorAll('[data-keep-with-next]').length).toBeGreaterThan(0)
  })

  it('gizli kayıt, gizli bölüm ve boş kayıt çizilmez', () => {
    const cv = structuredClone(cvWith('zarif'))
    const experience = cv.sections.find((s) => s.type === 'experience')!
    experience.items[0].hidden = true
    cv.sections.find((s) => s.type === 'projects')!.hidden = true
    const html = renderCvSource(cv)
    expect(html).not.toContain(experience.items[0].id)
    expect(html).not.toContain('Projeler')
  })

  it('iki sütunda DOM sırası okuma sırasıdır: başlık, yan sütun, ana sütun', () => {
    const cv = cvWith('panel')
    const doc = parse(renderCvSource(cv))
    const flows = Array.from(doc.querySelectorAll('[data-flow]')).map((el) => el.getAttribute('data-flow'))
    expect(flows).toEqual(['header', 'side', 'main'])
    const side = doc.querySelector('[data-flow="side"]')!
    // Yan sütun becerilerle başlar; iletişim her düzende başlıkta (tam genişlik).
    expect(side.querySelector('.section-title')!.textContent).toBe('Beceriler')
    expect(side.textContent).not.toContain('İletişim')
    expect(side.querySelector('.cv-contact')).toBeNull()
    expect(doc.querySelector('[data-flow="header"] .cv-contact')!.textContent).toContain('linkedin.com/in/deniz-aksoy-ornek')
    expect(doc.querySelector('[data-flow="main"]')!.textContent).toContain('Deneyim')
  })

  it('iletişim öğeleri ayrı birimler; ayırıcı önceki öğeye yapışık, öğeler arasında boşluk', () => {
    const doc = parse(renderCvSource(cvWith('panel')))
    const list = doc.querySelector('.cv-contact')!
    const items = Array.from(list.querySelectorAll('li'))
    expect(items.map((li) => li.textContent)).toContain('linkedin.com/in/deniz-aksoy-ornek\u00a0·')
    expect(items.at(-1)!.querySelector('.sep')).toBeNull()
    // Satır yalnız öğeler arasındaki (li dışındaki) düz boşlukta kırılabilir.
    for (const li of items.slice(1)) expect(li.previousSibling?.textContent).toBe(' ')
  })

  it('tek sütunda iletişim başlıkta, yan sütun yok', () => {
    const doc = parse(renderCvSource(cvWith('zarif')))
    expect(doc.querySelector('[data-flow="side"]')).toBeNull()
    expect(doc.querySelector('[data-flow="header"] .cv-contact')!.textContent).toContain('deniz.aksoy@example.com')
  })

  it('metin seçilebilir kalır: iletişim ve tarihler düz metin', () => {
    const doc = parse(renderCvSource(cvWith('zarif')))
    expect(doc.body.textContent).toContain('Şub 2024 – Günümüz')
    expect(doc.querySelectorAll('img').length).toBe(0)
  })

  it('fotoğraf yalnız açıkken çizilir', () => {
    const cv = structuredClone(cvWith('zarif'))
    cv.personal.photo = 'data:image/jpeg;base64,AAAA'
    cv.template.showPhoto = false
    expect(renderCvSource(cv)).not.toContain('cv-photo')
    cv.template.showPhoto = true
    expect(renderCvSource(cv)).toContain('cv-photo')
  })

  it('boş adda yer tutucu yalnız istenirse çizilir', () => {
    const cv = structuredClone(cvWith('zarif'))
    cv.personal.fullName = ''
    expect(renderCvSource(cv)).not.toContain('Adın Soyadın')
    expect(renderCvSource(cv, { placeholders: true })).toContain('Adın Soyadın')
  })
})

describe('zengin metin', () => {
  it('yalnız izinli etiketleri bırakır', () => {
    const dirty =
      '<p style="color:red" onclick="x()">Merhaba <strong>dünya</strong><script>alert(1)</script></p><h1>başlık</h1><a href="javascript:alert(1)">kötü</a>'
    const clean = sanitizeRichText(dirty)
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('style=')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('<h1>')
    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('<strong>dünya</strong>')
  })

  it('bağlantıları tamamlar ve sadeleştirir', () => {
    expect(toHref('ornek.com')).toBe('https://ornek.com')
    expect(toHref('ad@ornek.com')).toBe('mailto:ad@ornek.com')
    expect(toHref('https://x.com')).toBe('https://x.com')
    expect(displayUrl('https://www.ornek.com/')).toBe('ornek.com')
  })
})

describe('öneri farkı', () => {
  it('küçük değişiklikte kelimeleri işaretler, yapıyı korur', () => {
    const out = diffHtml(
      '<ul><li>Müşteri panelini React ile yeniden yazdım ve sayfayı hızlandırdım</li></ul>',
      '<ul><li>Müşteri panelini React 19 ile yeniden yazdım ve sayfayı %38 hızlandırdım</li></ul>',
    )
    expect(out).toContain('<ins class="sg-ins">19</ins>')
    expect(out).toContain('<ins class="sg-ins">%38</ins>')
    expect(out).not.toContain('sg-old')
    expect(out.startsWith('<ul><li>')).toBe(true)
    expect(out.endsWith('</li></ul>')).toBe(true)
  })

  it('büyük değişiklikte eski/yeni bloğu gösterir', () => {
    const out = diffHtml('<p>Tamamen eski bir metin burada duruyor</p>', '<p>Bambaşka yeni cümleler yazıldı şimdi</p>')
    expect(out).toContain('sg-old')
    expect(out).toContain('sg-new')
  })

  it('düz metinde kaçış yapar ve satır içi kalır', () => {
    const out = diffText('<b>a</b> b c d', 'x y z w')
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('<div')
  })
})
