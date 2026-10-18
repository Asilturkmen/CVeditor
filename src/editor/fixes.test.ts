import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCv, duplicateCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { addMissing, openInEditor } from '@/features/review/openInEditor'
import { findLinkedItem } from '@/features/translate/linkedItems'
import { templateSettingsFor } from '@/render/templates'
import { copyItemToCv } from './actions'
import { useEditor } from './store'
import { cssString, pendingMarkerCss, useEditorUi, type Suggestion } from './ui'

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

describe('başka CV\'ye kopyalama ve çeviri bağı', () => {
  beforeEach(async () => {
    await db.cvs.clear()
  })

  it('bağlı kayıt yoksa bağ korunur; varken "yeni kayıt" bağımsız kopya olur', async () => {
    const source = sampleCv('Kaynak')
    const target = duplicateCv(source, { name: 'Hedef', language: 'en' })
    const item = source.sections.find((s) => s.type === 'experience')!.items[0] as AnyItem
    // Hedefteki bağlı kaydı kaldır: ilk kopya bağı taşımalı
    const targetExp = target.sections.find((s) => s.type === 'experience')!
    targetExp.items = (targetExp.items as AnyItem[]).filter((i) => i.translationGroupId !== item.translationGroupId) as typeof targetExp.items
    await db.cvs.put(target)

    await copyItemToCv(target.id, 'experience', item)
    let stored = (await db.cvs.get(target.id))!
    let same = stored.sections.flatMap((s) => s.items as AnyItem[]).filter((i) => i.translationGroupId === item.translationGroupId)
    expect(same).toHaveLength(1)
    const linked = findLinkedItem(stored, 'experience', item.translationGroupId)
    expect(linked?.itemId).toBe(same[0].id)

    // İkinci kez "Yeni kayıt olarak ekle": aynı gruptan ikinci kayıt oluşmaz
    await copyItemToCv(target.id, 'experience', item)
    stored = (await db.cvs.get(target.id))!
    same = stored.sections.flatMap((s) => s.items as AnyItem[]).filter((i) => i.translationGroupId === item.translationGroupId)
    expect(same).toHaveLength(1)
    const exp = stored.sections.find((s) => s.type === 'experience')!.items as AnyItem[]
    const added = exp[exp.length - 1]
    expect(added.translationGroupId).not.toBe(item.translationGroupId)
    expect((added as unknown as Record<string, string>).position).toBe((item as unknown as Record<string, string>).position)
    // Bağlı kayıt hâlâ ilk kopya
    expect(findLinkedItem(stored, 'experience', item.translationGroupId)?.itemId).toBe(same[0].id)
  })
})

