/**
 * Arama için harf katlama. Türkçe ve İngilizce adlar aynı listede aranır; "I/İ/ı/i" dört harfi tek
 * harfe (i) indirilir: `toLocaleLowerCase('tr')` "IT"yi "ıt" yapar ve "it" yazan bulamaz,
 * `toLowerCase()` ise "İ"yi "i̇" (i + birleşen nokta) yapar ve "istanbul" yazan "İstanbul"u bulamaz.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[Iİıi]/g, 'i')
    .toLowerCase()
    .replace(/̇/g, '')
}

/** `haystack` içinde `query` geçiyor mu (harf katlamalı, baştaki/sondaki boşluk yok sayılır)? Boş sorgu her şeyle eşleşir. */
export function matchesSearch(haystack: string, query: string): boolean {
  const q = foldForSearch(query.trim())
  return q === '' || foldForSearch(haystack).includes(q)
}
