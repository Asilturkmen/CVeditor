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
import { generateMockSuggestions, tidyHtml } from './mockSuggestions'
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
    restoreItem(experience.id, removed.item, removed.index)
    expect(cv().sections.find((s) => s.type === 'experience')!.items[1].id).toBe(second.id)
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

describe('örnek öneriler (V1)', () => {
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

    const scoped = generateMockSuggestions(cv(), { kind: 'item', sectionId: experience.id, itemId: target.id })
    expect(scoped.length).toBeGreaterThan(0)
    expect(scoped.every((s) => s.target === target.id)).toBe(true)

    applySuggestions(scoped)
    expect(useEditor.getState().past.length).toBe(pastBefore + 1)
    const updated = cv().sections.find((s) => s.type === 'experience')!.items[0] as { description: string }
    expect(updated.description).toBe('<ul><li>Birinci</li><li>İkinci</li></ul>')
  })
})
