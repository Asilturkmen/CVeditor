import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { templateSettingsFor } from '@/render/templates'
import {
  addItem,
  applySuggestions,
  moveSection,
  removeItem,
  restoreItem,
  setItemField,
  setPersonal,
  switchTemplate,
} from './actions'
import { mockEdit, tidyHtml } from '@/ai/mockProvider'
import { operationsToSuggestions } from '@/ai/ops'
import { buildEditPayload } from '@/ai/payload'
import type { AiScope } from '@/ai/types'
import { useEditor } from './store'

function sampleCv(): Cv {
  const sections = sampleSections('tr')
  return createCv({
    name: 'Test',
    language: 'tr',
    templateId: 'klasik',
    template: templateSettingsFor('klasik', sections),
    personal: samplePersonal('tr'),
    sections,
  })
}

const cv = () => useEditor.getState().cv!

beforeEach(() => {
  useEditor.getState().load(sampleCv())
})

describe('geri al / yinele', () => {
  it('değişikliği geri alır ve yineler', () => {
    setPersonal('headline', 'Yeni unvan')
    expect(cv().personal.headline).toBe('Yeni unvan')
    useEditor.getState().undo()
    expect(cv().personal.headline).toBe('Frontend Geliştirici')
    useEditor.getState().redo()
    expect(cv().personal.headline).toBe('Yeni unvan')
  })

  it('aynı alana hızlı yazım tek adımda birleşir', () => {
    setPersonal('fullName', 'D')
    setPersonal('fullName', 'De')
    setPersonal('fullName', 'Den')
    expect(useEditor.getState().past).toHaveLength(1)
    useEditor.getState().undo()
    expect(cv().personal.fullName).toBe('Deniz Aksoy')
  })

  it('farklı alanlar ayrı adımdır; yeni değişiklik ileri geçmişi siler', () => {
    setPersonal('fullName', 'A')
    setPersonal('headline', 'B')
    expect(useEditor.getState().past).toHaveLength(2)
    useEditor.getState().undo()
    expect(useEditor.getState().future).toHaveLength(1)
    setPersonal('email', 'c@d.com')
    expect(useEditor.getState().future).toHaveLength(0)
  })

  it('kayıt silme ve geri getirme sırayı korur', () => {
    const experience = cv().sections.find((s) => s.type === 'experience')!
    const second = experience.items[1]
    const removed = removeItem(experience.id, second.id)!
    expect(cv().sections.find((s) => s.type === 'experience')!.items).toHaveLength(2)
    restoreItem(experience.id, removed)
    expect(cv().sections.find((s) => s.type === 'experience')!.items[1].id).toBe(second.id)
  })

  it('"Geri al" bildirimi, kayıt zaten geri geldiyse ikinci kopya eklemez', () => {
    const experience = cv().sections.find((s) => s.type === 'experience')!
    const removed = removeItem(experience.id, experience.items[0].id)!
    useEditor.getState().undo()
    restoreItem(experience.id, removed)
    const items = cv().sections.find((s) => s.type === 'experience')!.items
    expect(items).toHaveLength(3)
    expect(new Set(items.map((i) => i.id)).size).toBe(3)
  })

  it('"Geri al" bildirimi başka bir CV açıkken bir şey yapmaz', () => {
    const experience = cv().sections.find((s) => s.type === 'experience')!
    const removed = removeItem(experience.id, experience.items[0].id)!
    useEditor.getState().load(sampleCv())
    const before = JSON.stringify(cv())
    restoreItem(experience.id, removed)
    expect(JSON.stringify(cv())).toBe(before)
  })

  it('bölüm taşıma geri alınabilir', () => {
    const before = cv().sections.map((s) => s.id)
    moveSection(0, 3)
    expect(cv().sections[3].id).toBe(before[0])
    useEditor.getState().undo()
    expect(cv().sections.map((s) => s.id)).toEqual(before)
  })
})

describe('düzenleme', () => {
  it('yeni kayıt ekler ve alan yazar', () => {
    const experience = cv().sections.find((s) => s.type === 'experience')!
    const id = addItem(experience.id)!
    setItemField(experience.id, id, 'position', 'Stajyer')
    const added = cv().sections.find((s) => s.type === 'experience')!.items.find((i) => i.id === id)!
    expect((added as { position: string }).position).toBe('Stajyer')
  })

  it('şablon değiştirmek içeriği korur, kullanıcı rengini korur', () => {
    const sectionsBefore = cv().sections
    useEditor.getState().update((d) => {
      d.template.accentColor = '#123456'
    })
    switchTemplate('modern')
    expect(cv().templateId).toBe('modern')
    expect(cv().template.columns).toBe(2)
    expect(cv().template.accentColor).toBe('#123456')
    expect(cv().sections).toEqual(sectionsBefore)
  })

  it('şablon değişince dokunulmamış renk ve yazı tipi yeni şablonunkine geçer', () => {
    switchTemplate('modern')
    expect(cv().template.font).toBe('inter')
    expect(cv().template.accentColor).toBe('#2f6f62')
  })

  it('otomatik kayıt veritabanına yazar', async () => {
    vi.useFakeTimers()
    setPersonal('headline', 'Kayıt testi')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await useEditor.getState().flush()
    const stored = await db.cvs.get(cv().id)
    expect(stored?.personal.headline).toBe('Kayıt testi')
  })
})

