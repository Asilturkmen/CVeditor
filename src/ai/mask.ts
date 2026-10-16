import type { AnyItem, Cv, Personal } from '@/cv/schema'
import { COUNTRIES, fold, REMOTE_WORDS } from './places'

/**
 * Sağlayıcıya giden metinlerde kişinin adı, iletişim bilgileri ve konumu ile
 * referans kişilerin adı ve iletişim bilgileri ⟦…⟧ yer tutucusuyla
 * maskelenir; yanıt gelince yerelde geri konur. Düzenleme (payload.ts),
 * çeviri (translate.ts), inceleme (review.ts) ve içe aktarma (runImport.ts)
 * aynı maskeyi kullanır.
 *
 * Eşleşme Türkçe büyük/küçük harfe dayanıklıdır: "Ayşe Yılmaz" →
 * "AYŞE YILMAZ", "ayşe yılmaz", i/İ/ı/I farkları (birleşik noktalı i dahil)
 * ve birden çok boşluk aynı değer sayılır. Ad ve yer adları Türkçe harfsiz
 * yazımla da eşleşir ("AYSE YILMAZ", "Kadikoy", "Kamil" = "Kâmil"):
 * İngilizce CV'lerde ve bağlantılarda sık görülür. Ayrıştırılmış (NFD)
 * yazım da eşleşir: her harften sonra birleşik işaret (\p{M}) kabul edilir;
 * metin değiştirilmez, geri koyma birebir aynı metni verir.
 *
 * Ad kuralları (karar, 2026-10-17):
 * - Tam ad (sırasıyla), "Soyad, Ad", "Soyad, A." ve "A. Soyad" biçimleri.
 * - Adın ve soyadın her parçası tek başına da maskelenir; ancak yalnız büyük
 *   harfle başlıyorsa ve en az 3 harfliyse ("Kâmil", "ÖZTÜRK"). Bedeli: ad
 *   ya da soyadla aynı yazılan özel adlar da maskelenir ("Demir Çelik A.Ş.",
 *   cümle başındaki "Deniz"); maske kayıpsız olduğu için yalnız modelin
 *   gördüğü bağlam azalır. Küçük harfli sıradan sözcük ("deniz", "can")
 *   maskelenmez.
 * - Bağlantı ve e-postadaki bitişik ad ("kamilozturk.dev",
 *   "github.com/kamil-ozturk/proje", "k.ozturk") parçalar arasında -, ., _ ya
 *   da hiçbir şey olan biçimiyle maskelenir; harf dışı karakterle sınırlı.
 *
 * Genel desenler: kişisel bilgide olmasa da metindeki her e-posta adresi
 * (⟦EMAIL_n⟧) ve telefon numarası (⟦PHONE_n⟧) maskelenir; bunlar hep
 * numaralıdır (çıplak ⟦EMAIL⟧/⟦PHONE⟧ kişinin kendi değerine ayrılır).
 * Bağlantılardan kişinin kendi bağlantıları ve adını içerenler maskelenir;
 * başka bağlantılar (ör. açık kaynak proje adresi) olduğu gibi gider.
 *
 * Konum kuralları (karar, 2026-10-17):
 * - Kişisel bilgideki konumun tamamı ("Bornova, İzmir") ve her parçası
 *   ("Bornova", "İzmir") metnin her yerinde ⟦LOCATION…⟧ olur. Bu, kayıtların
 *   kendi konum alanını da kapsar: deneyimin konumu kişinin şehriyle aynıysa
 *   o değer de maskelenir (hangisinin ev adresi olduğunu ayırt edemeyiz;
 *   maske kayıpsızdır, yanıt yerelde geri konur). Başka bir şehir (ör.
 *   stajın İstanbul'u) olduğu gibi gider.
 * - Ülke adları ve "Uzaktan/Remote" gibi sözcükler tek başına maskelenmez
 *   (kimlik belirtmez; "Türkiye'nin…" gibi her metni bozardı). Konum yalnız
 *   bunlardan oluşuyorsa hiç maske kurulmaz.
 * - 4 harf ve daha kısa tek sözcüklü yer adı ("Van", "Ordu") yalnız büyük
 *   harfle başlıyorsa eşleşir; "a van", "ordu" (sıradan sözcük) maskelenmez.
 *
 * Referans kişilerin adı (⟦REFNAME⟧, kişinin adıyla aynı kurallarla),
 * e-postası (⟦REFEMAIL⟧) ve telefonu (⟦REFPHONE⟧) da metinlerde maskelenir;
 * referansın kendi ad alanı dahil.
 *
 * Geri koyma: yalnız gönderilen yer tutucular geri konur. Model metinde
 * geçmeyen bir yer tutucu yazarsa (uydurma) olduğu gibi kalır ve çağıran o
 * değeri atar. Tek istisna: istek bir iletişim alanıyla ilgiliyse
 * (`createMasker`'ın `fallback` seçeneği) o alanın yer tutucusu kişisel
 * bilgideki değerle doldurulur; o değer zaten istekte açıkça gitmiştir.
 */

