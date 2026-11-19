import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCv, duplicateCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { deleteCv, restoreCv, saveCvIfUnchanged, updateStoredCv, versionOf } from '@/db/repo'
import { templateSettingsFor } from '@/render/templates'
import { copyItemToCv, setPersonal, setTemplateSetting } from './actions'
import { hasUnsavedChanges, useEditor } from './store'

/**
 * İki sekme ve kayıt hatası: CV yalnız tarayıcıda durur, sessiz veri kaybı en ağır hatadır.
 * "Başka sekme" burada aynı veritabanına doğrudan yazan koddur (Dexie liveQuery sekmeler arasında
 * da aynı bildirimi verir).
 */

function sampleCv(name = 'Test'): Cv {
  const sections = sampleSections('tr')
  return createCv({
    name,
    language: 'tr',
    templateId: 'zarif',
    template: templateSettingsFor('zarif', sections),
    personal: samplePersonal('tr'),
    sections,
  })
}

const state = () => useEditor.getState()
const stored = async (id: string) => (await db.cvs.get(id))!

/** Kayıtlı CV'yi editöre yükler (editör sayfasının yaptığı gibi: satırın sürümüyle). */
async function openStored(name = 'Test'): Promise<Cv> {
  const cv = sampleCv(name)
  await db.cvs.put(cv)
  state().load(structuredClone(cv), versionOf(cv))
  return cv
}

/** Başka sekmenin yazması: satırı okur, değiştirir, yeni sürümle yazar. */
async function otherTabWrites(id: string, headline: string) {
  await updateStoredCv(id, (cv) => {
    cv.personal.headline = headline
  })
}

beforeEach(async () => {
  state().unload()
  await db.cvs.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  state().unload()
})

describe('sürüm denetimli kayıt (repo)', () => {
  it('satır beklenen sürümdeyse yazar; değiştiyse ya da silindiyse yazmaz ve nedenini söyler', async () => {
    const cv = sampleCv()
    // Satır yokken beklenen sürüm null: ilk kayıt.
    expect(await saveCvIfUnchanged(cv, null)).toEqual({ ok: true })
    // Satır varken "yok" beklemek: üzerine yazılmaz.
    expect(await saveCvIfUnchanged({ ...cv, name: 'Ezen' }, null)).toEqual({ ok: false, reason: 'changed' })
    expect((await stored(cv.id)).name).toBe('Test')

    const next = { ...cv, name: 'Yeni ad', updatedAt: '2030-01-01T00:00:00.000Z' }
    expect(await saveCvIfUnchanged(next, cv.updatedAt)).toEqual({ ok: true })
    // Bayat sürümle gelen kayıt reddedilir.
    expect(await saveCvIfUnchanged({ ...cv, name: 'Bayat' }, cv.updatedAt)).toEqual({ ok: false, reason: 'changed' })
    expect((await stored(cv.id)).name).toBe('Yeni ad')

    await deleteCv(cv.id)
    expect(await saveCvIfUnchanged(next, next.updatedAt)).toEqual({ ok: false, reason: 'deleted' })
    expect(await db.cvs.get(cv.id)).toBeUndefined()
  })

  it('silmenin geri alınması var olan (daha yeni) CV\'nin üzerine yazmaz', async () => {
    const cv = sampleCv()
    await db.cvs.put(cv)
    const removed = (await deleteCv(cv.id))!
    await db.cvs.put({ ...cv, name: 'Yeniden kaydedilen' })
    expect(await restoreCv(removed)).toBe(false)
    expect((await stored(cv.id)).name).toBe('Yeniden kaydedilen')
    await db.cvs.delete(cv.id)
    expect(await restoreCv(removed)).toBe(true)
    expect((await stored(cv.id)).name).toBe('Test')
  })
})

