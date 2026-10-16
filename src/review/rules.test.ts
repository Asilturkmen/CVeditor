import { describe, expect, it } from 'vitest'
import type { PdfText, PdfTextLine } from '@/ai/pdfText'
import { createCv, createItem, createSection } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv, CvLanguage, SectionOf, SectionType } from '@/cv/schema'
import { templateSettingsFor } from '@/render/templates'
import { columnInterleaving, detectDateStyles, pdfErrorFinding, reviewCv, reviewPdfText, type Finding } from './rules'

const NOW = new Date('2026-10-16')

function sampleCv(language: CvLanguage = 'tr', template: 'klasik' | 'modern' = 'klasik'): Cv {
  const sections = sampleSections(language)
  return createCv({
    name: 'Örnek',
    language,
    templateId: template,
    template: templateSettingsFor(template, sections),
    personal: samplePersonal(language),
    sections,
  })
}

const section = <T extends SectionType>(cv: Cv, type: T) => cv.sections.find((s): s is SectionOf<T> => s.type === type)!
const review = (cv: Cv, pageCount?: number) => reviewCv(cv, { now: NOW, pageCount })
const byId = (findings: Finding[], id: string) => findings.find((f) => f.id === id)
const issues = (findings: Finding[]) => findings.filter((f) => f.severity === 'warn' || f.severity === 'problem')

