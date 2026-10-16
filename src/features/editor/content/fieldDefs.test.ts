import { describe, expect, it } from 'vitest'
import { ITEM_FIELDS } from './fieldDefs'

describe('alan tanımları', () => {
  it('yazı alanlarının hepsinde örnek yer tutucu var (tarih seçicileri hariç)', () => {
    const missing = Object.entries(ITEM_FIELDS).flatMap(([type, fields]) =>
      fields.filter((f) => f.kind !== 'range' && f.kind !== 'month' && !f.placeholder?.()).map((f) => `${type}.${f.key}`),
    )
    expect(missing).toEqual([])
  })
})