/** Örnek sağlayıcının önerileri (gerçek akışla aynı yol: payload → işlem → öneri). */
function mockSuggestions(scope: AiScope, prompt = 'Maddeleri düzelt') {
  const { payload, unmask } = buildEditPayload(cv(), scope, prompt)
  return operationsToSuggestions(cv(), mockEdit(payload), unmask, payload).suggestions
}

describe('örnek öneriler', () => {
  it('öneriden sonra alan değiştiyse öneri uygulanmaz', () => {
    const experience = cv().sections.find((s) => s.type === 'experience')!
    const target = experience.items[0]
    setItemField(experience.id, target.id, 'description', '<ul><li>birinci</li><li>ikinci</li></ul>')
    const list = mockSuggestions({ kind: 'item', sectionId: experience.id, itemId: target.id })
    setItemField(experience.id, target.id, 'description', '<ul><li>kullanıcının yeni metni</li></ul>')
    expect(applySuggestions(list)).toBe(0)
    const item = cv().sections.find((s) => s.type === 'experience')!.items[0] as { description: string }
    expect(item.description).toBe('<ul><li>kullanıcının yeni metni</li></ul>')
  })

  it('madde başlarını büyütür ve sonları tutarlı yapar', () => {
    const out = tidyHtml('<ul><li>ilk madde.</li><li>ikinci  madde.</li><li>üçüncü madde</li></ul>', 'tr')
    expect(out).toBe('<ul><li>İlk madde.</li><li>İkinci madde.</li><li>Üçüncü madde.</li></ul>')
  })

  it('zayıf kalıpları değiştirir', () => {
    expect(tidyHtml('<ul><li>Responsible for the API</li></ul>', 'en')).toBe('<ul><li>Led the API</li></ul>')
  })

  it('öneriler kapsama uyar ve toplu kabul tek adımdır', () => {
    const experience = cv().sections.find((s) => s.type === 'experience')!
    const target = experience.items[0]
    setItemField(experience.id, target.id, 'description', '<ul><li>birinci</li><li>ikinci</li></ul>')
    const pastBefore = useEditor.getState().past.length

    const scoped = mockSuggestions({ kind: 'item', sectionId: experience.id, itemId: target.id })
    expect(scoped.length).toBeGreaterThan(0)
    expect(scoped.every((s) => s.kind === 'field' && s.target === target.id)).toBe(true)

    expect(applySuggestions(scoped)).toBe(scoped.length)
    expect(useEditor.getState().past.length).toBe(pastBefore + 1)
    const updated = cv().sections.find((s) => s.type === 'experience')!.items[0] as { description: string }
    expect(updated.description).toBe('<ul><li>Birinci</li><li>İkinci</li></ul>')
  })

  it('ekleme + kaldırma + alan önerisi tek adımda uygulanır ve tek adımda geri alınır', () => {
    const before = JSON.stringify(cv().sections)
    const list = mockSuggestions({ kind: 'all' }, 'Becerilere bir grup ekle ve son kaydı sil')
    expect(list.some((s) => s.kind === 'addItem')).toBe(true)
    expect(list.some((s) => s.kind === 'removeItem')).toBe(true)
    const pastBefore = useEditor.getState().past.length
    expect(applySuggestions(list)).toBe(list.length)
    expect(useEditor.getState().past.length).toBe(pastBefore + 1)
    const add = list.find((s) => s.kind === 'addItem')!
    expect(cv().sections.some((s) => s.items.some((i) => i.id === (add.kind === 'addItem' && add.item.id)))).toBe(true)
    useEditor.getState().undo()
    expect(JSON.stringify(cv().sections)).toBe(before)
  })

  it('kaldırma önerisi kayıt sonradan değiştiyse uygulanmaz; ekleme aynı id ile iki kez girmez', () => {
    const list = mockSuggestions({ kind: 'all' }, 'son kaydı sil ve bir beceri ekle')
    const remove = list.find((s) => s.kind === 'removeItem')!
    const add = list.find((s) => s.kind === 'addItem')!
    if (remove.kind !== 'removeItem' || add.kind !== 'addItem') throw new Error('tür')
    setItemField(remove.sectionId, remove.itemId, 'name', 'Elle değişti')
    expect(applySuggestions([remove])).toBe(0)
    expect(cv().sections.find((s) => s.id === remove.sectionId)!.items.some((i) => i.id === remove.itemId)).toBe(true)
    expect(applySuggestions([add])).toBe(1)
    expect(applySuggestions([add])).toBe(0)
    const count = cv().sections.flatMap((s) => s.items as { id: string }[]).filter((i) => i.id === add.item.id).length
    expect(count).toBe(1)
  })
})
