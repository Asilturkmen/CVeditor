import { describe, expect, it } from 'vitest'
import enRaw from '../../messages/en.json?raw'
import trRaw from '../../messages/tr.json?raw'
import { m } from '@/paraglide/messages'

type Messages = Record<string, unknown>
const tr = JSON.parse(trRaw) as Messages
const en = JSON.parse(enRaw) as Messages

/** Mesajdaki {parametre} adları; çoğul biçimlerde bütün varyantlar birlikte sayılır. */
function params(value: unknown): string[] {
  const out = new Set<string>()
  const walk = (x: unknown) => {
    if (typeof x === 'string') for (const match of x.matchAll(/\{(\w+)\}/g)) out.add(match[1])
    else if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === 'object')
      for (const [key, y] of Object.entries(x)) if (key !== 'declarations' && key !== 'selectors') walk(y)
  }
  walk(value)
  return [...out].sort()
}

describe('arayüz çevirileri', () => {
  it('en.json ile tr.json aynı anahtarları taşır', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort())
  })

  it('her anahtarda parametreler aynı', () => {
    const mismatched = Object.keys(tr).filter((key) => params(tr[key]).join() !== params(en[key]).join())
    expect(mismatched).toEqual([])
  })

  it('İngilizce çoğul biçimleri sayıya göre seçilir', () => {
    expect(m.page_count({ count: 1 }, { locale: 'en' })).toBe('1 page')
    expect(m.page_count({ count: 3 }, { locale: 'en' })).toBe('3 pages')
    expect(m.page_count({ count: 1 }, { locale: 'tr' })).toBe('1 sayfa')
  })
})
