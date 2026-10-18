/**
 * Uzun ad eşikleri (karakter): ad 24 karakterden uzunsa `.is-long`, en az 12 harfli kelime
 * varsa `.has-long-word`. En uzun kelimenin harf sayısı da `--name-longest` olarak verilir:
 * base.css adın yazı boyunu onunla sınırlar; kelime satıra sığar, ortasından bölünmez.
 */
const LONG_NAME = 24
const LONG_WORD = 12

export function nameMetrics(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  const longest = Math.max(1, ...words.map((word) => [...word].length))
  return { isLong: [...name].length > LONG_NAME, hasLongWord: longest >= LONG_WORD, longest }
}