describe('reviewCv: örnek CV', () => {
  it('örnek CV sorunsuz geçer ve her kategoride geçen kontrol var', () => {
    for (const lang of ['tr', 'en'] as const) {
      const findings = review(sampleCv(lang), 1)
      expect(issues(findings)).toEqual([])
      for (const c of ['okunabilirlik', 'iletisim', 'yapi', 'tarihler', 'icerik', 'bicim']) {
        expect(findings.some((f) => f.category === c && f.severity === 'ok')).toBe(true)
      }
    }
  })

  it('puan ya da yüzde uydurmaz', () => {
    for (const f of review(sampleCv(), 1)) expect(`${f.title} ${f.detail}`).not.toMatch(/puan|skor|score|\d+\s?%/i)
  })

  it('bulgu kimlikleri tekildir', () => {
    const cv = sampleCv()
    section(cv, 'experience').items.forEach((i) => (i.description = '<p>Ben  çalıştım</p>'))
    const ids = review(cv, 3).map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('reviewCv: iletişim', () => {
  it('ad, unvan, e-posta, telefon, konum eksikliği', () => {
    const cv = sampleCv()
    Object.assign(cv.personal, { fullName: ' ', email: '', phone: '', location: '', headline: '' })
    const f = review(cv)
    expect(byId(f, 'name')).toMatchObject({ severity: 'problem', target: { personal: true } })
    expect(byId(f, 'email')?.severity).toBe('problem')
    expect(byId(f, 'phone')?.severity).toBe('warn')
    expect(byId(f, 'location')?.severity).toBe('info')
    expect(byId(f, 'headline')?.severity).toBe('warn')
  })

  it('hatalı e-posta ve telefon, ülke kodu', () => {
    const cv = sampleCv()
    cv.personal.email = 'deniz@example'
    cv.personal.phone = '0555 000 00 00 (akşam)'
    let f = review(cv)
    expect(byId(f, 'email')?.title).toContain('deniz@example')
    expect(byId(f, 'phone')?.severity).toBe('warn')
    cv.personal.phone = '0555 000 00 00'
    f = review(cv)
    expect(byId(f, 'phone')?.severity).toBe('info')
  })

  it('bozuk bağlantılar ve yanlış profil alanı', () => {
    const cv = sampleCv()
    cv.personal.website = 'benim sitem'
    cv.personal.linkedin = 'github.com/deniz'
    const projects = section(cv, 'projects')
    projects.items[0].url = 'javascript:alert(1)'
    const f = review(cv)
    expect(byId(f, 'link-website')?.severity).toBe('warn')
    expect(byId(f, 'link-linkedin')?.title).toContain('LinkedIn')
    expect(byId(f, `link-${projects.items[0].id}`)?.target).toEqual({ sectionId: projects.id, itemId: projects.items[0].id })
    expect(byId(f, 'links')).toBeUndefined()
  })

  it('LinkedIn yoksa öneri', () => {
    const cv = sampleCv()
    cv.personal.linkedin = ''
    expect(byId(review(cv), 'linkedin')?.severity).toBe('info')
  })
})

describe('reviewCv: yapı', () => {
  it("ATS'nin tanımadığı başlık uyarı verir ve CV dilinde standart adı önerir", () => {
    const cv = sampleCv()
    const exp = section(cv, 'experience')
    exp.title = 'Kariyer Yolculuğum'
    const f = byId(review(cv), `title-${exp.id}`)!
    expect(f.severity).toBe('warn')
    expect(f.detail).toContain('“Deneyim”')
    expect(f.target).toEqual({ sectionId: exp.id, itemId: exp.items[0].id })

    const en = sampleCv('en')
    const enExp = section(en, 'experience')
    enExp.title = 'My Journey'
    expect(byId(review(en), `title-${enExp.id}`)?.detail).toContain('“Experience”')
  })

  it('bilinen eş anlamlı başlıklar sorun değil (büyük harf, İ, & dahil)', () => {
    const cv = sampleCv()
    section(cv, 'experience').title = 'İŞ DENEYİMİ'
    section(cv, 'skills').title = 'Teknik Yetkinlikler'
    section(cv, 'certificates').title = 'Licenses & Certifications'
    const f = review(cv)
    expect(f.filter((x) => x.id.startsWith('title-'))).toEqual([])
    expect(byId(f, 'titles')?.severity).toBe('ok')
  })

  it('başlık başka bölüm türüne aitse uyarır', () => {
    const cv = sampleCv()
    section(cv, 'experience').title = 'Eğitim'
    expect(review(cv).some((f) => f.id.startsWith('title-') && f.severity === 'warn')).toBe(true)
  })

  it('özel bölüm: tanınmayan başlık öneri, yaygın başlık sessiz', () => {
    const cv = sampleCv()
    const custom = createSection('custom', 1)
    custom.title = 'Yan Uğraşlar'
    custom.items[0].title = 'Fotoğrafçılık'
    cv.sections.push(custom)
    expect(byId(review(cv), `title-${custom.id}`)?.severity).toBe('info')
    custom.title = 'Yayınlar'
    expect(byId(review(cv), `title-${custom.id}`)).toBeUndefined()
  })

  it('eksik temel bölümler', () => {
    const cv = sampleCv()
    cv.sections = cv.sections.filter((s) => !['experience', 'education', 'skills'].includes(s.type))
    const f = review(cv)
    expect(byId(f, 'need-experience')?.severity).toBe('warn')
    expect(byId(f, 'need-education')?.severity).toBe('warn')
    expect(byId(f, 'need-skills')?.severity).toBe('info')
    expect(byId(f, 'essentials')).toBeUndefined()
  })

  it('gizli bölüm ve kayıtlar bilgi olarak listelenir; gizli içerik başka kontrollere girmez', () => {
    const cv = sampleCv()
    const projects = section(cv, 'projects')
    projects.hidden = true
    projects.items[0].dates = { start: { year: 2024, month: 1 }, end: { year: 2020, month: 1 }, current: false }
    section(cv, 'experience').items[2].hidden = true
    const f = review(cv)
    expect(byId(f, `hidden-${projects.id}`)?.severity).toBe('info')
    expect(byId(f, 'hidden-items')?.title).toBe('1 kayıt gizli')
    expect(f.some((x) => x.id.startsWith('date-inverted'))).toBe(false)
  })
})

describe('reviewCv: tarihler', () => {
  it('ters tarih sorun, kaydı hedefler', () => {
    const cv = sampleCv()
    const item = section(cv, 'experience').items[1]
    item.dates = { start: { year: 2023, month: 9 }, end: { year: 2023, month: 6 }, current: false }
    const findings = review(cv)
    const f = byId(findings, `date-inverted-${item.id}`)!
    expect(f.severity).toBe('problem')
    expect(f.detail).toContain('Eyl 2023 – Haz 2023')
    expect(f.target?.itemId).toBe(item.id)
    expect(byId(findings, 'dates-complete')).toBeUndefined()
  })

  it('başlangıç yok / bitiş yok ve devam etmiyor', () => {
    const cv = sampleCv()
    const [a, b] = section(cv, 'experience').items
    a.dates = { start: null, end: null, current: true }
    b.dates = { start: { year: 2023, month: 6 }, end: null, current: false }
    const f = review(cv)
    expect(byId(f, `date-start-${a.id}`)?.severity).toBe('warn')
    expect(byId(f, `date-end-${b.id}`)?.severity).toBe('warn')
  })

  it('yeniden eskiye sıralı değilse uyarır', () => {
    const cv = sampleCv()
    const exp = section(cv, 'experience')
    exp.items.reverse()
    const f = byId(review(cv), `date-order-${exp.id}`)!
    expect(f.severity).toBe('warn')
    expect(f.title).toContain('Deneyim')
    expect(byId(review(sampleCv()), 'dates-order')?.severity).toBe('ok')
  })

  it('ayı olan ve olmayan tarihler karışık', () => {
    const cv = sampleCv()
    section(cv, 'education').items[0].dates = { start: { year: 2020, month: null }, end: { year: 2024, month: null }, current: false }
    expect(byId(review(cv), 'dates-format')?.severity).toBe('info')
  })
})

describe('reviewCv: içerik', () => {
  it('son rolde açıklama yoksa uyarır; eski rolde susar', () => {
    const cv = sampleCv()
    const [recent, , old] = section(cv, 'experience').items
    recent.description = ''
    old.description = ''
    old.dates = { start: { year: 2012, month: 1 }, end: { year: 2014, month: 1 }, current: false }
    const f = review(cv)
    expect(byId(f, `empty-${recent.id}`)?.severity).toBe('warn')
    expect(byId(f, `empty-${old.id}`)).toBeUndefined()
  })

  it('uzun madde, tek paragraf, zamir', () => {
    const cv = sampleCv()
    const [a, b] = section(cv, 'experience').items
    a.description = `<ul><li>${'Çok uzun bir madde '.repeat(14)}</li><li>Kısa madde</li></ul>`
    b.description = `<p>Ben ${'rezervasyon akışında form doğrulamalarını tek kütüphaneye taşıdım ve testler yazdım. '.repeat(4)}</p>`
    const f = review(cv)
    expect(byId(f, `long-${a.id}`)?.title).toMatch(/^1 madde/)
    expect(byId(f, `paragraph-${b.id}`)?.severity).toBe('warn')
    expect(byId(f, `pronoun-${b.id}`)?.severity).toBe('info')
    expect(byId(f, 'long')).toBeUndefined()
  })

  it('İngilizce zamir: "I" madde başında', () => {
    const cv = sampleCv('en')
    const item = section(cv, 'experience').items[0]
    item.description = '<ul><li>I rewrote the dashboard.</li><li>Shipped a design system.</li></ul>'
    expect(byId(review(cv), `pronoun-${item.id}`)).toBeDefined()
    item.description = '<ul><li>Improved load time.</li></ul>'
    expect(byId(review(cv), `pronoun-${item.id}`)).toBeUndefined()
  })

  it('sayılı madde sayımı: skor değil, sayı', () => {
    expect(byId(review(sampleCv()), 'numbers')?.title).toBe('6 maddenin 3 tanesinde sayı var')
    const cv = sampleCv()
    section(cv, 'experience').items.forEach((i) => (i.description = '<ul><li>Arayüz geliştirdim.</li><li>Test yazdım.</li></ul>'))
    expect(byId(review(cv), 'numbers')?.severity).toBe('info')
  })

  it('özet uzunluğu', () => {
    const cv = sampleCv()
    const summary = section(cv, 'summary').items[0]
    summary.content = '<p>Frontend geliştirici.</p>'
    expect(byId(review(cv), 'summary')?.title).toContain('kısa')
    summary.content = `<p>${'kelime '.repeat(120)}</p>`
    expect(byId(review(cv), 'summary')?.severity).toBe('warn')
    cv.sections = cv.sections.filter((s) => s.type !== 'summary')
    expect(byId(review(cv), 'summary')?.severity).toBe('info')
  })
})

describe('reviewCv: biçim ve düzen', () => {
  it('madde sonları karışık, çift boşluk, tamamı büyük harf', () => {
    const cv = sampleCv()
    const [a, b] = section(cv, 'experience').items
    a.description = '<ul><li>Noktalı madde.</li><li>Noktasız madde</li></ul>'
    b.position = 'KIDEMLİ YAZILIM GELİŞTİRİCİ'
    b.company = 'Martı  Teknoloji'
    const f = review(cv)
    expect(byId(f, 'bullet-end')?.severity).toBe('info')
    expect(byId(f, `double-${b.id}`)?.severity).toBe('info')
    expect(byId(f, `caps-${b.id}`)?.severity).toBe('info')
  })

  it('sayfa sayısı', () => {
    expect(byId(review(sampleCv(), 1), 'pages')?.severity).toBe('ok')
    expect(byId(review(sampleCv(), 2), 'pages')?.severity).toBe('info')
    expect(byId(review(sampleCv(), 3), 'pages')).toMatchObject({ severity: 'warn', title: 'CV 3 sayfa' })
    expect(byId(review(sampleCv()), 'pages')).toBeUndefined()
  })

  it("İngilizce CV'de fotoğraf bilgi verir, Türkçede vermez", () => {
    const en = sampleCv('en')
    en.personal.photo = 'data:image/jpeg;base64,AAAA'
    en.template.showPhoto = true
    expect(byId(review(en), 'photo')).toMatchObject({ severity: 'info', target: { tab: 'appearance' } })
    const tr = sampleCv('tr')
    tr.personal.photo = 'data:image/jpeg;base64,AAAA'
    tr.template.showPhoto = true
    expect(byId(review(tr), 'photo')?.severity).toBe('ok')
  })

  it('iki sütun: tek sütun ok, deneyim yan sütunda uyarı, uzun yan sütun uyarı', () => {
    expect(byId(review(sampleCv('tr', 'klasik')), 'layout')?.severity).toBe('ok')
    const cv = sampleCv('tr', 'modern')
    expect(byId(review(cv), 'layout')?.severity).toBe('info')
    const exp = section(cv, 'experience')
    cv.template.sideSections.push(exp.id)
    const f = review(cv)
    expect(byId(f, `layout-side-${exp.id}`)).toMatchObject({ severity: 'warn', target: { sectionId: exp.id, tab: 'appearance' } })
    expect(byId(f, 'layout-side-long')).toBeUndefined()
    exp.items[0].description = `<ul>${'<li>Yan sütunda uzun bir madde, ATS sütunları karıştırırsa okunmaz.</li>'.repeat(20)}</ul>`
    expect(byId(review(cv), 'layout-side-long')?.severity).toBe('warn')
  })

  it('boş kayıtlar görmezden gelinir', () => {
    const cv = sampleCv()
    section(cv, 'experience').items.push(createItem('experience'))
    expect(issues(review(cv, 1))).toEqual([])
  })
})

// ---------------------------------------------------------------- Düzenle hedefleri

/** Bulgu kimliğindeki kayıt/bölüm id'leri "*" olur: "date-inverted-*" gibi bulgu türü kalır. */
const kind = (id: string) => id.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '*')

/** Her biri birkaç kuralı tetikleyen bozuk CV'ler; birlikte bütün düzeltilecek bulgu türlerini kapsar. */
const BROKEN: { name: string; build: () => Cv; pages?: number }[] = [
  {
    name: 'kişisel bilgiler eksik',
    build: () => {
      const cv = sampleCv()
      Object.assign(cv.personal, { fullName: ' ', headline: '', email: '', phone: '', location: '', linkedin: '' })
      return cv
    },
  },
  {
    name: 'kişisel bilgiler ve bağlantılar hatalı',
    build: () => {
      const cv = sampleCv()
      Object.assign(cv.personal, {
        fullName: 'Deniz  Aksoy',
        headline: 'KIDEMLİ YAZILIM GELİŞTİRİCİ',
        email: 'deniz@example',
        phone: '0555 000 00 00 (akşam)',
        website: 'benim sitem',
        linkedin: 'github.com/deniz',
        github: 'gitlab.com/deniz',
      })
      section(cv, 'projects').items[0].url = 'javascript:alert(1)'
      return cv
    },
  },
  {
    name: 'ülke kodu yok',
    build: () => {
      const cv = sampleCv()
      cv.personal.phone = '0555 000 00 00'
      return cv
    },
  },
  {
    name: 'temel bölümler yok, gizli bölüm ve kayıt',
    build: () => {
      const cv = sampleCv()
      cv.sections = cv.sections.filter((s) => !['experience', 'education', 'skills', 'summary'].includes(s.type))
      section(cv, 'projects').hidden = true
      section(cv, 'languages').items[0].hidden = true
      return cv
    },
  },
  {
    name: 'başlık, tarihler',
    build: () => {
      const cv = sampleCv()
      const exp = section(cv, 'experience')
      exp.title = 'Kariyer Yolculuğum'
      exp.items[0].dates = { start: null, end: null, current: true }
      exp.items[1].dates = { start: { year: 2023, month: 6 }, end: null, current: false }
      exp.items[2].dates = { start: { year: 2024, month: 1 }, end: { year: 2020, month: 1 }, current: false }
      section(cv, 'projects').items[0].dates = { start: { year: 2024, month: 1 }, end: { year: 2020, month: 1 }, current: false }
      section(cv, 'education').items[0].dates = { start: { year: 2020, month: null }, end: { year: 2024, month: null }, current: false }
      return cv
    },
  },
  {
    name: 'sıra',
    build: () => {
      const cv = sampleCv()
      section(cv, 'experience').items.reverse()
      return cv
    },
  },
  {
    name: 'içerik ve biçim',
    build: () => {
      const cv = sampleCv()
      section(cv, 'summary').items[0].content = `<p>${'kelime '.repeat(120)}</p>`
      const [a, b, c] = section(cv, 'experience').items
      a.description = ''
      b.description = `<p>Ben ${'rezervasyon akışında form doğrulamalarını tek kütüphaneye taşıdım ve testler yazdım. '.repeat(4)}</p>`
      b.position = 'KIDEMLİ YAZILIM GELİŞTİRİCİ'
      b.company = 'Martı  Teknoloji'
      c.description = `<ul><li>${'Çok uzun bir madde '.repeat(14)}</li></ul>`
      section(cv, 'projects').items.forEach((i) => (i.description = '<ul><li>Arayüz geliştirdim.</li></ul>'))
      return cv
    },
    pages: 3,
  },
  {
    name: 'kısa özet, iki sayfa',
    build: () => {
      const cv = sampleCv()
      section(cv, 'summary').items[0].content = '<p>Frontend geliştirici.</p>'
      return cv
    },
    pages: 2,
  },
  {
    name: 'iki sütun',
    build: () => {
      const cv = sampleCv('tr', 'modern')
      const exp = section(cv, 'experience')
      cv.template.sideSections.push(exp.id)
      exp.items[0].description = `<ul>${'<li>Yan sütunda uzun bir madde, ATS sütunları karıştırırsa okunmaz.</li>'.repeat(20)}</ul>`
      return cv
    },
  },
  {
    name: 'İngilizce iki sütunlu CV, fotoğraf',
    build: () => {
      const cv = sampleCv('en', 'modern')
      cv.personal.photo = 'data:image/jpeg;base64,AAAA'
      cv.template.showPhoto = true
      return cv
    },
  },
]

describe('reviewCv: her düzeltilecek bulgunun Düzenle hedefi var', () => {
  const all = BROKEN.flatMap(({ build, pages }) => {
    const cv = build()
    return review(cv, pages).map((f) => ({ cv, f }))
  })

  it('geçmeyen her bulgu editörde bir yeri hedefler', () => {
    const missing = all.filter(({ f }) => f.severity !== 'ok' && !f.target).map(({ f }) => f.id)
    expect(missing).toEqual([])
  })

  it('bütün bulgu türleri kapsandı', () => {
    const kinds = new Set(all.filter(({ f }) => f.severity !== 'ok').map(({ f }) => kind(f.id)))
    // Yeni bir kural eklenince buraya da eklenir; testteki bozuk CV'ler onu tetiklemeli.
    const expected = [
      'layout-side-*', 'layout-side-long', 'layout',
      'name', 'headline', 'email', 'phone', 'location', 'link-website', 'link-linkedin', 'link-github', 'link-*', 'linkedin',
      'title-*', 'need-experience', 'need-education', 'need-skills', 'hidden-*', 'hidden-items',
      'date-start-*', 'date-end-*', 'date-inverted-*', 'date-order-*', 'dates-format',
      'summary', 'empty-*', 'paragraph-*', 'long-*', 'pronoun-*', 'numbers',
      'double-personal', 'caps-personal', 'double-*', 'caps-*', 'bullet-end', 'pages', 'photo',
    ]
    expect([...kinds].sort()).toEqual([...expected].sort())
  })

  it('hedefler CV\'de var olan kayıt ve bölümlere işaret eder', () => {
    for (const { cv, f } of all) {
      const t = f.target
      if (!t) continue
      if (t.sectionId) expect(cv.sections.some((s) => s.id === t.sectionId), f.id).toBe(true)
      if (t.itemId) {
        const owner = cv.sections.find((s) => (s.items as { id: string }[]).some((i) => i.id === t.itemId))
        expect(owner, f.id).toBeDefined()
        if (t.sectionId) expect(owner?.id, f.id).toBe(t.sectionId)
      }
    }
  })

  it('eksik bölüm: yoksa eklenir, boş ya da gizliyse var olana gidilir', () => {
    const cv = sampleCv()
    cv.sections = cv.sections.filter((s) => s.type !== 'education' && s.type !== 'summary')
    const exp = section(cv, 'experience')
    exp.hidden = true
    const skills = section(cv, 'skills')
    skills.items = []
    const f = review(cv)
    expect(byId(f, 'need-education')?.target).toEqual({ addSection: 'education' })
    expect(byId(f, 'summary')?.target).toEqual({ addSection: 'summary' })
    expect(byId(f, 'need-experience')?.target).toEqual({ sectionId: exp.id, itemId: exp.items[0].id })
    expect(byId(f, 'need-skills')?.target).toEqual({ addSection: 'skills' })
  })

  it('karışık biçimlerde azınlıktaki ilk kayda gidilir; sayfa sayısı Görünüm sekmesine', () => {
    const cv = sampleCv()
    const edu = section(cv, 'education').items[0]
    edu.dates = { start: { year: 2020, month: null }, end: { year: 2024, month: null }, current: false }
    const [, b] = section(cv, 'experience').items
    // Örnekteki maddeler noktayla biter: azınlık bu noktasız madde
    b.description = '<ul><li>Noktasız madde</li></ul>'
    const f = review(cv, 2)
    expect(byId(f, 'dates-format')?.target).toEqual({ sectionId: section(cv, 'education').id, itemId: edu.id })
    expect(byId(f, 'pages')?.target).toEqual({ tab: 'appearance' })
    const ends = byId(f, 'bullet-end')
    expect(ends?.severity).toBe('info')
    expect(ends?.target?.itemId).toBe(b.id)
  })
})

describe('reviewPdfText: hedef yok', () => {
  it('yüklenen PDF bulgularında Düzenle hedefi olmaz', () => {
    const f = reviewPdfText(pdf(['Deniz Aksoy', 'Deneyim', '03/2021 – Mar 2024'], 3))
    expect(f.every((x) => !x.target)).toBe(true)
  })
})

// ---------------------------------------------------------------- PDF

function pdf(lines: (string | Partial<PdfTextLine>)[], pageCount = 1): PdfText {
  let y = 40
  const out = lines.map((l) => {
    y += 14
    return typeof l === 'string' ? { text: l, page: 1, x: 40, y } : { text: '', page: 1, x: 40, y, ...l }
  })
  return { pageCount, lines: out, text: out.map((l) => l.text).join('\n'), pageWidth: 595 }
}

const GOOD_TR = [
  'Deniz Aksoy',
  'Frontend Geliştirici · deniz.aksoy@example.com · +90 555 000 00 00 · linkedin.com/in/deniz-aksoy-ornek',
  'Özet',
  'Erişilebilir ve hızlı web arayüzleri geliştiren frontend geliştirici. React ve TypeScript ile tasarım sistemleri kurdum; ürün ekipleriyle yakın çalışıp karmaşık iş akışlarını sade ekranlara dönüştürmeyi seviyorum.',
  'Deneyim',
  'Frontend Geliştirici — Lacivert Yazılım Şub 2024 – Günümüz',
  '• Müşteri panelini React 19 ve TypeScript ile yeniden yazdım; ilk yükleme süresi %38 kısaldı.',
  '• 12 bileşenlik bir tasarım sistemi kurup üç ürün ekibine yaydım.',
  'Yazılım Stajyeri — Martı Teknoloji Haz 2023 – Eyl 2023',
  '• Rezervasyon akışındaki form doğrulamalarını tek bir şema kütüphanesine taşıdım.',
  '• Uçtan uca testlerle kayıt akışındaki üç gerilemeyi yayından önce yakaladım.',
  'Eğitim',
  'Ege Üniversitesi — Bilgisayar Mühendisliği Eyl 2020 – Haz 2024',
  'Beceriler',
  'TypeScript, JavaScript, HTML, CSS, SQL, React, Next.js, Vite, Tailwind CSS, Git, Playwright, Vitest, Figma',
  'Diller',
  'Türkçe (ana dil), İngilizce (ileri, C1) ve bu metin biraz daha uzun olsun diye eklenen birkaç kelime daha var burada.',
]

describe('reviewPdfText', () => {
  it('düzgün Türkçe PDF: iletişim, başlıklar ve tarih biçimi geçer', () => {
    const f = reviewPdfText(pdf(GOOD_TR))
    expect(issues(f)).toEqual([])
    expect(byId(f, 'pdf-email')?.title).toContain('deniz.aksoy@example.com')
    expect(byId(f, 'pdf-phone')?.severity).toBe('ok')
    expect(byId(f, 'pdf-linkedin')?.severity).toBe('ok')
    expect(byId(f, 'pdf-headings')?.detail).toContain('Deneyim, Eğitim, Beceriler')
    expect(byId(f, 'pdf-dates')?.severity).toBe('ok')
    expect(byId(f, 'pdf-dates')?.detail).toContain('Şub 2024')
    expect(byId(f, 'pdf-chars')?.severity).toBe('ok')
    expect(byId(f, 'pdf-columns')?.severity).toBe('ok')
  })

  it('e-posta, telefon ve başlıklar yoksa', () => {
    const f = reviewPdfText(pdf(['Deniz Aksoy', ...Array<string>(30).fill('Rastgele bir cümle burada duruyor ve hiçbir başlık yok.')]))
    expect(byId(f, 'pdf-email')?.severity).toBe('problem')
    expect(byId(f, 'pdf-phone')?.severity).toBe('warn')
    expect(byId(f, 'pdf-h-experience')?.severity).toBe('warn')
    expect(byId(f, 'pdf-h-skills')?.severity).toBe('info')
    expect(byId(f, 'pdf-dates')?.severity).toBe('warn')
  })

  it('çok az metin', () => {
    expect(byId(reviewPdfText(pdf(['Deniz Aksoy', 'deniz@example.com'])), 'pdf-little')?.severity).toBe('warn')
  })

  it('karışık tarih biçimleri', () => {
    const dates = byId(reviewPdfText(pdf([...GOOD_TR, 'Serbest çalışma 03/2019 – 05/2021', 'Kurs 2018-04'])), 'pdf-dates')!
    expect(dates.severity).toBe('warn')
    expect(dates.detail).toContain('03/2019')
    expect(dates.detail).toContain('2018-04')
  })

  it('detectDateStyles biçimleri ayırır ve örneği özgün yazılışla verir', () => {
    const styles = detectDateStyles('01.02.2020, 03/2021 - 04/2022, Mart 2020, Jan 2019, 2019-05, 2015 – 2016, 06.2017')
    expect([...styles.keys()].sort()).toEqual(['dd.mm.yyyy', 'mm.yyyy', 'mm/yyyy', 'month yyyy', 'yyyy', 'yyyy-mm'])
    expect(styles.get('mm/yyyy')?.count).toBe(2)
    expect(styles.get('month yyyy')?.example).toBe('Mart 2020')
    expect(styles.get('yyyy')?.count).toBe(2)
    expect(detectDateStyles('ŞUBAT 2024').get('month yyyy')?.example).toBe('ŞUBAT 2024')
  })

  it('bozuk karakterler', () => {
    const garbled = GOOD_TR.map((l) => l.replace(/ı/g, '�'))
    expect(byId(reviewPdfText(pdf(garbled)), 'pdf-garbled')?.severity).toBe('problem')
    const moji = GOOD_TR.map((l) => l.replace(/ı/g, 'ý').replace(/ş/g, 'þ'))
    expect(byId(reviewPdfText(pdf(moji)), 'pdf-mojibake')?.severity).toBe('warn')
    const dotless = GOOD_TR.map((l) => l.replace(/ı/g, 'i'))
    expect(byId(reviewPdfText(pdf([...dotless, ...dotless])), 'pdf-no-dotless')?.severity).toBe('warn')
    const spaced = GOOD_TR.map((l) => l.split('').join(' '))
    expect(byId(reviewPdfText(pdf(spaced)), 'pdf-spaced')?.severity).toBe('warn')
  })

  it('sütunlar satır satır karışıyorsa uyarır, sırayla okunuyorsa bilgi verir', () => {
    const left = (i: number) => ({ text: `Sol sütundaki uzun bir satır ${i}`, x: 40 })
    const right = (i: number) => ({ text: `Sağ sütundaki uzun bir satır ${i}`, x: 330 })
    const interleaved = pdf(Array.from({ length: 20 }, (_, i) => (i % 2 ? right(i) : left(i))))
    expect(columnInterleaving(interleaved).switches).toBeGreaterThan(6)
    expect(byId(reviewPdfText(interleaved), 'pdf-columns')?.severity).toBe('warn')
    const sequential = pdf([...Array.from({ length: 10 }, (_, i) => left(i)), ...Array.from({ length: 10 }, (_, i) => right(i))])
    expect(byId(reviewPdfText(sequential), 'pdf-columns')?.severity).toBe('info')
  })

  it('sağa yaslı kısa tarihler iki sütun sayılmaz', () => {
    const lines = Array.from({ length: 24 }, (_, i) =>
      i % 2 ? { text: `Mar 20${10 + i}`, x: 500 - (i % 5) * 3 } : { text: `Tek sütunda uzun bir deneyim satırı ${i}`, x: 40 },
    )
    expect(columnInterleaving(pdf(lines)).twoColumn).toBe(false)
  })

  it('her sayfada tekrar eden satır', () => {
    const lines = [
      ...GOOD_TR.map((text) => ({ text, page: 1 })),
      { text: 'Deniz Aksoy — Özgeçmiş', page: 1 },
      ...GOOD_TR.slice(4).map((text) => ({ text: `${text} (devam)`, page: 2 })),
      { text: 'Deniz Aksoy — Özgeçmiş', page: 2 },
    ]
    const f = reviewPdfText(pdf(lines, 2))
    expect(byId(f, 'pdf-repeated')?.title).toContain('Deniz Aksoy — Özgeçmiş')
    expect(byId(f, 'pages')?.severity).toBe('info')
  })

  it('PDF okuma hatası tek sorun bulgusu olur', () => {
    expect(pdfErrorFinding('no_text')).toMatchObject({ severity: 'problem', category: 'okunabilirlik', title: 'Seçilebilir metin yok' })
  })
})
