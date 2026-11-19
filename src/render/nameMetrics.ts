/**
 * Uzun ad eşikleri (karakter): ad 24 karakterden uzunsa `.is-long`, en az 12 harfli kelime
 * varsa `.has-long-word`. En uzun kelimenin harf sayısı da `--name-longest` olarak verilir:
 * base.css adın yazı boyunu onunla sınırlar; kelime satıra sığar, ortasından bölünmez.
 */
const LONG_NAME = 24
const LONG_WORD = 12

/**
 * Tarayıcının satır kırmadığı boşluklar: bölünmez boşluk (U+00A0; Word ve LinkedIn'den yapıştırınca
 * gelir), rakam boşluğu (U+2007), dar bölünmez boşluk (U+202F), kelime birleştirici (U+2060, U+FEFF).
 */
const NO_BREAK = /[   ⁠﻿]/g
/** Satırın kırılabildiği boşluklar: JS'in `\s`'i eksi yukarıdakiler */
const BREAKING_SPACE = /[^\S   ⁠﻿]+/

/**
 * Adın çizilen hâli: bölünmez boşluklar normal boşluğa çevrilir, boşluklar tekleşir. Yapıştırmayla
 * gelen bölünmez boşluk kasıt değil kazadır: ad tek satıra zorlanmaz (kelime aralarından kırılır),
 * PDF metnine de ATS'lerin ad-soyad ayırmak için beklediği düz boşluk girer.
 */
export function displayName(name: string): string {
  return name.replace(NO_BREAK, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Ölçü "kelime"yi tarayıcının gördüğü gibi sayar: satırın kırılamadığı her parça tek kelimedir.
 * Bölünmez boşlukla bağlı iki kelime (çizimde `displayName` bunu çözer; buraya ham ad gelirse de)
 * tek, uzun kelime sayılır; `\s+` ile bölmek onu kısa sayıp adı sayfadan taşırırdı.
 */
export function nameMetrics(name: string) {
  const words = name.split(BREAKING_SPACE).filter(Boolean)
  const longest = Math.max(1, ...words.map((word) => [...word].length))
  return { isLong: [...name].length > LONG_NAME, hasLongWord: longest >= LONG_WORD, longest }
}
