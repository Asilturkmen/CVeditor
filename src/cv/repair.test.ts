import { describe, expect, it } from 'vitest'
import { initialCvLanguage } from './locale'
import { FIRST_LISTED_YEAR, yearOptions } from './dates'
import { createCv } from './factory'
import { createBackup, describeCvError, migrateCv, parseBackup, repairRawCv } from './migrate'
import { isSafePhoto } from './photo'
import { samplePersonal, sampleSections } from './sample'
import { CvSchema, type AnyItem, type Cv } from './schema'
import { templateSettingsFor } from '@/render/templates'

function sampleCv(): Cv {
  const sections = sampleSections('tr')
  return createCv({
    name: 'Örnek',
    language: 'tr',
    templateId: 'panel',
    template: templateSettingsFor('panel', sections),
    personal: samplePersonal('tr'),
    sections,
  })
}

const raw = (cv: Cv) => JSON.parse(JSON.stringify(cv)) as Record<string, unknown> & Cv

describe('tarih onarımı', () => {
  it('geçersiz updatedAt / createdAt CV\'yi reddettirmez; şimdiki zamana çekilir', () => {
    for (const bad of ['dün', '', 'not-a-date', 12345, null, undefined, {}]) {
      const before = Date.now()
      const cv = migrateCv({ ...raw(sampleCv()), updatedAt: bad, createdAt: bad })
      for (const value of [cv.updatedAt, cv.createdAt]) {
        expect(Number.isFinite(Date.parse(value)), String(bad)).toBe(true)
        expect(Date.parse(value)).toBeGreaterThanOrEqual(before - 1)
      }
      // Liste ekranının kullandığı biçimleyici bu değerle çalışır.
      expect(() => new Intl.DateTimeFormat('tr', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(cv.updatedAt))).not.toThrow()
    }
  })

  it('geçerli tarihe dokunmaz; ISO olmayan geçerli tarihi ISO yapar (sıralama metinle yapılır)', () => {
    const cv = sampleCv()
    expect(migrateCv(raw(cv)).updatedAt).toBe(cv.updatedAt)
    const fixed = migrateCv({ ...raw(cv), updatedAt: '2024-03-05', createdAt: 'March 1, 2024 10:00:00 UTC' })
    expect(fixed.updatedAt).toBe('2024-03-05T00:00:00.000Z')
    expect(fixed.createdAt).toBe('2024-03-01T10:00:00.000Z')
  })

  it('yedekteki geçersiz tarihli CV geri yüklenir (okunamayanlara düşmez)', () => {
    const cv = raw(sampleCv())
    const parsed = parseBackup(JSON.stringify({ ...createBackup([]), cvs: [{ ...cv, updatedAt: 'bozuk' }] }))
    expect(parsed.failures).toEqual([])
    expect(parsed.cvs).toHaveLength(1)
    expect(Number.isFinite(Date.parse(parsed.cvs[0].updatedAt))).toBe(true)
  })
})

describe('fotoğraf', () => {
  it('yalnız gömülü görsel güvenlidir', () => {
    expect(isSafePhoto('data:image/jpeg;base64,AAAA')).toBe(true)
    expect(isSafePhoto('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    for (const bad of ['https://ornek.com/a.jpg', '//ornek.com/a.jpg', 'data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA', 'javascript:alert(1)', '', null, 5]) {
      expect(isSafePhoto(bad), String(bad)).toBe(false)
    }
  })

  it('güvenli olmayan fotoğraf göçte/geri yüklemede null olur; CV reddedilmez', () => {
    for (const bad of ['https://izleyici.ornek.com/piksel.gif', 'data:image/svg+xml;utf8,<svg onload=alert(1)>', 42]) {
      const data = raw(sampleCv())
      const cv = migrateCv({ ...data, personal: { ...data.personal, photo: bad } })
      expect(cv.personal.photo).toBeNull()
      expect(cv.personal.fullName).toBe(data.personal.fullName)
    }
    const safe = raw(sampleCv())
    safe.personal.photo = 'data:image/jpeg;base64,AAAA'
    expect(migrateCv(safe).personal.photo).toBe('data:image/jpeg;base64,AAAA')
    // Şema da aynı denetimi yapar (onarımdan geçmeyen veri uzak adres taşıyamaz).
    const unsafe = raw(sampleCv())
    unsafe.personal.photo = 'https://ornek.com/a.jpg'
    expect(CvSchema.safeParse(unsafe).success).toBe(false)
  })
})

describe('id tekilliği', () => {
  it('aynı id iki kayıtta varsa ikincisi yeni id alır; çeviri bağı korunur', () => {
    const data = raw(sampleCv())
    const experience = data.sections.find((s) => s.type === 'experience')!
    const items = experience.items as AnyItem[]
    const original = items[0]
    items.push({ ...original, position: 'Kopya (aynı bölüm)' } as AnyItem)
    // Başka bölümde de aynı id
    const skills = data.sections.find((s) => s.type === 'skills')!
    ;(skills.items as AnyItem[])[0].id = original.id

    const cv = migrateCv(data)
    const all = cv.sections.flatMap((s) => s.items as AnyItem[])
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length)
    const fixedExperience = cv.sections.find((s) => s.type === 'experience')!.items as AnyItem[]
    expect(fixedExperience[0].id).toBe(original.id)
    const copy = fixedExperience[fixedExperience.length - 1]
    expect(copy.id).not.toBe(original.id)
    expect(copy.translationGroupId).toBe(original.translationGroupId)
    expect((copy as unknown as { position: string }).position).toBe('Kopya (aynı bölüm)')
  })

  it('aynı id iki bölümde varsa ikincisi yeni id alır; yan sütun yerleşimi değişmez', () => {
    const data = raw(sampleCv())
    const skills = data.sections.find((s) => s.type === 'skills')!
    const languages = data.sections.find((s) => s.type === 'languages')!
    expect(data.template.sideSections).toContain(skills.id)
    data.template.sideSections = data.template.sideSections.filter((id) => id !== languages.id)
    languages.id = skills.id

    const cv = migrateCv(data)
    expect(new Set(cv.sections.map((s) => s.id)).size).toBe(cv.sections.length)
    const fixedSkills = cv.sections.find((s) => s.type === 'skills')!
    const fixedLanguages = cv.sections.find((s) => s.type === 'languages')!
    expect(fixedSkills.id).toBe(skills.id)
    expect(fixedLanguages.id).not.toBe(skills.id)
    // İkisi de aynı id'yle yan sütundaydı: ikisi de yan sütunda kalır.
    expect(cv.template.sideSections).toEqual(expect.arrayContaining([fixedSkills.id, fixedLanguages.id]))
  })

  it('kusursuz CV\'ye dokunmaz (aynı nesneler)', () => {
    const data = raw(sampleCv())
    const repaired = repairRawCv(data)
    expect(repaired.sections).toBe(data.sections)
    expect(repaired.personal).toBe(data.personal)
    expect(repaired.template).toBe(data.template)
    expect(migrateCv(data)).toEqual(data)
  })
})

