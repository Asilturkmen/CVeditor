import type { TranslatedEntry, TranslationValues } from '@/ai/translate'

/** Çeviri onay listesinin durumu: alan anahtarı → düzeltilmiş metin ve "Çevirme" seçimi. */
export interface ReviewRow {
  value: string
  keep: boolean
}
export type ReviewState = Record<string, ReviewRow>

export function initialReview(entries: TranslatedEntry[]): ReviewState {
  return Object.fromEntries(entries.map((e) => [e.key, { value: e.translated, keep: false }]))
}

/** Onaylanan son metinler: "Çevirme" seçilen alan kaynak metniyle kalır. */
export function reviewValues(entries: TranslatedEntry[], state: ReviewState): TranslationValues {
  return Object.fromEntries(
    entries.map((e) => {
      const row = state[e.key]
      return [e.key, !row || row.keep ? e.text : row.value]
    }),
  )
}

export function changedCount(entries: TranslatedEntry[], state: ReviewState): number {
  return entries.filter((e) => {
    const row = state[e.key]
    return row && !row.keep && row.value !== e.text
  }).length
}
