import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { CvDatabase } from '@/db/db'
import { createCv } from './factory'
import { createBackup, migrateCv, parseBackup } from './migrate'
import { samplePersonal, sampleSections } from './sample'
import { CURRENT_SCHEMA_VERSION } from './schema'

/** Şema 1'deki (Klasik/Modern dönemi) bir CV: baseColor yok. */
function v1Cv(templateId: 'klasik' | 'modern', template: Record<string, unknown> = {}) {
  const sections = sampleSections('tr')
  const cv = createCv({
    name: 'Eski CV',
    language: 'tr',
    templateId,
    template: {
      accentColor: templateId === 'klasik' ? '#1f5f8b' : '#2f6f62',
      baseColor: null,
      font: templateId === 'klasik' ? 'source-serif-4' : 'inter',
      fontSize: 'md',
      spacing: 'normal',
      columns: templateId === 'klasik' ? 1 : 2,
      sideSections: [],
      showPhoto: false,
      headerAlign: 'left',
    },
    personal: samplePersonal('tr'),
    sections,
  })
  const { baseColor: _drop, ...oldTemplate } = cv.template
  void _drop
  return { ...cv, schemaVersion: 1, template: { ...oldTemplate, ...template } } as Record<string, unknown>
}

describe('şema 1 → 2 (10 şablon)', () => {
  it('Klasik Zarif olur; dokunulmamış renk ve yazı tipi Zarif’inkine geçer, içerik aynı kalır', () => {
    const old = v1Cv('klasik')
    const cv = migrateCv(structuredClone(old))
    expect(cv.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(cv.templateId).toBe('zarif')
    expect(cv.template.accentColor).toBe('#7a2e2e')
    expect(cv.template.font).toBe('eb-garamond')
    expect(cv.template.baseColor).toBeNull()
    expect(cv.sections).toEqual(old.sections)
    expect(cv.personal).toEqual(old.personal)
  })

  it('Modern Panel olur; kullanıcının seçtiği renk ve yazı tipi korunur', () => {
    const cv = migrateCv(v1Cv('modern', { accentColor: '#123456', font: 'literata' }))
    expect(cv.templateId).toBe('panel')
    expect(cv.template.accentColor).toBe('#123456')
    expect(cv.template.font).toBe('literata')
  })

  it('sütun sayısı yeni şablonun desteklediğine çekilir', () => {
    expect(migrateCv(v1Cv('klasik', { columns: 2 })).template.columns).toBe(1)
    const panel = migrateCv(v1Cv('modern', { columns: 1, sideSections: [] }))
    expect(panel.template.columns).toBe(2)
    // Boş yan sütun listesi beceri/dil/sertifika bölümleriyle doldurulur.
    const sideTypes = panel.sections.filter((s) => panel.template.sideSections.includes(s.id)).map((s) => s.type)
    expect(sideTypes).toEqual(['skills', 'languages', 'certificates'])
  })

  it('başlık hizası: Klasik’in sola yaslı varsayılanı Zarif’in ortalısına geçer; Modern solda kalır', () => {
    expect(migrateCv(v1Cv('klasik')).template.headerAlign).toBe('center')
    // Klasik'te ortalamış kullanıcı: ortalı kalır
    expect(migrateCv(v1Cv('klasik', { headerAlign: 'center' })).template.headerAlign).toBe('center')
    expect(migrateCv(v1Cv('modern')).template.headerAlign).toBe('left')
    expect(migrateCv(v1Cv('modern', { headerAlign: 'center' })).template.headerAlign).toBe('center')
  })

  it('fotoğraf ayarı göçte değişmez', () => {
    expect(migrateCv(v1Cv('klasik', { showPhoto: false })).template.showPhoto).toBe(false)
    expect(migrateCv(v1Cv('modern', { showPhoto: true })).template.showPhoto).toBe(true)
  })

  it('yedekten geri yüklenen şema 1 CV’leri yükseltilir', () => {
    const backup = { ...createBackup([]), cvs: [v1Cv('klasik'), v1Cv('modern')] }
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.failures).toEqual([])
    expect(parsed.cvs.map((c) => c.templateId)).toEqual(['zarif', 'panel'])
    expect(parsed.cvs.every((c) => c.schemaVersion === CURRENT_SCHEMA_VERSION)).toBe(true)
  })

  it('tarayıcı veritabanındaki şema 1 kayıtlar yeni sürüm açılırken yerinde yükseltilir', async () => {
    const name = `migrate-test-${Math.random().toString(36).slice(2)}`
    const old = new Dexie(name)
    old.version(1).stores({ cvs: 'id, updatedAt, name, language', meta: 'key' })
    const klasik = v1Cv('klasik')
    const modern = v1Cv('modern', { accentColor: '#abcdef' })
    await old.table('cvs').bulkPut([klasik, modern])
    old.close()

    const db = new CvDatabase(name)
    const rows = await db.cvs.toArray()
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(klasik.id as string)?.templateId).toBe('zarif')
    expect(byId.get(klasik.id as string)?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(byId.get(modern.id as string)?.templateId).toBe('panel')
    expect(byId.get(modern.id as string)?.template.accentColor).toBe('#abcdef')
    expect(byId.get(modern.id as string)?.template.baseColor).toBeNull()
    // Yükseltilen kayıt şemadan geçer.
    for (const row of rows) expect(() => migrateCv(row)).not.toThrow()
    db.close()
    await Dexie.delete(name)
  })
})

