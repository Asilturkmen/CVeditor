import type { Personal } from '@/cv/schema'

/**
 * Sağlayıcıya giden metinlerde kişinin adı ve iletişim bilgileri ⟦…⟧ yer
 * tutucusuyla maskelenir; yanıt gelince yerelde geri konur. Düzenleme
 * (payload.ts), çeviri (translate.ts) ve içe aktarma (runImport.ts) aynı
 * maskeyi kullanır.
 *
 * Eşleşme Türkçe büyük/küçük harfe dayanıklıdır: "Ayşe Yılmaz" →
 * "AYŞE YILMAZ", "ayşe yılmaz", "AYSE"deki gibi i/İ/ı/I farkları ve
 * birden çok boşluk aynı değer sayılır.
 */

export const PLACEHOLDER_RE = /⟦[A-Z]+(?:_\d+)?⟧/g

export interface ContactMask {
  placeholder: string
  value: string
  re: RegExp
}

export type MaskSource = Partial<Pick<Personal, 'fullName' | 'email' | 'phone' | 'linkedin' | 'github' | 'website'>>

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Büyük/küçük harf duyarsız (`i` bayrağıyla birlikte) ve Türkçe i/İ/ı/I
 * farkını yok sayan desen. JavaScript'in büyük/küçük harf katlaması İ ve
 * ı'yı i/I ile eşlemez; bu harfler tek tek sınıfa çevrilir. Türkçe dışı
 * küçültmenin "İ" → "i̇" (birleşik nokta) biçimi de yakalanır. Boşluklar
 * herhangi bir boşluk dizisiyle eşleşir.
 */
export function loosePattern(value: string): string {
  let out = ''
  for (const ch of value) {
    if (/\s/u.test(ch)) {
      if (!out.endsWith('\\s+')) out += '\\s+'
    } else if (/[iIıİ]/u.test(ch)) out += '(?:[iIıİ]\\u0307?)'
    else out += escapeRe(ch)
  }
  return out
}

/** Bağlantıyı protokol/www/son eğik çizgi farkı gözetmeden bulan desen. */
function urlPattern(value: string): string | null {
  const core = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
  if (core.length < 4) return null
  // Sondaki "/" yalnız ardından yol gelmiyorsa değere dahil (github.com/ad/proje → ⟦GITHUB⟧/proje).
  return `(?:https?:\\/\\/)?(?:www\\.)?${loosePattern(core)}(?![\\w-])(?:\\/(?![\\w-]))?`
}

/** Telefon: rakamlar arasında boşluk, nokta, tire, parantez olabilir; ülke kodu olmadan da yakalanır. */
function phonePattern(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 7) return null
  const variants = [digits]
  if (digits.length > 10) variants.push(digits.slice(-10))
  return variants
    .map((v) => `\\+?${v.split('').join('[\\s.\\-()]*')}`)
    .sort((a, b) => b.length - a.length)
    .join('|')
}

/** Kişisel bilgilerden maskeler (boş ya da çok kısa değerler maskelenmez). */
export function buildContactMasks(personal: MaskSource): ContactMask[] {
  const masks: ContactMask[] = []
  const add = (placeholder: string, value: string, pattern: string | null) => {
    if (pattern) masks.push({ placeholder, value, re: new RegExp(pattern, 'giu') })
  }
  const email = (personal.email ?? '').trim()
  add('⟦EMAIL⟧', email, email.length >= 5 ? loosePattern(email) : null)
  add('⟦PHONE⟧', (personal.phone ?? '').trim(), phonePattern(personal.phone ?? ''))
  add('⟦LINKEDIN⟧', (personal.linkedin ?? '').trim(), urlPattern(personal.linkedin ?? ''))
  add('⟦GITHUB⟧', (personal.github ?? '').trim(), urlPattern(personal.github ?? ''))
  add('⟦WEBSITE⟧', (personal.website ?? '').trim(), urlPattern(personal.website ?? ''))
  const name = (personal.fullName ?? '').trim().replace(/\s+/g, ' ')
  // Sözcük sınırı: "Ali Can" adı "Kalina Canlı" içinde maskelenmesin.
  add('⟦NAME⟧', name, name.length >= 3 ? `(?<![\\p{L}\\p{N}])${loosePattern(name)}(?![\\p{L}\\p{N}])` : null)
  // Uzun değer önce: bağlantı içindeki ad ya da başka bağlantının parçası yarım maskelenmesin.
  return masks.sort((a, b) => b.value.length - a.value.length)
}

export interface Masker {
  /** Metindeki değerleri yer tutucuya çevirir; aynı yazım hep aynı yer tutucuyu alır. */
  mask: (text: string) => string
  /** Yer tutucuları geri koyar; bilinmeyen yer tutucu olduğu gibi kalır. */
  unmask: (text: string) => string
  /** Şimdiye kadar kullanılan yer tutucular */
  placeholders: () => string[]
  /** Yer tutucu → özgün yazım */
  map: () => Record<string, string>
}

/**
 * Metinde bulunan özgün yazım → yer tutucu. Aynı değer farklı yazılmışsa
 * (ör. telefon biçimi, büyük harfli ad) her yazım ayrı yer tutucu alır
 * (⟦PHONE_2⟧) ki geri koyarken metin değişmesin.
 */
export function createMasker(masks: ContactMask[]): Masker {
  const originals = new Map<string, string>()
  const byText = new Map<string, string>()
  const mask = (text: string) => {
    let out = text
    for (const m of masks) {
      out = out.replace(m.re, (found) => {
        const known = byText.get(found)
        if (known) return known
        const base = m.placeholder.slice(1, -1)
        let placeholder = m.placeholder
        for (let n = 2; originals.has(placeholder); n++) placeholder = `⟦${base}_${n}⟧`
        originals.set(placeholder, found)
        byText.set(found, placeholder)
        return placeholder
      })
    }
    return out
  }
  // Model yer tutucuyu kendisi de yazabilir (ör. "⟦EMAIL⟧ adresinden ulaşın"): metinde
  // geçmemişse kişisel bilgideki değer konur.
  const unmask = (s: string) =>
    s.replace(PLACEHOLDER_RE, (p) => originals.get(p) ?? masks.find((m) => m.placeholder === p)?.value ?? p)
  return {
    mask,
    unmask,
    placeholders: () => [...originals.keys()],
    map: () => Object.fromEntries(originals),
  }
}

/** Metindeki yer tutucular (sırasız, tekil) */
export function placeholdersIn(text: string): Set<string> {
  return new Set(text.match(PLACEHOLDER_RE) ?? [])
}

/** Yanıtta geri konamayan (uydurma ya da bozulmuş) yer tutucu kaldı mı? */
export function hasPlaceholder(text: string): boolean {
  return /⟦[A-Z]+(?:_\d+)?⟧/.test(text)
}
