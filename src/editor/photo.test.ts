import { beforeEach, describe, expect, it } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { templateSettingsFor } from '@/render/templates'
import { moveSection, setPhoto } from './actions'
import { useEditor } from './store'

const cv = () => useEditor.getState().cv!

beforeEach(() => {
  const sections = sampleSections('tr')
  const template = { ...templateSettingsFor('zarif', sections), showPhoto: false }
  useEditor.getState().load(
    createCv({ name: 'Test', language: 'tr', templateId: 'zarif', template, personal: samplePersonal('tr'), sections }),
  )
})

describe('fotoğraf yükleme', () => {
  it('fotoğraf + gösterimi açma tek geri alma adımıdır', () => {
    expect(setPhoto('data:image/jpeg;base64,AAAA')).toBe(true)
    expect(cv().personal.photo).toBe('data:image/jpeg;base64,AAAA')
    expect(cv().template.showPhoto).toBe(true)
    expect(useEditor.getState().past).toHaveLength(1)
    useEditor.getState().undo()
    expect(cv().personal.photo).toBeNull()
    expect(cv().template.showPhoto).toBe(false)
  })

  it('gösterim zaten açıksa yalnız fotoğraf değişir; art arda iki yükleme iki adımdır', () => {
    setPhoto('data:image/jpeg;base64,AAAA')
    expect(setPhoto('data:image/jpeg;base64,BBBB')).toBe(false)
    expect(useEditor.getState().past).toHaveLength(2)
    useEditor.getState().undo()
    expect(cv().personal.photo).toBe('data:image/jpeg;base64,AAAA')
  })
})

describe('bölüm sırası', () => {
  it('her taşıma tek adımdır (Görünüm ve İçerik aynı eylemi kullanır)', () => {
    const before = cv().sections.map((s) => s.id)
    moveSection(0, 2)
    moveSection(1, 0)
    expect(useEditor.getState().past).toHaveLength(2)
    useEditor.getState().undo()
    useEditor.getState().undo()
    expect(cv().sections.map((s) => s.id)).toEqual(before)
  })
})