describe('editör kaydı', () => {
  it('flush yazar ve başarıyı bildirir; art arda kayıtlar kendi kendisiyle çakışmaz', async () => {
    const cv = await openStored()
    setPersonal('headline', 'Bir')
    expect(state().saveState).toBe('pending')
    expect(hasUnsavedChanges()).toBe(true)
    const first = state().flush()
    setPersonal('headline', 'İki')
    const second = state().flush()
    expect(await first).toEqual({ ok: true })
    expect(await second).toEqual({ ok: true })
    expect(state().saveState).toBe('saved')
    expect(hasUnsavedChanges()).toBe(false)
    expect((await stored(cv.id)).personal.headline).toBe('İki')
    // Değişiklik yokken flush yazmadan başarı döner.
    expect(await state().flush()).toEqual({ ok: true })
  })

  it('her değişiklik ayrı bir sürüm alır (aynı milisaniyede de)', async () => {
    await openStored()
    const seen = new Set<string>([state().cv!.updatedAt])
    for (let i = 0; i < 20; i++) {
      setPersonal('headline', `Unvan ${i}`)
      seen.add(state().cv!.updatedAt)
    }
    expect(seen.size).toBe(21)
  })

  it('kayıt hatası yutulmaz: flush başarısızlığı bildirir, durum "error" olur, yeniden deneme yazar', async () => {
    const cv = await openStored()
    const put = vi.spyOn(db.cvs, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setPersonal('headline', 'Kaybolmamalı')
    expect(await state().flush()).toEqual({ ok: false, reason: 'error' })
    expect(state().saveState).toBe('error')
    expect(hasUnsavedChanges()).toBe(true)
    // Değişiklik bellekte duruyor, veritabanında eski hâl var.
    expect(state().cv!.personal.headline).toBe('Kaybolmamalı')
    expect((await stored(cv.id)).personal.headline).toBe(cv.personal.headline)
    // "Yeniden dene"
    expect(await state().flush()).toEqual({ ok: true })
    expect(put).toHaveBeenCalledTimes(2)
    expect(state().saveState).toBe('saved')
    expect((await stored(cv.id)).personal.headline).toBe('Kaybolmamalı')
  })

  it('kendi kayıtları "başka sekme değiştirdi" sayılmaz: geri alma geçmişi durur', async () => {
    await openStored()
    for (const value of ['a', 'b', 'c']) {
      setPersonal('email', `${value}@ornek.com`)
      setPersonal('headline', value)
      await state().flush()
    }
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(state().remoteLoads).toBe(0)
    expect(state().saveState).toBe('saved')
    expect(state().past.length).toBeGreaterThan(0)
  })
})

describe('iki sekme', () => {
  it('bayat sekme diğerinin yazdığını ezmez: yazmaz, çakışma bildirir', async () => {
    const cv = await openStored()
    await otherTabWrites(cv.id, 'Diğer sekmenin unvanı')
    setPersonal('fullName', 'Bu Sekme')
    expect(await state().flush()).toEqual({ ok: false, reason: 'conflict' })
    expect(state().saveState).toBe('conflict')
    expect(state().conflict).toBe('changed')
    const row = await stored(cv.id)
    expect(row.personal.headline).toBe('Diğer sekmenin unvanı')
    expect(row.personal.fullName).toBe(cv.personal.fullName)
    // Çakışma çözülmeden yapılan değişiklik de yazılmaz ama bellekte kalır.
    setPersonal('email', 'yeni@ornek.com')
    expect(state().saveState).toBe('conflict')
    expect(await state().flush()).toEqual({ ok: false, reason: 'conflict' })
    expect(state().cv!.personal.email).toBe('yeni@ornek.com')
    expect((await stored(cv.id)).personal.email).toBe(cv.personal.email)
  })

  it('"Benimkini kaydet" açık seçimle üzerine yazar; sonraki kayıtlar yeniden çalışır', async () => {
    const cv = await openStored()
    await otherTabWrites(cv.id, 'Diğer')
    setPersonal('fullName', 'Bu Sekme')
    await state().flush()
    expect(await state().resolveConflict('mine')).toEqual({ ok: true })
    expect(state().saveState).toBe('saved')
    expect(state().conflict).toBeNull()
    const row = await stored(cv.id)
    expect(row.personal.fullName).toBe('Bu Sekme')
    expect(row.personal.headline).toBe(cv.personal.headline)
    setPersonal('headline', 'Sonraki')
    expect(await state().flush()).toEqual({ ok: true })
    expect((await stored(cv.id)).personal.headline).toBe('Sonraki')
  })

  it('"Diğer sürümü yükle" veritabanındakini alır; geri alma geçmişi sıfırlanır', async () => {
    const cv = await openStored()
    await otherTabWrites(cv.id, 'Diğer')
    setPersonal('fullName', 'Bu Sekme')
    await state().flush()
    expect(await state().resolveConflict('theirs')).toEqual({ ok: true })
    expect(state().saveState).toBe('saved')
    expect(state().cv!.personal.headline).toBe('Diğer')
    expect(state().cv!.personal.fullName).toBe(cv.personal.fullName)
    expect(state().past).toHaveLength(0)
    setPersonal('email', 'sonra@ornek.com')
    expect(await state().flush()).toEqual({ ok: true })
    expect((await stored(cv.id)).personal).toMatchObject({ headline: 'Diğer', email: 'sonra@ornek.com' })
  })

  it('bekleyen değişiklik yokken başka sekmenin değişikliği kendiliğinden yüklenir', async () => {
    const cv = await openStored()
    setPersonal('email', 'once@ornek.com')
    await state().flush()
    expect(state().past).toHaveLength(1)
    await otherTabWrites(cv.id, 'Uzaktan gelen')
    await vi.waitFor(() => expect(state().cv!.personal.headline).toBe('Uzaktan gelen'))
    expect(state().saveState).toBe('saved')
    expect(state().remoteLoads).toBe(1)
    expect(state().past).toHaveLength(0)
    // Yüklenen sürümün üstüne yapılan değişiklik çakışmadan yazılır.
    setPersonal('fullName', 'Devam')
    expect(await state().flush()).toEqual({ ok: true })
    expect((await stored(cv.id)).personal).toMatchObject({ headline: 'Uzaktan gelen', fullName: 'Devam', email: 'once@ornek.com' })
  })

  it('bekleyen değişiklik varken başka sekme yazarsa kayıt beklemeden çakışma bildirilir', async () => {
    const cv = await openStored()
    setPersonal('fullName', 'Yazılıyor')
    await otherTabWrites(cv.id, 'Diğer')
    await vi.waitFor(() => expect(state().saveState).toBe('conflict'))
    expect(state().conflict).toBe('changed')
    expect(state().cv!.personal.fullName).toBe('Yazılıyor')
    // Bekleyen otomatik kayıt iptal edildi: süre geçse de diğerinin yazdığı ezilmez.
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect((await stored(cv.id)).personal.fullName).toBe(cv.personal.fullName)
  })

  it('başka sekmede silinen CV bu sekmenin kaydıyla geri gelmez; "Yeniden kaydet" geri getirir', async () => {
    const cv = await openStored()
    setPersonal('fullName', 'Silinirken yazılan')
    await deleteCv(cv.id)
    expect(await state().flush()).toEqual({ ok: false, reason: 'conflict' })
    expect(state().conflict).toBe('deleted')
    expect(await db.cvs.get(cv.id)).toBeUndefined()
    // Silinmişken "diğer sürüm" yoktur.
    expect((await state().resolveConflict('theirs')).ok).toBe(false)
    expect(state().cv!.personal.fullName).toBe('Silinirken yazılan')
    expect(await state().resolveConflict('mine')).toEqual({ ok: true })
    expect((await stored(cv.id)).personal.fullName).toBe('Silinirken yazılan')
    expect(state().saveState).toBe('saved')
  })

  it('değişiklik yokken başka sekmede silinirse bildirilir; silme geri alınırsa uyarı kalkar', async () => {
    const cv = await openStored()
    const removed = (await deleteCv(cv.id))!
    await vi.waitFor(() => expect(state().saveState).toBe('conflict'))
    expect(state().conflict).toBe('deleted')
    expect(state().cv).not.toBeNull()
    await restoreCv(removed)
    await vi.waitFor(() => expect(state().saveState).toBe('saved'))
    expect(state().conflict).toBeNull()
  })

  it('başka CV\'den "bu CV\'ye kayıt ekle" açık editörün altından yazmaz: yüklenir ya da çakışır', async () => {
    const source = sampleCv('Kaynak')
    const item = source.sections.find((s) => s.type === 'experience')!.items[0] as AnyItem
    const target = duplicateCv(source, { name: 'Hedef' })
    target.sections = target.sections.filter((s) => s.type !== 'experience')
    await db.cvs.put(target)
    state().load(structuredClone(target), versionOf(target))

    // Editörde bekleyen değişiklik yok: eklenen kayıt kendiliğinden görünür.
    await copyItemToCv(target.id, 'experience', item)
    await vi.waitFor(() => expect(state().cv!.sections.some((s) => s.type === 'experience')).toBe(true))
    expect(state().saveState).toBe('saved')

    // Editörde bekleyen değişiklik var: eklenen kayıt ezilmez, çakışma bildirilir.
    setPersonal('fullName', 'Hedefte yazılan')
    await copyItemToCv(target.id, 'experience', item)
    expect(await state().flush()).toEqual({ ok: false, reason: 'conflict' })
    const row = await stored(target.id)
    expect(row.sections.find((s) => s.type === 'experience')!.items).toHaveLength(2)
    expect(row.personal.fullName).toBe(target.personal.fullName)
  })

  it('kayıtlı olmayan CV (sürüm verilmeden yüklenen) var olan satırın üzerine yazmaz', async () => {
    const cv = sampleCv()
    await db.cvs.put({ ...cv, name: 'Veritabanındaki' })
    state().load(structuredClone(cv))
    // Satır var ama editör "yok" sanıyor: izleyici veritabanındakini yükler, hiçbir şey ezilmez.
    await vi.waitFor(() => expect(state().cv!.name).toBe('Veritabanındaki'))
    expect((await stored(cv.id)).name).toBe('Veritabanındaki')
  })

  it('editör başka CV\'ye geçince süren kaydın sonucu yeni CV\'nin durumuna dokunmaz', async () => {
    const first = await openStored('Birinci')
    setPersonal('headline', 'Birincinin son hâli')
    const pending = state().flush()
    const second = sampleCv('İkinci')
    await db.cvs.put(second)
    state().load(structuredClone(second), versionOf(second))
    expect(await pending).toEqual({ ok: true })
    expect(state().cv!.id).toBe(second.id)
    expect(state().saveState).toBe('saved')
    expect((await stored(first.id)).personal.headline).toBe('Birincinin son hâli')
    setPersonal('headline', 'İkincide')
    expect(await state().flush()).toEqual({ ok: true })
    expect((await stored(second.id)).personal.headline).toBe('İkincide')
  })
})

describe('geri alma geçmişi', () => {
  it('renk seçicisinin sürüklenmesi tek adımdır (vurgu ve özel zemin)', async () => {
    await openStored()
    for (let i = 0; i < 60; i++) setTemplateSetting('baseColor', `#0000${(i + 16).toString(16)}`)
    expect(state().past).toHaveLength(1)
    for (let i = 0; i < 60; i++) setTemplateSetting('accentColor', `#00${(i + 16).toString(16)}00`)
    expect(state().past).toHaveLength(2)
    const before = state().cv!.template.accentColor
    state().undo()
    expect(state().cv!.template.accentColor).not.toBe(before)
    state().undo()
    expect(state().cv!.template.baseColor).toBeNull()
    // Sürüklenmeyen ayarlar birleşmez.
    setTemplateSetting('fontSize', 'sm')
    setTemplateSetting('fontSize', 'lg')
    expect(state().past).toHaveLength(2)
  })

  it('renk seçicisinin bir açılışı, arada uzun duraklansa da tek adımdır; yeni açılış yeni adım', async () => {
    await openStored()
    let now = Date.parse('2030-01-01T00:00:00.000Z')
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    for (let i = 0; i < 10; i++) {
      setTemplateSetting('baseColor', `#1020${(i + 16).toString(16)}`, 'oturum-1')
      now += 5000
    }
    expect(state().past).toHaveLength(1)
    setTemplateSetting('baseColor', '#ffffff', 'oturum-2')
    expect(state().past).toHaveLength(2)
    // Aynı renk ayarı oturumsuz (ör. klavye) geldiğinde de oturumla birleşmez.
    setTemplateSetting('baseColor', '#eeeeee')
    expect(state().past).toHaveLength(3)
    state().undo()
    state().undo()
    expect(state().cv!.template.baseColor).toBe('#1020' + (9 + 16).toString(16))
    state().undo()
    expect(state().cv!.template.baseColor).toBeNull()
  })
})
