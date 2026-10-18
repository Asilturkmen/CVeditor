import { describe, expect, it } from 'vitest'
import enRaw from '../../messages/en.json?raw'
import trRaw from '../../messages/tr.json?raw'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { FONT_IDS, type Cv } from '@/cv/schema'
import { contrast, colorVariables, ensureContrast, onColor } from './colors'
import { FONT_FACES } from './fontFaces.generated'
import { DISPLAY_FONTS, familyOf, FONTS } from './fonts'
import { cvVariables, renderCvSource } from './renderCv'
import {
  activeColorSet,
  getTemplate,
  settingsForTemplate,
  TEMPLATE_LIST,
  TEMPLATES,
  templateSettingsFor,
  templateSettingsForCopy,
  type TemplateId,
} from './templates'
import { nameMetrics } from './nameMetrics'

const tr = JSON.parse(trRaw) as Record<string, string>
const en = JSON.parse(enRaw) as Record<string, string>

function cvWith(templateId: TemplateId): Cv {
  const sections = sampleSections('tr')
  return createCv({
    name: 'Örnek',
    language: 'tr',
    templateId,
    template: templateSettingsFor(templateId, sections),
    personal: samplePersonal('tr'),
    sections,
  })
}

function parse(html: string) {
  const doc = document.implementation.createHTMLDocument('t')
  doc.body.innerHTML = html
  return doc
}