describe('okunamayan CV\'nin nedeni', () => {
  it('ham doğrulama çıktısı değil, kısa ve anlaşılır cümledir', () => {
    const good = raw(sampleCv())
    const broken = raw(sampleCv())
    ;(broken.sections[1].items as unknown as Record<string, unknown>[])[0].hidden = 'evet'
    const noPersonal = { ...raw(sampleCv()), personal: { fullName: 5 } }
    const parsed = parseBackup(
      JSON.stringify({ ...createBackup([]), cvs: [good, broken, noPersonal, 'metin', { ...good, schemaVersion: 99 }] }),
    )
    expect(parsed.cvs).toHaveLength(1)
    expect(parsed.failures.map((f) => f.reason)).toEqual([
      'Eksik ya da bozuk veri: 2. bölümün 1. kaydı',
      'Eksik ya da bozuk veri: Kişisel bilgiler',
      'CV verisi okunamadı',
      'Bu CV daha yeni bir CVeditör sürümüyle kaydedilmiş',
    ])
    for (const failure of parsed.failures) {
      expect(failure.reason).not.toMatch(/[[{]|expected|invalid_type/i)
      expect(failure.reason.length).toBeLessThan(80)
    }
  })

  it('beklenmeyen hata ham hâliyle gösterilmez', () => {
    expect(describeCvError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe('CV verisi okunamadı')
    expect(describeCvError('dizgi')).toBe('CV verisi okunamadı')
  })
})

describe('tarih seçicinin yıl listesi', () => {
  it('gelecek 5 yıldan alt sınıra, yeniden eskiye', () => {
    const years = yearOptions(null, 2026)
    expect(years[0]).toBe(2031)
    expect(years[years.length - 1]).toBe(FIRST_LISTED_YEAR)
    expect(years).toHaveLength(2031 - FIRST_LISTED_YEAR + 1)
  })

  it('kayıttaki yıl aralık dışındaysa da listededir (boş görünüp kaybolmaz)', () => {
    expect(yearOptions(1955, 2026).at(-1)).toBe(1955)
    expect(yearOptions(1900, 2026)).toContain(1900)
    expect(yearOptions(2040, 2026)[0]).toBe(2040)
    expect(yearOptions(2100, 2026)).toContain(2100)
    // Aralıktaki yıl listeyi değiştirmez.
    expect(yearOptions(2000, 2026)).toEqual(yearOptions(null, 2026))
    // Sıra bozulmaz, yinelenen yıl olmaz.
    for (const current of [1955, 2040]) {
      const years = yearOptions(current, 2026)
      expect([...years].sort((a, b) => b - a)).toEqual(years)
      expect(new Set(years).size).toBe(years.length)
    }
  })
})

describe('yeni CV\'nin dili', () => {
  it('arayüz dilini izler', () => {
    expect(initialCvLanguage('tr')).toBe('tr')
    expect(initialCvLanguage('en')).toBe('en')
    expect(initialCvLanguage('de')).toBe('tr')
  })
})