/** Şema 2'deki (10 şablon) bir CV; `template` alanları istenen eski şablonun varsayılanları. */
const V2_DEFAULTS: Record<string, { accent: string; font: string; align: 'left' | 'center'; columns: 1 | 2; base?: string }> = {
  zarif: { accent: '#7a2e2e', font: 'eb-garamond', align: 'center', columns: 1 },
  panel: { accent: '#2f8f7f', font: 'inter', align: 'left', columns: 2, base: '#1f2a37' },
  bant: { accent: '#0f4c75', font: 'source-sans-3', align: 'left', columns: 2 },
  manset: { accent: '#c2410c', font: 'archivo', align: 'left', columns: 2 },
  gece: { accent: '#d4a85a', font: 'inter', align: 'left', columns: 1, base: '#14171f' },
  isvicre: { accent: '#d62828', font: 'ibm-plex-sans', align: 'left', columns: 1 },
  cizelge: { accent: '#e0663a', font: 'manrope', align: 'left', columns: 1 },
  cift: { accent: '#ffcf70', font: 'space-grotesk', align: 'left', columns: 2, base: '#3d3a7a' },
  afis: { accent: '#ffd400', font: 'archivo', align: 'left', columns: 2 },
  cerceve: { accent: '#8c2f39', font: 'source-sans-3', align: 'left', columns: 2 },
}

function v2Cv(templateId: string, template: Record<string, unknown> = {}) {
  const sections = sampleSections('tr')
  const d = V2_DEFAULTS[templateId]
  const side = sections.filter((s) => ['skills', 'languages', 'certificates'].includes(s.type)).map((s) => s.id)
  const cv = createCv({
    name: 'Eski CV',
    language: 'tr',
    templateId,
    template: {
      accentColor: d.accent,
      baseColor: d.base ?? null,
      font: d.font as 'inter',
      fontSize: 'md',
      spacing: 'normal',
      columns: d.columns,
      sideSections: d.columns === 2 ? side : [],
      showPhoto: true,
      headerAlign: d.align,
    },
    personal: { ...samplePersonal('tr'), photo: 'data:image/jpeg;base64,AAAA' },
    sections,
  })
  return { ...cv, schemaVersion: 2, template: { ...cv.template, ...template } } as Record<string, unknown>
}