describe('şablon kaydı', () => {
  it('10 şablon onaylı sırada', () => {
    expect(TEMPLATE_LIST.map((t) => t.id)).toEqual(['zarif', 'panel', 'bant', 'manset', 'gece', 'isvicre', 'cizelge', 'cift', 'afis', 'cerceve'])
  })

  it('bilinmeyen ya da eski kimlik Zarif’e düşer', () => {
    expect(getTemplate('klasik').id).toBe('zarif')
    expect(getTemplate('yok').id).toBe('zarif')
    expect(getTemplate('__proto__').id).toBe('zarif')
  })

  it('her şablonun adı, açıklaması, etiketleri ve renk takımı adları iki dilde var', () => {
    for (const t of TEMPLATE_LIST) {
      for (const key of [t.nameKey, t.descKey, ...t.tags.map((tag) => `tag_${tag}`), ...t.colorSets.map((s) => `color_${s.id}`)]) {
        expect(tr[key], `tr: ${key}`).toBeTruthy()
        expect(en[key], `en: ${key}`).toBeTruthy()
      }
    }
  })

  it('sütun kararları: Panel ve Çift Ton yalnız 2; Zarif, Gece, İsviçre, Çizelge yalnız 1; diğerleri 2 (+1)', () => {
    const cols = Object.fromEntries(TEMPLATE_LIST.map((t) => [t.id, [...t.columns]]))
    expect(cols).toEqual({
      zarif: [1],
      panel: [2],
      bant: [2, 1],
      manset: [2, 1],
      gece: [1],
      isvicre: [1],
      cizelge: [1],
      cift: [2],
      afis: [2, 1],
      cerceve: [2, 1],
    })
  })

  it('yeni CV’de fotoğraf açık; varsayılan renk takımın ilki, yazı tipi şablonunki', () => {
    for (const t of TEMPLATE_LIST) {
      expect(t.defaults.showPhoto).toBe(true)
      expect(t.defaults.accentColor).toBe(t.colorSets[0].accent)
      expect(t.defaults.columns).toBe(t.columns[0])
      expect(FONT_IDS).toContain(t.defaults.font)
    }
  })

  it('her şablonun yazı tipleri sunuluyor (statik yüzlerle)', () => {
    for (const t of TEMPLATE_LIST) {
      for (const key of [t.fonts.body, t.fonts.display, t.fonts.mono].filter(Boolean)) {
        const def = (FONTS as Record<string, (typeof FONTS)['inter']>)[key!] ?? DISPLAY_FONTS[key as keyof typeof DISPLAY_FONTS]
        expect(def, key).toBeTruthy()
        expect(FONT_FACES[familyOf(def).replace(/'/g, '')], key).toBeTruthy()
      }
    }
    // Gövde ailelerinin hepsinde düz ve kalın yüz var.
    for (const id of FONT_IDS) expect(FONT_FACES[familyOf(FONTS[id]).replace(/'/g, '')]).toEqual(expect.arrayContaining(['400', '700']))
  })
})

describe('şablon değiştirme ayarları', () => {
  const sections = sampleSections('tr')

  it('dokunulmamış renk takımı, yazı tipi ve sütun yeni şablonunkine geçer', () => {
    const next = settingsForTemplate(TEMPLATES.zarif, TEMPLATES.panel, templateSettingsFor('zarif', sections), sections)
    expect(next.accentColor).toBe(TEMPLATES.panel.defaults.accentColor)
    expect(next.font).toBe('inter')
    expect(next.columns).toBe(2)
    expect(next.sideSections.length).toBeGreaterThan(0)
  })

  it('hazır takımlardan biri seçiliyse de yeni şablonun takımına geçer; zemin sıfırlanır', () => {
    const settings = { ...templateSettingsFor('panel', sections), accentColor: '#c9a45c', baseColor: '#1e3a2f' }
    expect(activeColorSet(TEMPLATES.panel, settings)?.id).toBe('orman')
    const next = settingsForTemplate(TEMPLATES.panel, TEMPLATES.bant, settings, sections)
    expect(next.accentColor).toBe(TEMPLATES.bant.defaults.accentColor)
    expect(next.baseColor).toBeNull()
  })

  it('başlık hizası: varsayılanda kaldıysa yeni şablonun varsayılanına geçer, seçilmişse kalır', () => {
    // Zarif ortalı, Panel sola yaslı
    const zarif = templateSettingsFor('zarif', sections)
    expect(zarif.headerAlign).toBe('center')
    expect(settingsForTemplate(TEMPLATES.zarif, TEMPLATES.panel, zarif, sections).headerAlign).toBe('left')
    const panel = templateSettingsFor('panel', sections)
    expect(settingsForTemplate(TEMPLATES.panel, TEMPLATES.zarif, panel, sections).headerAlign).toBe('center')
    // Kullanıcı Panel'de ortalamış: Zarif'te de ortalı; Zarif'te sola almış: Bant'ta da sola.
    expect(settingsForTemplate(TEMPLATES.panel, TEMPLATES.bant, { ...panel, headerAlign: 'center' }, sections).headerAlign).toBe('center')
    expect(settingsForTemplate(TEMPLATES.zarif, TEMPLATES.isvicre, { ...zarif, headerAlign: 'left' }, sections).headerAlign).toBe('left')
    // Hizası aynı iki şablon arasında hiçbir şey değişmez.
    expect(settingsForTemplate(TEMPLATES.bant, TEMPLATES.panel, { ...templateSettingsFor('bant', sections), headerAlign: 'center' }, sections).headerAlign).toBe('center')
  })

  it('başka CV’den kopyalarken vurgu rengi aynı kuralla taşınır', () => {
    // Kaynak Panel'in hazır takımında: yeni şablonun varsayılanı
    const preset = { templateId: 'panel', template: { ...templateSettingsFor('panel', sections), accentColor: '#c9a45c', baseColor: '#1e3a2f' } }
    expect(templateSettingsForCopy(preset, 'bant', sections).accentColor).toBe(TEMPLATES.bant.defaults.accentColor)
    // Kaynağın varsayılan rengi de öyle
    expect(templateSettingsForCopy({ templateId: 'zarif', template: templateSettingsFor('zarif', sections) }, 'gece', sections).accentColor).toBe(
      TEMPLATES.gece.defaults.accentColor,
    )
    // Özel renk kalır; geri kalanı yeni şablonun varsayılanı
    const custom = { templateId: 'zarif', template: { ...templateSettingsFor('zarif', sections), accentColor: '#123456', font: 'literata' as const } }
    const copy = templateSettingsForCopy(custom, 'panel', sections)
    expect(copy.accentColor).toBe('#123456')
    expect(copy.font).toBe(TEMPLATES.panel.defaults.font)
    expect(copy.columns).toBe(2)
    expect(copy.baseColor).toBeNull()
    // Bilinmeyen kaynak şablon varsayılan şablon sayılır
    expect(templateSettingsForCopy({ templateId: 'klasik', template: templateSettingsFor('zarif', sections) }, 'afis', sections).accentColor).toBe(
      TEMPLATES.afis.defaults.accentColor,
    )
  })

  it('özel renk ve kullanıcının seçtiği sütun (destekleniyorsa) kalır', () => {
    const settings = { ...templateSettingsFor('bant', sections), accentColor: '#123456', columns: 1 as const }
    const next = settingsForTemplate(TEMPLATES.bant, TEMPLATES.afis, settings, sections)
    expect(next.accentColor).toBe('#123456')
    expect(next.columns).toBe(1)
    // Desteklenmeyen sütun desteklenene çekilir.
    expect(settingsForTemplate(TEMPLATES.bant, TEMPLATES.panel, settings, sections).columns).toBe(2)
  })
})

describe('renkler ve kontrast koruması', () => {
  it('renkli zeminin üstündeki metin her zaman en az 4.5:1', () => {
    for (const bg of ['#ffd400', '#0f4c75', '#777777', '#ff0000', '#00ff00', '#ffffff', '#000000', '#7a2e2e']) {
      expect(contrast(onColor(bg), bg), bg).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('kullanıcının açık rengi metin olarak kullanılınca koyulaşır (≥ 4.5:1), koyu zeminde açılır', () => {
    const light = ensureContrast('#ffd400', '#ffffff')
    expect(contrast(light, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(ensureContrast('#1f3a5f', '#ffffff')).toBe('#1f3a5f')
    const onDark = ensureContrast('#3d3a7a', '#14171f')
    expect(contrast(onDark, '#14171f')).toBeGreaterThanOrEqual(4.5)
  })

  it('türetilen değişkenler okunur', () => {
    const vars = colorVariables({ accent: '#ffd400', base: '#ffd400', paper: '#ffffff', ink: '#0b0b0b' })
    expect(contrast(vars['--accent-ink'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(vars['--on-accent'], '#ffd400')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#0b0b0b', vars['--accent-mark'])).toBeGreaterThanOrEqual(4.5)
    const dark = colorVariables({ accent: '#d4a85a', base: '#14171f', paper: 'base' })
    expect(dark['--paper']).toBe('#14171f')
    expect(contrast(dark['--ink'], dark['--paper'])).toBeGreaterThanOrEqual(7)
    expect(contrast(dark['--muted'], dark['--paper'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark['--base-ink'], dark['--base-soft'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(dark['--accent-on-base'], dark['--base'])).toBeGreaterThanOrEqual(4.5)
  })

  it('CV değişkenleri şablonun zeminini, yazı tiplerini ve hazır takımın elle seçilmiş tonlarını taşır', () => {
    const cv = cvWith('cift')
    const css = cvVariables(cv.template, TEMPLATES.cift)
    expect(css).toContain('--base:#3d3a7a')
    expect(css).toContain('--base-soft:#e7e3f7')
    expect(css).toContain("--font-display:'CV Space Grotesk'")
    const isvicre = cvVariables(cvWith('isvicre').template, TEMPLATES.isvicre)
    expect(isvicre).toContain("--font-mono:'CV IBM Plex Mono'")
    // Özel renkte takımın elle seçilmiş tonu uygulanmaz, türetilen kullanılır.
    const custom = cvVariables({ ...cv.template, baseColor: '#204060' }, TEMPLATES.cift)
    expect(custom).not.toContain('--base-soft:#e7e3f7')
  })
})

describe('markup kancaları', () => {
  it('ad iç span’da, ad + unvan .cv-heading içinde; DOM sırası ad → unvan → iletişim', () => {
    const doc = parse(renderCvSource(cvWith('afis')))
    expect(doc.querySelector('.cv-identity > .cv-heading > h1.cv-name > span.cv-name-text')?.textContent).toBe('Deniz Aksoy')
    const order = [...doc.querySelectorAll('.cv-name, .cv-headline, .cv-contact')].map((el) => el.className)
    expect(order).toEqual(['cv-name', 'cv-headline', 'cv-contact'])
  })

  it('bilinmeyen şablon varsayılana, desteklenmeyen sütun desteklenene düşer', () => {
    const cv = cvWith('zarif')
    const unknown = parse(renderCvSource({ ...cv, templateId: 'klasik' as TemplateId }))
    expect(unknown.querySelector('.cv')?.className).toContain('tpl-zarif')
    // Zarif yalnız tek sütun: kayıtta 2 olsa da yan sütun akışı yok, hepsi ana akışta.
    const zarif2 = parse(renderCvSource({ ...cv, template: { ...cv.template, columns: 2, sideSections: cv.sections.map((s) => s.id) } }))
    expect(zarif2.querySelector('.cv')?.className).toContain('cols-1')
    expect(zarif2.querySelector('[data-flow="side"]')).toBeNull()
    expect(zarif2.querySelectorAll('[data-flow="main"] .section-title').length).toBeGreaterThan(3)
    // Panel yalnız iki sütun: kayıtta 1 olsa da iki sütun çizilir.
    const panel = cvWith('panel')
    const panel1 = parse(renderCvSource({ ...panel, template: { ...panel.template, columns: 1 } }))
    expect(panel1.querySelector('.cv')?.className).toContain('cols-2')
    expect(panel1.querySelector('[data-flow="side"] .section-title')).toBeTruthy()
  })

  it('ad ölçüsü: en uzun kelimenin harf sayısı çizime değişken olarak geçer', () => {
    expect(nameMetrics('Deniz Aksoy')).toEqual({ isLong: false, hasLongWord: false, longest: 5 })
    // 12 harf: uzun kelime (eşik "12+ harf")
    expect(nameMetrics('Abdurrahman Kahramanoğlu')).toEqual({ isLong: false, hasLongWord: true, longest: 12 })
    expect(nameMetrics('Ayşegül Nur Karamustafaoğlu Öztürk').isLong).toBe(true)
    expect(nameMetrics('Ali Yılmazoğlu').hasLongWord).toBe(false)
    const cv = structuredClone(cvWith('manset'))
    cv.personal.fullName = 'Abdurrahman Kahramanoğlu'
    expect(parse(renderCvSource(cv)).querySelector<HTMLElement>('.cv-name')?.getAttribute('style')).toBe('--name-longest:12')
    // Boş ad: önizlemedeki yer tutucunun ölçüsü
    cv.personal.fullName = ''
    expect(parse(renderCvSource(cv, { placeholders: true })).querySelector<HTMLElement>('.cv-name')?.getAttribute('style')).toMatch(/^--name-longest:\d+$/)
  })

  it('uzun ad işaretlenir', () => {
    const cv = structuredClone(cvWith('manset'))
    expect(parse(renderCvSource(cv)).querySelector('.cv-name')?.className).toBe('cv-name')
    cv.personal.fullName = 'Ayşegül Karamustafapaşaoğlu Yıldırım'
    const name = parse(renderCvSource(cv)).querySelector('.cv-name')!
    expect(name.classList.contains('is-long')).toBe(true)
    expect(name.classList.contains('has-long-word')).toBe(true)
  })

  it('bölüm başlığı türünü taşır; anahtar kelimeler metni değiştirmeden ayrılır', () => {
    const doc = parse(renderCvSource(cvWith('cizelge')))
    expect(doc.querySelector('h2.section-title[data-section-type="skills"]')).toBeTruthy()
    const value = doc.querySelector('.entry-skills .line-value')!
    expect(value.textContent).toBe('TypeScript, JavaScript, HTML, CSS, SQL')
    expect([...value.querySelectorAll('.kw')].map((k) => k.textContent)).toEqual(['TypeScript', 'JavaScript', 'HTML', 'CSS', 'SQL'])
  })

  it('fotoğraf yoksa: yalnız editör (ipucu verilince) kesikli kutu çizer; başlık sınıfları fotoğraf durumunu söyler', () => {
    const cv = cvWith('bant')
    expect(cv.template.showPhoto).toBe(true)
    const plain = parse(renderCvSource(cv, { placeholders: true }))
    expect(plain.querySelector('.cv-header')?.className).toBe('cv-header no-photo')
    expect(plain.querySelector('.cv-photo')).toBeNull()
    const editor = parse(renderCvSource(cv, { placeholders: true, photoHint: 'Fotoğraf ekle' }))
    expect(editor.querySelector('.cv-header')?.className).toBe('cv-header has-photo photo-ph')
    const box = editor.querySelector('.cv-header > .cv-photo.ph.ph-photo')!
    expect(box.textContent).toBe('Fotoğraf ekle')
    expect(box.getAttribute('aria-hidden')).toBe('true')
    // Fotoğraf kapalıysa kutu da yok.
    const off = parse(renderCvSource({ ...cv, template: { ...cv.template, showPhoto: false } }, { placeholders: true, photoHint: 'x' }))
    expect(off.querySelector('.ph-photo')).toBeNull()
    // Gerçek fotoğraf: img, kutu yok.
    const withPhoto = parse(renderCvSource({ ...cv, personal: { ...cv.personal, photo: 'data:image/jpeg;base64,AAAA' } }, { placeholders: true, photoHint: 'x' }))
    expect(withPhoto.querySelector('.cv-header')?.className).toBe('cv-header has-photo')
    expect(withPhoto.querySelector('img.cv-photo')).toBeTruthy()
    expect(withPhoto.querySelector('.ph-photo')).toBeNull()
  })
})