describe('bekleyen öneri işaretleri (CSS)', () => {
  it('kayıt id\'si CSS kuralını kıramaz', () => {
    const evil = 'x"]{}body{display:none}</style><script>alert(1)</script>[id="'
    const suggestion: Suggestion = {
      kind: 'field',
      id: 's1',
      sectionId: 'b1',
      target: evil,
      field: 'position',
      before: 'a',
      after: 'b',
      rich: false,
      note: '',
    }
    const css = pendingMarkerCss([suggestion])
    expect(css).not.toContain('body{display:none}')
    expect(css).not.toContain('</style>')
    expect(css).not.toContain('<script>')
    // Yalnız seçici sınırlarındaki tırnaklar ve content:"" kaçışsız
    expect(css.match(/(?<!\\)"/g)).toHaveLength(6)
    expect(cssString('item-kopya-0')).toBe('"item-kopya-0"')
    expect(cssString('a"b')).toBe('"a\\22 b"')
  })

  it('kişisel bilgi ve kaldırma önerileri ayrı işaret alır; ekleme işaret almaz', () => {
    const css = pendingMarkerCss([
      { kind: 'field', id: '1', sectionId: null, target: 'personal', field: 'headline', before: '', after: 'x', rich: false, note: '' },
      { kind: 'removeItem', id: '2', sectionId: 's', itemId: 'abc-1', snapshot: '{}', note: '' },
    ])
    expect(css).toContain('[id="personal-card"]')
    expect(css).toContain('[id="item-abc-1"]')
    expect(css).toContain('var(--danger)')
  })
})

describe('İnceleme → Düzenle odağı', () => {
  beforeEach(() => {
    useEditorUi.getState().reset()
  })

  it('aynı CV hâlâ yüklüyken yeniden yüklenince de odak verilir ve dinleyici kalkar', () => {
    const cv = sampleCv()
    useEditor.getState().load(cv)
    const item = cv.sections.find((s) => s.type === 'experience')!.items[0]
    const navigate = vi.fn()
    openInEditor(navigate as never, cv.id, { itemId: item.id })
    expect(navigate).toHaveBeenCalledWith({ to: '/editor/$cvId', params: { cvId: cv.id } })
    // Editör açılırken arayüzü sıfırlar ve aynı CV'yi yeniden yükler (kimliği aynı, nesne yeni).
    useEditorUi.getState().reset()
    useEditor.getState().load(structuredClone(cv))
    expect(useEditorUi.getState().focusedItemId).toBe(item.id)

    // Dinleyici kalktı: sonraki yükleme odağı değiştirmez.
    useEditorUi.getState().reset()
    useEditor.getState().load(structuredClone(cv))
    expect(useEditorUi.getState().focusedItemId).toBeNull()
  })

  it('başka CV yüklenirse odak verilmez, dinleyici kalkar; zaman aşımında da kalkar', () => {
    vi.useFakeTimers()
    try {
      const cv = sampleCv()
      const other = sampleCv('Başka')
      const item = cv.sections.find((s) => s.type === 'experience')!.items[0]
      openInEditor(vi.fn() as never, cv.id, { itemId: item.id })
      useEditor.getState().load(other)
      expect(useEditorUi.getState().focusedItemId).toBeNull()
      useEditor.getState().load(cv)
      expect(useEditorUi.getState().focusedItemId).toBeNull()

      openInEditor(vi.fn() as never, cv.id, { personal: true })
      vi.advanceTimersByTime(15_001)
      useEditor.getState().load(cv)
      expect(useEditorUi.getState().focusedItemId).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('eksik bölüm: yükleme sonrası tek adımda eklenir, ilk kaydına odaklanılır; özet en başa', async () => {
    const cv = sampleCv()
    cv.sections = cv.sections.filter((s) => s.type !== 'education' && s.type !== 'summary')
    openInEditor(vi.fn() as never, cv.id, { addSection: 'education' })
    useEditor.getState().load(structuredClone(cv))
    await Promise.resolve()
    let state = useEditor.getState()
    const edu = state.cv!.sections.find((s) => s.type === 'education')!
    expect(edu.items).toHaveLength(1)
    expect(useEditorUi.getState().focusedItemId).toBe(edu.items[0].id)
    expect(state.past).toHaveLength(1)
    state.undo()
    expect(useEditor.getState().cv!.sections.some((s) => s.type === 'education')).toBe(false)

    openInEditor(vi.fn() as never, cv.id, { addSection: 'summary' })
    useEditor.getState().load(structuredClone(cv))
    await Promise.resolve()
    state = useEditor.getState()
    expect(state.cv!.sections[0].type).toBe('summary')
    expect(useEditorUi.getState().focusedItemId).toBe(state.cv!.sections[0].items[0].id)
  })

  it('kaydı olmayan bölüme ilk kayıt eklenir; Görünüm hedefi sekmeyi açar', async () => {
    const cv = sampleCv()
    const skills = cv.sections.find((s) => s.type === 'skills')!
    skills.items = []
    openInEditor(vi.fn() as never, cv.id, { addSection: 'skills' })
    useEditor.getState().load(structuredClone(cv))
    await Promise.resolve()
    const after = useEditor.getState().cv!.sections.filter((s) => s.type === 'skills')
    expect(after).toHaveLength(1)
    expect(after[0].items).toHaveLength(1)
    expect(useEditorUi.getState().focusedItemId).toBe(after[0].items[0].id)

    openInEditor(vi.fn() as never, cv.id, { tab: 'appearance' })
    useEditor.getState().load(structuredClone(cv))
    expect(useEditorUi.getState().tab).toBe('appearance')
  })

  it('çift tıklama: yalnız son istek bekler; eksik bölüm bir kez, tek adımda eklenir', async () => {
    const cv = sampleCv()
    cv.sections = cv.sections.filter((s) => s.type !== 'education')
    const navigate = vi.fn()
    openInEditor(navigate as never, cv.id, { addSection: 'education' })
    openInEditor(navigate as never, cv.id, { addSection: 'education' })
    expect(navigate).toHaveBeenCalledTimes(2)
    useEditor.getState().load(structuredClone(cv))
    await Promise.resolve()
    await Promise.resolve()
    const state = useEditor.getState()
    const edu = state.cv!.sections.filter((s) => s.type === 'education')
    expect(edu).toHaveLength(1)
    expect(edu[0].items).toHaveLength(1)
    expect(state.past).toHaveLength(1)
    expect(useEditorUi.getState().focusedItemId).toBe(edu[0].items[0].id)
  })

  it('eksik bölüm eklemesi tekrarlanınca ikinci boş kayıt eklenmez, var olan boş kayda odaklanılır', () => {
    const cv = sampleCv()
    const skills = cv.sections.find((s) => s.type === 'skills')!
    skills.items = []
    useEditor.getState().load(structuredClone(cv))
    addMissing(cv.id, 'skills')
    addMissing(cv.id, 'skills')
    const state = useEditor.getState()
    const items = state.cv!.sections.find((s) => s.type === 'skills')!.items
    expect(items).toHaveLength(1)
    expect(state.past).toHaveLength(1)
    expect(useEditorUi.getState().focusedItemId).toBe(items[0].id)
  })
})
