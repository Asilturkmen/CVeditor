import { describe, expect, it } from 'vitest'
import { headingOf } from '@/ai/importHeuristics'
import { HEADING_GROUPS, isKnownHeading, standardTypeOf } from './headings'

/**
 * Bölüm başlıklarının tek kaynağı headings.ts: CV İnceleme (standardTypeOf,
 * isKnownHeading) ve içe aktarma (importHeuristics.headingOf) aynı listeyi
 * tanır. Biri listeye başlık eklerse ikisi de görür; ayrı liste tutulursa bu
 * test düşer.
 */

const variants = (title: string) => [title, title.toLocaleUpperCase('tr'), title.toLocaleUpperCase('tr').normalize('NFD')]

describe('başlık listesi: inceleme ve içe aktarma tek kaynak', () => {
  for (const group of HEADING_GROUPS) {
    it(`${group.kind}${group.keepTitle ? ' (başlık korunur)' : ''}`, () => {
      for (const title of group.titles) {
        for (const v of variants(title)) {
          expect(headingOf(v)?.kind, `içe aktarma: ${v}`).toBe(group.kind)
          expect(headingOf(v)?.keepTitle, `içe aktarma: ${v}`).toBe(group.keepTitle)
          expect(isKnownHeading(v), `inceleme: ${v}`).toBe(true)
          if (group.kind === 'contact' || group.kind === 'custom') expect(standardTypeOf(v), `inceleme: ${v}`).toBeNull()
          else expect(standardTypeOf(v), `inceleme: ${v}`).toBe(group.kind)
        }
      }
    })
  }

  it('aynı başlık iki grupta yok', () => {
    const seen = new Map<string, string>()
    for (const group of HEADING_GROUPS) {
      for (const title of group.titles) {
        expect(seen.get(title), title).toBeUndefined()
        seen.set(title, group.kind)
      }
    }
  })
})

describe('büyük harfli Türkçe başlıklar', () => {
  const cases: [string, string | null][] = [
    ['ÇALIŞMA DENEYİMİ', 'experience'],
    ['İŞ DENEYİMİ', 'experience'],
    ['İŞ TECRÜBESİ', 'experience'],
    ['TEKNİK YETENEKLER', 'skills'],
    ['EĞİTİM BİLGİLERİ', 'education'],
    ['YABANCI DİLLER', 'languages'],
    ['SERTİFİKALAR', 'certificates'],
    ['ÖDÜLLER & BAŞARILAR', 'awards'],
    ['GÖNÜLLÜLÜK', 'volunteer'],
    ['CALISMA DENEYIMI', 'experience'],
    ['D E N E Y İ M', 'experience'],
    ['İLGİ ALANLARI', null],
  ]
  it.each(cases)('%s', (title, kind) => {
    for (const v of [title, title.normalize('NFD')]) {
      expect(standardTypeOf(v), v).toBe(kind)
      expect(headingOf(v)?.kind, v).toBe(kind ?? 'custom')
    }
  })
})