export const PLACEHOLDER_RE = /⟦[A-Z]+(?:_\d+)?⟧/g

export interface ContactMask {
  placeholder: string
  value: string
  re: RegExp
  /**
   * Model bu yer tutucuyu metinde geçmediği hâlde yazarsa bu değer konabilir
   * (yalnız istek o iletişim alanıyla ilgiliyse; bkz. `createMasker`).
   * Yalnız kişinin kendi tekil iletişim değerleri için (referanslar birden
   * çok olabilir; konumun parçaları tam değerin yerine geçmez; ad hiç).
   */
  fallback: boolean
  /** Bulunan yazımı kabul eden ek denetim (ör. kısa yer adında büyük harf). `before`: eşleşmeden önceki karakter. */
  accept?: (found: string, before: string) => boolean
  /** Genel desen (her e-posta/telefon): yer tutucu hep numaralı (⟦EMAIL_2⟧…). */
  generic?: boolean
}

export interface ReferenceMaskSource {
  name?: string
  email?: string
  phone?: string
}

export type MaskSource = Partial<Pick<Personal, 'fullName' | 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website'>> & {
  /** Referans kişiler (gizli olanlar dahil: adları başka metinlerde geçebilir) */
  references?: ReferenceMaskSource[]
}

/** CV'nin bütün maske kaynakları: kişisel bilgiler + referans bölümlerindeki kişiler. */
export function maskSourceOf(cv: Pick<Cv, 'personal' | 'sections'>): MaskSource {
  const references = cv.sections
    .filter((s) => s.type === 'references')
    .flatMap((s) =>
      (s.items as AnyItem[]).map((item) => {
        const r = item as unknown as Record<string, unknown>
        const str = (v: unknown) => (typeof v === 'string' ? v : '')
        return { name: str(r.name), email: str(r.email), phone: str(r.phone) }
      }),
    )
  return { ...cv.personal, references }
}

// ---------------------------------------------------------------- Genel kalıplar

/** Metindeki e-posta adresleri (içe aktarma da kullanır). */
export const EMAIL_RE = /[\p{L}\p{M}\d._%+-]+@[\p{L}\p{M}\d.-]+\.[a-z]{2,}/giu
/** +90 532 123 45 67 · 0532 123 45 67 · (0532) 123-45-67 · +1 (415) 555-0132 · +44 20 7946 0958 */
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,4}/g

/** Telefon numarası mı (tarih aralığı, yıl dizisi ya da sözcüğe bitişik sayı değil)? `before`: önceki karakter. */
export function isPhone(candidate: string, before: string): boolean {
  const digits = candidate.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  // Tarih aralığı ya da yıl dizisi değil: "2019 - 2023 2024"
  if (/^(?:19|20)\d{2}\b/.test(candidate) && !candidate.startsWith('+')) return false
  if (/[\p{L}\d]$/u.test(before)) return false
  const start = candidate.trimStart()[0]
  return start === '+' || start === '(' || start === '0' || (digits.length === 10 && digits.startsWith('5'))
}

/** Metindeki telefon numaraları (yazıldığı gibi). */
export function phonesIn(text: string): string[] {
  const out: string[] = []
  for (const match of text.matchAll(PHONE_RE)) {
    const value = match[0].trim()
    const before = text.slice(Math.max(0, match.index - 1), match.index)
    if (isPhone(value, before)) out.push(value)
  }
  return out
}

// ---------------------------------------------------------------- Desenler

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Türkçe (ve şapkalı) harfin harfsiz yazımı da eşleşsin (ad ve yer adları: "AYSE" = "AYŞE", "Kamil" = "Kâmil") */
const ASCII_CLASS: Record<string, string> = {
  a: '[aâAÂ]',
  c: '[cçCÇ]',
  e: '[eêEÊ]',
  g: '[gğGĞ]',
  o: '[oöOÖ]',
  s: '[sşSŞ]',
  u: '[uüûUÜÛ]',
}
/** i/İ/ı/I/î: JavaScript'in büyük/küçük harf katlaması İ ve ı'yı i/I ile eşlemez. */
const I_CLASS = '[iIıİîÎ]'
/** Harften sonra gelebilecek birleşik işaretler (NFD yazım, "i̇" gibi Türkçe dışı küçültme) */
const MARKS = '\\p{M}*'

