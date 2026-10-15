import { describe, expect, it } from 'vitest'
import { templateSettingsFor } from '@/render/templates'
import { formatDateRange, formatYearMonth, isRangeInverted } from './dates'
import { createCv, createItem, defaultSections, duplicateCv, isItemEmpty } from './factory'
import { createBackup, migrateCv, parseBackup } from './migrate'
import { samplePersonal, sampleSections } from './sample'
import { CvSchema } from './schema'

function sampleCv(language: 'tr' | 'en' = 'tr') {
  const sections = sampleSections(language)
  return createCv({
    name: 'Örnek',
    language,
    templateId: 'modern',
    template: templateSettingsFor('modern', sections),
    personal: samplePersonal(language),
    sections,
  })
}

describe('tarihler', () => {
  it('ay ve yılı CV diline göre yazar', () => {
    expect(formatYearMonth({ year: 2026, month: 1 }, 'tr')).toBe('Oca 2026')
    expect(formatYearMonth({ year: 2026, month: 1 }, 'en')).toBe('Jan 2026')
    expect(formatYearMonth({ year: 2026, month: null }, 'tr')).toBe('2026')
    expect(formatYearMonth(null, 'tr')).toBe('')
  })

  it('devam eden aralıkta "Günümüz / Present" yazar', () => {
    const range = { start: { year: 2024, month: 2 }, end: null, current: true }
    expect(formatDateRange(range, 'tr')).toBe('Şub 2024 – Günümüz')
    expect(formatDateRange(range, 'en')).toBe('Feb 2024 – Present')
  })

  it('tek tarih ve eşit uçlar tekrarlanmaz', () => {
    expect(formatDateRange({ start: { year: 2020, month: null }, end: null, current: false }, 'tr')).toBe('2020')
    expect(
      formatDateRange({ start: { year: 2020, month: 5 }, end: { year: 2020, month: 5 }, current: false }, 'en'),
    ).toBe('May 2020')
  })

  it('ters aralığı yakalar', () => {
    expect(isRangeInverted({ start: { year: 2024, month: 5 }, end: { year: 2023, month: 1 }, current: false })).toBe(true)
    expect(isRangeInverted({ start: { year: 2024, month: 5 }, end: { year: 2023, month: 1 }, current: true })).toBe(false)
    expect(isRangeInverted({ start: { year: 2024, month: null }, end: { year: 2024, month: 3 }, current: false })).toBe(false)
  })
})

describe('CV oluşturma', () => {
  it('boş ve örnek CV şemaya uyar', () => {
    const sections = defaultSections()
    const blank = createCv({
      name: 'Genel TR',
      language: 'tr',
      templateId: 'klasik',
      template: templateSettingsFor('klasik', sections),
      sections,
    })
    expect(CvSchema.safeParse(blank).success).toBe(true)
    expect(CvSchema.safeParse(sampleCv()).success).toBe(true)
  })

  it('her kayıt kendi kalıcı id ve çeviri grubuyla doğar', () => {
    const a = createItem('experience')
    const b = createItem('experience')
    expect(a.id).not.toBe(b.id)
    expect(a.translationGroupId).not.toBe(a.id)
    expect(a.translationGroupId).not.toBe(b.translationGroupId)
  })

  it('kopyalama yeni id verir ama çeviri bağını korur', () => {
    const source = sampleCv()
    const copy = duplicateCv(source, { name: 'Kopya', language: 'en' })
    expect(copy.id).not.toBe(source.id)
    expect(copy.language).toBe('en')
    const srcItem = source.sections[1].items[0]
    const copyItem = copy.sections[1].items[0]
    expect(copyItem.id).not.toBe(srcItem.id)
    expect(copyItem.translationGroupId).toBe(srcItem.translationGroupId)
    // Yan sütun ayarı yeni bölüm id'lerine taşınır.
    const skillsCopy = copy.sections.find((s) => s.type === 'skills')!
    expect(copy.template.sideSections).toContain(skillsCopy.id)
    expect(copy.template.sideSections).not.toContain(source.sections.find((s) => s.type === 'skills')!.id)
    // Kaynak değişmez.
    expect(source.sections[1].items[0].id).toBe(srcItem.id)
  })

  it('boş kaydı tanır', () => {
    const item = createItem('experience')
    expect(isItemEmpty(item)).toBe(true)
    expect(isItemEmpty({ ...item, description: '<p></p>' })).toBe(true)
    expect(isItemEmpty({ ...item, position: 'Stajyer' })).toBe(false)
    expect(isItemEmpty({ ...item, dates: { start: { year: 2024, month: null }, end: null, current: false } })).toBe(false)
  })
})

describe('yedek', () => {
  it('yedek alıp geri okur (kayıpsız)', () => {
    const cvs = [sampleCv('tr'), sampleCv('en')]
    const parsed = parseBackup(JSON.stringify(createBackup(cvs)))
    expect(parsed.failures).toEqual([])
    expect(parsed.cvs).toEqual(cvs)
  })

  it('bozuk ya da yabancı dosyayı açık hatayla reddeder', () => {
    expect(() => parseBackup('{bozuk')).toThrow('geçerli bir JSON değil')
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow('CVeditör yedeği değil')
    expect(() => parseBackup(JSON.stringify({ ...createBackup([]), formatVersion: 99 }))).toThrow('daha yeni')
  })

  it('okunamayan CV diğerlerini engellemez', () => {
    const good = sampleCv()
    const backup = createBackup([good])
    const text = JSON.stringify({ ...backup, cvs: [good, { name: 'Bozuk', schemaVersion: 1 }] })
    const parsed = parseBackup(text)
    expect(parsed.cvs).toHaveLength(1)
    expect(parsed.failures).toHaveLength(1)
    expect(parsed.failures[0].name).toBe('Bozuk')
  })

  it('gelecek şema sürümünü reddeder', () => {
    expect(() => migrateCv({ ...sampleCv(), schemaVersion: 2 })).toThrow('daha yeni')
  })
})