describe('şema 2 → 3 (14 şablon)', () => {
  const EXPECTED: Record<string, { id: string; accent: string; font: string; align: 'left' | 'center'; columns: 1 | 2 }> = {
    zarif: { id: 'zarif', accent: '#7a2e2e', font: 'eb-garamond', align: 'center', columns: 1 },
    panel: { id: 'panel', accent: '#1f4e79', font: 'source-sans-3', align: 'left', columns: 2 },
    bant: { id: 'bant', accent: '#14365a', font: 'inter', align: 'left', columns: 2 },
    manset: { id: 'dergi', accent: '#a63d1e', font: 'source-serif-4', align: 'left', columns: 2 },
    gece: { id: 'yonetici', accent: '#1a1a1a', font: 'literata', align: 'left', columns: 1 },
    isvicre: { id: 'isvicre', accent: '#c62828', font: 'ibm-plex-sans', align: 'left', columns: 1 },
    cizelge: { id: 'cizelge', accent: '#3b5b7a', font: 'archivo', align: 'left', columns: 1 },
    cift: { id: 'panel', accent: '#1f4e79', font: 'source-sans-3', align: 'left', columns: 2 },
    afis: { id: 'blok', accent: '#ffd84d', font: 'archivo', align: 'left', columns: 2 },
    // Çerçeve'nin bordosu Dergi'de de hazır takım: aynen kalır.
    cerceve: { id: 'dergi', accent: '#8c2f39', font: 'source-serif-4', align: 'left', columns: 2 },
  }

  for (const [from, want] of Object.entries(EXPECTED)) {
    it(`${from} → ${want.id}: varsayılanda kalan renk, yazı tipi, hiza yeni şablonunkine geçer; içerik aynı`, () => {
      const old = v2Cv(from)
      const cv = migrateCv(structuredClone(old))
      expect(cv.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(cv.templateId).toBe(want.id)
      expect(cv.template.accentColor).toBe(want.accent)
      expect(cv.template.baseColor).toBeNull()
      expect(cv.template.font).toBe(want.font)
      expect(cv.template.headerAlign).toBe(want.align)
      expect(cv.template.columns).toBe(want.columns)
      // İçerik, fotoğraf ve yan sütun listesi dokunulmaz.
      expect(cv.sections).toEqual(old.sections)
      expect(cv.personal).toEqual(old.personal)
      expect(cv.template.sideSections).toEqual((old.template as { sideSections: string[] }).sideSections)
      expect(cv.template.showPhoto).toBe(true)
    })
  }

  it('her eski kimlik var olan bir şablona gider', async () => {
    const { TEMPLATES } = await import('@/render/templates')
    for (const from of Object.keys(V2_DEFAULTS)) expect(Object.keys(TEMPLATES)).toContain(migrateCv(v2Cv(from)).templateId)
  })

  it('özel renk, seçilmiş yazı tipi ve hiza korunur; Panel’in özel zemini kalır', () => {
    const cv = migrateCv(v2Cv('manset', { accentColor: '#123456', font: 'literata', headerAlign: 'center' }))
    expect(cv.templateId).toBe('dergi')
    expect(cv.template.accentColor).toBe('#123456')
    expect(cv.template.font).toBe('literata')
    expect(cv.template.headerAlign).toBe('center')
    const panel = migrateCv(v2Cv('panel', { accentColor: '#123456', baseColor: '#204060' }))
    expect(panel.template.accentColor).toBe('#123456')
    expect(panel.template.baseColor).toBe('#204060')
    // Gece ve Çift Ton'un zemini yeni şablonda anlamsız: özel renkte de sıfırlanır.
    expect(migrateCv(v2Cv('gece', { accentColor: '#123456', baseColor: '#204060' })).template.baseColor).toBeNull()
    expect(migrateCv(v2Cv('cift', { accentColor: '#123456', baseColor: '#204060' })).template.accentColor).toBe('#123456')
  })

  it('eski hazır takım yeni şablonda da hazır takımsa o renk kalır (İsviçre kobalt, Zarif lacivert)', () => {
    expect(migrateCv(v2Cv('isvicre', { accentColor: '#1f4fd1' })).template.accentColor).toBe('#1f4fd1')
    expect(migrateCv(v2Cv('zarif', { accentColor: '#1F3A5F' })).template.accentColor).toBe('#1f3a5f')
    // Eski takımı yeni şablonda olmayan: yeni varsayılan
    expect(migrateCv(v2Cv('cizelge', { accentColor: '#0f766e' })).template.accentColor).toBe('#3b5b7a')
  })

  it('sütun: destekleniyorsa kalır, değilse yeni şablonun varsayılanı; iki sütuna geçince boş yan liste dolar', () => {
    expect(migrateCv(v2Cv('manset', { columns: 1 })).template.columns).toBe(1)
    expect(migrateCv(v2Cv('bant', { columns: 1 })).template.columns).toBe(1)
    const panel = migrateCv(v2Cv('cift', { columns: 1, sideSections: [] }))
    expect(panel.template.columns).toBe(2)
    expect(panel.sections.filter((s) => panel.template.sideSections.includes(s.id)).map((s) => s.type)).toEqual(['skills', 'languages', 'certificates'])
  })

  it('bilinmeyen kimlik olduğu gibi kalır (çizimde varsayılana düşer)', () => {
    const cv = migrateCv(v2Cv('zarif', {}))
    expect(migrateCv({ ...v2Cv('zarif'), templateId: 'yok' }).templateId).toBe('yok')
    expect(cv.templateId).toBe('zarif')
  })

  it('tarayıcı veritabanındaki şema 2 kayıtlar sürüm 3 açılırken yerinde yükseltilir', async () => {
    const name = `migrate3-test-${Math.random().toString(36).slice(2)}`
    const old = new Dexie(name)
    old.version(2).stores({ cvs: 'id, updatedAt, name, language', meta: 'key' })
    const gece = v2Cv('gece')
    const afis = v2Cv('afis', { accentColor: '#abcdef' })
    await old.table('cvs').bulkPut([gece, afis])
    old.close()

    const db = new CvDatabase(name)
    const rows = await db.cvs.toArray()
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(gece.id as string)?.templateId).toBe('yonetici')
    expect(byId.get(gece.id as string)?.schemaVersion).toBe(3)
    expect(byId.get(afis.id as string)?.templateId).toBe('blok')
    expect(byId.get(afis.id as string)?.template.accentColor).toBe('#abcdef')
    for (const row of rows) expect(() => migrateCv(row)).not.toThrow()
    db.close()
    await Dexie.delete(name)
  })
})