/**
 * Büyük/küçük harf duyarsız (`i` bayrağıyla birlikte) ve Türkçe i/İ/ı/I
 * farkını yok sayan desen. Her harften sonra birleşik işaret kabul edilir:
 * Türkçe dışı küçültmenin "İ" → "i̇" (birleşik nokta) biçimi ve NFD ile
 * ayrıştırılmış metin ("s" + U+0327) de yakalanır. Boşluklar herhangi bir
 * boşluk dizisiyle eşleşir. `ascii`: ç/ğ/ö/ş/ü/â/ê/î/û harfsiz yazımla da
 * eşleşir.
 */
export function loosePattern(value: string, options: { ascii?: boolean } = {}): string {
  let out = ''
  for (const ch of value.normalize('NFC')) {
    if (/\s/u.test(ch)) {
      if (!out.endsWith('\\s+')) out += '\\s+'
      continue
    }
    if (/\p{M}/u.test(ch)) continue // NFC'de birleşmeyen işaret: harften sonraki \p{M}* karşılar
    const key = fold(ch)
    if (key === 'i') out += I_CLASS
    else if (options.ascii && ASCII_CLASS[key]) out += ASCII_CLASS[key]
    else out += escapeRe(ch)
    if (/\p{L}/u.test(ch)) out += MARKS
  }
  return out
}

/** Sözcük sınırı: "Ali Can" adı "Kalina Canlı" içinde maskelenmesin. */
const bounded = (pattern: string) => `(?<![\\p{L}\\p{N}\\p{M}])(?:${pattern})(?![\\p{L}\\p{N}\\p{M}])`
/** Bağlantı/e-posta içindeki bitişik ad: yalnız harf sınırı (ardından rakam gelebilir: "kamilozturk92"). */
const letterBounded = (pattern: string) => `(?<![\\p{L}\\p{M}])(?:${pattern})(?![\\p{L}\\p{M}])`

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

const startsUpper = (found: string) => /^\p{Lu}/u.test(found)
const letterCount = (s: string) => s.replace(/[^\p{L}]/gu, '').length

interface NameMask {
  value: string
  pattern: string
  accept?: ContactMask['accept']
  /** 0: tam ad, 1: "Soyad, Ad" ve baş harfli biçimler, 2: tek parça, 'slug': bağlantıdaki bitişik biçim */
  tier: 0 | 1 | 2 | 'slug'
}

/**
 * Bir kişinin adından maskeler: tam ad, "Soyad, Ad", baş harfli biçimler,
 * tek tek parçalar (büyük harfle başlıyorsa, ≥ 3 harf) ve bağlantıdaki
 * bitişik biçimler (`slug`).
 */
