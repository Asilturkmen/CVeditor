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
    expect(parsed.cvs.every((c) => c.schemaVersion === 2)).toBe(true)
  })

  it('tarayıcı veritabanındaki şema 1 kayıtlar sürüm 2 açılırken yerinde yükseltilir', async () => {
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
    expect(byId.get(klasik.id as string)?.schemaVersion).toBe(2)
    expect(byId.get(modern.id as string)?.templateId).toBe('panel')
    expect(byId.get(modern.id as string)?.template.accentColor).toBe('#abcdef')
    expect(byId.get(modern.id as string)?.template.baseColor).toBeNull()
    // Yükseltilen kayıt şemadan geçer.
    for (const row of rows) expect(() => migrateCv(row)).not.toThrow()
    db.close()
    await Dexie.delete(name)
  })
})
