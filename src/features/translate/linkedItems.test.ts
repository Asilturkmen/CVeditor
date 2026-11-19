import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCv, duplicateCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { versionOf } from '@/db/repo'
import { setPersonal } from '@/editor/actions'
import { useEditor } from '@/editor/store'
import { templateSettingsFor } from '@/render/templates'
import { replaceLinkedItem } from './linkedItems'

/**
 * "Bağlı kaydı güncelle" (başka CV'ye ekle): hedef CV başka sekmede/editörde açıkken
 * sürüm denetimini atlamamalı. Editörün bekleyen değişikliği varsa ezilmez (çakışma),
 * yoksa güncellenen kayıt editöre kendiliğinden gelir.
 */

function sampleCv(name: string): Cv {
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
const experience = (cv: Cv) => cv.sections.find((s) => s.type === 'experience')!.items as AnyItem[]

/** Kaynak CV ve aynı çeviri gruplarını taşıyan hedef (bağlı kayıtlar). */
async function linkedPair() {
  const source = sampleCv('Kaynak')
  const target = duplicateCv(source, { name: 'Hedef' })
  await db.cvs.put(target)
  const item = { ...structuredClone(experience(source)[0]), position: 'Güncellenen pozisyon' } as AnyItem
  return { target, item }
}

beforeEach(async () => {
  state().unload()
  await db.cvs.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  state().unload()
})

describe('replaceLinkedItem', () => {
  it('bağlı kaydı değiştirir; id, gizlilik ve çeviri bağı korunur; sürüm ilerler', async () => {
    const { target, item } = await linkedPair()
    const before = experience(target)[0]
    const name = await replaceLinkedItem(target.id, 'experience', { ...item, id: 'baska-id', hidden: !before.hidden })
    expect(name).toBe('Hedef')
    const row = (await db.cvs.get(target.id))!
    const after = experience(row)[0] as AnyItem & { position: string }
    expect(after.position).toBe('Güncellenen pozisyon')
    expect(after.id).toBe(before.id)
    expect(after.hidden).toBe(before.hidden)
    expect(after.translationGroupId).toBe(before.translationGroupId)
    expect(versionOf(row)! > versionOf(target)!).toBe(true)
  })

  it('aynı milisaniyede bile sürüm geriye ya da aynı değere düşmez (gelecekteki zaman damgası)', async () => {
    const { target, item } = await linkedPair()
    // Saat geride kalmış başka bir sekme ileri tarihli yazmış olsun.
    const future = new Date(Date.now() + 5_000).toISOString()
    await db.cvs.put({ ...target, updatedAt: future })
    await replaceLinkedItem(target.id, 'experience', item)
    expect(versionOf(await db.cvs.get(target.id))! > future).toBe(true)
  })

  it('hedef editörde açık ve bekleyen değişikliği yoksa güncel hâli yüklenir', async () => {
    const { target, item } = await linkedPair()
    state().load(structuredClone(target), versionOf(target))
    await replaceLinkedItem(target.id, 'experience', item)
    await vi.waitFor(() => expect((experience(state().cv!)[0] as AnyItem & { position: string }).position).toBe('Güncellenen pozisyon'))
    expect(state().saveState).toBe('saved')
  })

  it('hedef editörde açık ve bekleyen değişikliği varsa ezilmez: çakışma bildirilir', async () => {
    const { target, item } = await linkedPair()
    state().load(structuredClone(target), versionOf(target))
    setPersonal('fullName', 'Hedefte yazılan')
    await replaceLinkedItem(target.id, 'experience', item)
    expect(await state().flush()).toEqual({ ok: false, reason: 'conflict' })
    const row = (await db.cvs.get(target.id))!
    expect((experience(row)[0] as AnyItem & { position: string }).position).toBe('Güncellenen pozisyon')
    expect(row.personal.fullName).toBe(target.personal.fullName)
  })

  it('bağlı kayıt yoksa ya da CV silindiyse yazmaz, hata verir', async () => {
    const { target, item } = await linkedPair()
    await expect(replaceLinkedItem(target.id, 'experience', { ...item, translationGroupId: 'yok' })).rejects.toThrow()
    expect(versionOf(await db.cvs.get(target.id))).toBe(versionOf(target))
    await db.cvs.delete(target.id)
    await expect(replaceLinkedItem(target.id, 'experience', item)).rejects.toThrow()
  })
})