function nameMasks(raw: string): NameMask[] {
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (name.length < 3) return []
  const lp = (s: string) => loosePattern(s, { ascii: true })
  const out: NameMask[] = [{ value: name, pattern: bounded(lp(name)), tier: 0 }]
  const parts = name
    .split(' ')
    .map((p) => p.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter((p) => letterCount(p) > 0)
  if (parts.length < 2) return out
  const last = parts[parts.length - 1]
  const firsts = parts.slice(0, -1)
  const first = firsts.join(' ')
  const initial = [...parts[0]][0]
  out.push({ value: `${last}, ${first}`, pattern: bounded(`${lp(last)}\\s*,\\s*${lp(first)}`), accept: startsUpper, tier: 1 })
  if (letterCount(last) >= 3) {
    out.push({ value: `${last}, ${initial}.`, pattern: bounded(`${lp(last)}\\s*,\\s*${lp(initial)}\\.`), accept: startsUpper, tier: 1 })
    out.push({ value: `${initial}. ${last}`, pattern: bounded(`${lp(initial)}\\.\\s*${lp(last)}`), accept: startsUpper, tier: 1 })
  }
  for (const part of parts) {
    if (letterCount(part) >= 3) out.push({ value: part, pattern: bounded(lp(part)), accept: startsUpper, tier: 2 })
  }
  // Bitişik biçimler: kamilozturk, kamil-ozturk, ozturk.kamil, k.ozturk (soyad ≤ 3 harfse ayraç zorunlu)
  const SEP = '[-._]?'
  const fold1 = (ps: string[]) => ps.map((p) => fold(p)).join('')
  const slugs: [string, string][] = [
    [fold1(parts), parts.map(lp).join(SEP)],
    [fold1([last, ...firsts]), [last, ...firsts].map(lp).join(SEP)],
  ]
  if (parts.length > 2) slugs.push([fold1([parts[0], last]), `${lp(parts[0])}${SEP}${lp(last)}`])
  if (letterCount(last) >= 3) slugs.push([`${fold(initial)}.${fold(last)}`, `${lp(initial)}${letterCount(last) >= 4 ? SEP : '[-._]'}${lp(last)}`])
  // 6 harften kısa bitişik biçim sıradan sözcüğe denk gelebilir ("Can Ak" → "çanak"): kurulmaz.
  for (const [value, pattern] of slugs) {
    if (letterCount(value) >= 6) out.push({ value: `slug:${value}`, pattern: letterBounded(pattern), tier: 'slug' })
  }
  return out
}

/** Konumun parçaları: "Atatürk Cad. No:5, Bornova/İzmir - Türkiye" → cadde, ilçe, il, ülke */
const LOCATION_SPLIT = /\s*[,/;|·•\n]\s*|\s+[-–—]\s+/
const isBroadPlace = (part: string) => {
  const key = fold(part).replace(/[.()]/g, '').trim()
  return COUNTRIES.has(key) || REMOTE_WORDS.has(key)
}

function locationValues(value: string): { value: string; full: boolean }[] {
  const full = value.normalize('NFC').trim().replace(/[ \t]+/g, ' ')
  if (!full) return []
  const parts = full
    .split(LOCATION_SPLIT)
    .map((p) => p.trim())
    .filter((p) => p.replace(/[^\p{L}\p{N}]/gu, '').length >= 3)
  const specific = parts.filter((p) => !isBroadPlace(p))
  // Yalnız ülke / "Uzaktan": kimlik belirtmez, maske yok.
  if (specific.length === 0) return []
  const out = [{ value: full, full: true }]
  for (const p of specific) if (!out.some((o) => o.value === p)) out.push({ value: p, full: false })
  return out
}

/**
 * Kişisel bilgilerden ve referanslardan maskeler (boş ya da çok kısa değerler
 * maskelenmez). Sıra önemlidir: önce bilinen iletişim değerleri (uzun önce:
 * bağlantı içindeki ad bağlantıdan önce maskelenmesin), sonra genel
 * e-posta/telefon, sonra bağlantıdaki bitişik adlar, sonra tam adlar ve tam
 * konum, sonra "Soyad, Ad" biçimleri, en son tek parçalar (ad ve konum
 * parçaları). Böylece "Ayşe Yılmaz, AYŞE YILMAZ" listesinde "Yılmaz, AYŞE"
 * ters ad sanılmaz; tam ad, parçalarından önce maskelenir.
 */
export function buildContactMasks(source: MaskSource): ContactMask[] {
  const contacts: ContactMask[] = []
  const slugs: ContactMask[] = []
  const tiers: ContactMask[][] = [[], [], []]
  const all = () => [...contacts, ...slugs, ...tiers.flat()]
  const add = (
    bucket: ContactMask[],
    placeholder: string,
    rawValue: string | undefined,
    pattern: string | null,
    fallback = false,
    accept?: ContactMask['accept'],
  ) => {
    const value = (rawValue ?? '').trim()
    // Aynı değer iki kez gelirse (ör. referansın e-postası kişininkiyle aynı) ilki kalır.
    if (!pattern || !value || all().some((m) => m.value === value)) return
    bucket.push({ placeholder, value, re: new RegExp(pattern, 'giu'), fallback, accept })
  }
  const addName = (placeholder: string, raw: string | undefined) => {
    for (const n of nameMasks(raw ?? '')) add(n.tier === 'slug' ? slugs : tiers[n.tier], placeholder, n.value, n.pattern, false, n.accept)
  }

  const email = (source.email ?? '').trim()
  add(contacts, '⟦EMAIL⟧', email, email.length >= 5 ? loosePattern(email) : null, true)
  add(contacts, '⟦PHONE⟧', source.phone, phonePattern(source.phone ?? ''), true)
  add(contacts, '⟦LINKEDIN⟧', source.linkedin, urlPattern(source.linkedin ?? ''), true)
  add(contacts, '⟦GITHUB⟧', source.github, urlPattern(source.github ?? ''), true)
  add(contacts, '⟦WEBSITE⟧', source.website, urlPattern(source.website ?? ''), true)
  addName('⟦NAME⟧', source.fullName)
  for (const loc of locationValues(source.location ?? '')) {
    const short = !/\s/.test(loc.value) && loc.value.replace(/[^\p{L}]/gu, '').length <= 4
    add(tiers[loc.full ? 0 : 2], '⟦LOCATION⟧', loc.value, bounded(loosePattern(loc.value, { ascii: true })), loc.full, short ? startsUpper : undefined)
  }
  for (const ref of source.references ?? []) {
    addName('⟦REFNAME⟧', ref.name)
    const refEmail = (ref.email ?? '').trim()
    add(contacts, '⟦REFEMAIL⟧', refEmail, refEmail.length >= 5 ? loosePattern(refEmail) : null)
    add(contacts, '⟦REFPHONE⟧', ref.phone, phonePattern(ref.phone ?? ''))
  }
  const byLength = (a: ContactMask, b: ContactMask) => b.value.length - a.value.length
  const generic: ContactMask[] = [
    { placeholder: '⟦EMAIL⟧', value: '', re: new RegExp(EMAIL_RE.source, 'giu'), fallback: false, generic: true },
    {
      placeholder: '⟦PHONE⟧',
      value: '',
      re: new RegExp(PHONE_RE.source, 'g'),
      fallback: false,
      generic: true,
      accept: (found, before) => isPhone(found, before),
    },
  ]
  return [...contacts.sort(byLength), ...generic, ...slugs.sort(byLength), ...tiers.flatMap((t) => t.sort(byLength))]
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

export interface MaskerOptions {
  /**
   * Metinde geçmediği hâlde modelin yazabileceği ve kişisel bilgideki değerle
   * doldurulacak yer tutucular: yalnız istekle açılan (değeri zaten açıkça
   * giden) iletişim alanları, ör. ['⟦EMAIL⟧']. Başkası uydurma sayılır.
   */
  fallback?: readonly string[]
  /** Başka bir maskeleme adımının kullandığı yer tutucular (çakışmasın) */
  reserved?: Iterable<string>
}

/** Metni yer tutucuların dışında kalan parçalarda dönüştürür (bir maske öncekinin yer tutucusuna dokunmasın). */
const outsidePlaceholders = (text: string, fn: (part: string) => string) =>
  text
    .split(/(⟦[A-Z]+(?:_\d+)?⟧)/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join('')

/**
 * Metinde bulunan özgün yazım → yer tutucu. Aynı değer farklı yazılmışsa
 * (ör. telefon biçimi, büyük harfli ad) her yazım ayrı yer tutucu alır
 * (⟦PHONE_2⟧) ki geri koyarken metin değişmesin.
 */
export function createMasker(masks: ContactMask[], options: MaskerOptions = {}): Masker {
  const originals = new Map<string, string>()
  const byText = new Map<string, string>()
  const reserved = new Set(options.reserved ?? [])
  const fallback = new Set(options.fallback ?? [])
  const mask = (text: string) => {
    let out = text
    for (const m of masks) {
      out = outsidePlaceholders(out, (part) =>
        part.replace(m.re, (found: string, ...rest: unknown[]) => {
          const offset = rest[rest.length - 2] as number
          const whole = rest[rest.length - 1] as string
          if (m.accept && !m.accept(found, whole.slice(Math.max(0, offset - 1), offset))) return found
          const known = byText.get(found)
          if (known) return known
          const base = m.placeholder.slice(1, -1)
          const at = (n: number) => (n === 1 ? m.placeholder : `⟦${base}_${n}⟧`)
          let n = m.generic ? 2 : 1
          while (originals.has(at(n)) || reserved.has(at(n))) n++
          const placeholder = at(n)
          originals.set(placeholder, found)
          byText.set(found, placeholder)
          return placeholder
        }),
      )
    }
    return out
  }
  // Model yer tutucuyu kendisi de yazabilir (ör. "⟦EMAIL⟧ adresinden ulaşın"): metinde geçmemişse
  // yalnız istekle açılan iletişim alanınınki doldurulur (`fallback`); gerisi olduğu gibi kalır (uydurma).
  const unmask = (s: string) =>
    s.replace(PLACEHOLDER_RE, (p) => originals.get(p) ?? (fallback.has(p) ? masks.find((m) => m.fallback && m.placeholder === p)?.value : undefined) ?? p)
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
