import type { AnyItem, Cv, Personal } from '@/cv/schema'
import { COUNTRIES, fold, REMOTE_WORDS } from './places'

/**
 * Sağlayıcıya giden metinlerde kişinin adı, iletişim bilgileri ve konumu ile
 * referans kişilerin adı ve iletişim bilgileri ⟦…⟧ yer tutucusuyla
 * maskelenir; yanıt gelince yerelde geri konur. Düzenleme (payload.ts),
 * çeviri (translate.ts), inceleme (review.ts) ve içe aktarma (pdfMask.ts)
 * aynı maskeyi kullanır.
 *
 * Eşleşme Türkçe büyük/küçük harfe dayanıklıdır: "Ayşe Yılmaz" →
 * "AYŞE YILMAZ", "ayşe yılmaz", i/İ/ı/I farkları (birleşik noktalı i dahil)
 * ve birden çok boşluk aynı değer sayılır. Ad ve yer adları aksansız
 * yazımla da eşleşir ("AYSE YILMAZ", "Kadikoy", "Kamil" = "Kâmil", "Jose" =
 * "José"): İngilizce CV'lerde ve bağlantılarda sık görülür. Ayrıştırılmış (NFD)
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
 * Deseni olan başka kişisel bilgiler (karar, 2026-11-19): TC kimlik / pasaport
 * numarası (⟦IDNO⟧: etiketli her numara, etiketsiz 11 haneli sayı), doğum
 * tarihi (⟦BIRTHDATE⟧: yalnız "Doğum tarihi:", "Date of birth:", "born …"
 * etiketinin ardındaki tarih; deneyim tarihleri değil), sokak adresi
 * (⟦ADDRESS⟧: "Mah./Sok./Cad./No:/D:" ya da "221 Baker Street" kalıpları),
 * sosyal profil bağlantısı (⟦PROFILE⟧), etiketli ya da @'li kullanıcı adı
 * (⟦HANDLE⟧) ve "ad [at] alan [dot] com" biçimindeki e-posta (⟦EMAIL_n⟧).
 * Hepsi en iyi çabadır ve kayıpsızdır: yanlış eşleşme yalnız modelin gördüğü
 * bağlamı azaltır.
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
 * Kullanıcının metninde zaten duran ⟦…⟧ (ya da tek başına ⟦ / ⟧) gerçek yer
 * tutucularla karışmasın diye ⟦RAW⟧ ile kaçışlanır ve yanıtta aynen geri konur.
 *
 * Geri koyma: yalnız gönderilen yer tutucular geri konur. Model metinde
 * geçmeyen bir yer tutucu yazarsa (uydurma) ya da yer tutucuyu bozarsa
 * ("⟦İSİM⟧", "⟦NAME 2⟧", "[EMAIL]", "⟦EMAIL") o değer atılır: çağıran,
 * geri koymadan ÖNCE `hasUnknownPlaceholder` ile denetler. Tek istisna: istek
 * bir iletişim alanını açıkça gönderdiyse (`createMasker`'ın `fallback`
 * seçeneği) o alanın yer tutucusu kişisel bilgideki değerle doldurulur.
 */

export const PLACEHOLDER_RE = /⟦[A-Z]+(?:_\d+)?⟧/g

/** Kullanılan yer tutucu türleri (bozulmuş yer tutucu denetimi bunları tanır). */
export const PLACEHOLDER_KINDS = [
  'NAME',
  'EMAIL',
  'PHONE',
  'LINKEDIN',
  'GITHUB',
  'WEBSITE',
  'LOCATION',
  'REFNAME',
  'REFEMAIL',
  'REFPHONE',
  'ADDRESS',
  'BIRTHDATE',
  'IDNO',
  'HANDLE',
  'PROFILE',
  'RAW',
] as const

export interface ContactMask {
  placeholder: string
  value: string
  re: RegExp
  /**
   * Model bu yer tutucuyu metinde geçmediği hâlde yazarsa bu değer konabilir
   * (yalnız istek o iletişim alanını açıkça gönderdiyse; bkz. `createMasker`).
   * Yalnız kişinin kendi tekil iletişim değerleri için (referanslar birden
   * çok olabilir; konumun parçaları tam değerin yerine geçmez; ad hiç).
   */
  fallback: boolean
  /** Bulunan yazımı kabul eden ek denetim (ör. kısa yer adında büyük harf). `before`: eşleşmeden önceki karakter. */
  accept?: (found: string, before: string) => boolean
  /** Genel desen (kişisel bilgiden bağımsız). E-posta ve telefonda yer tutucu hep numaralı (⟦EMAIL_2⟧…). */
  generic?: boolean
  /** Düzenli ifade yerine konum bulan işlev (sokak adresi): [başlangıç, bitiş) aralıkları, sıralı ve ayrık. */
  find?: (text: string) => [number, number][]
}

export interface ReferenceMaskSource {
  name?: string
  email?: string
  phone?: string
}

export type MaskSource = Partial<Pick<Personal, 'fullName' | 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website'>> & {
  /** Referans kişiler (gizli olanlar dahil: adları başka metinlerde geçebilir) */
  references?: ReferenceMaskSource[]
  /** Kişinin adının ek yazımları / zayıf ad adayları (PDF'te tahmin): ⟦NAME⟧ ile maskelenir */
  extraNames?: string[]
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

/** Rakam grupları arasındaki ayırıcı: boşluk, nokta, tire. Satır sonu ayırıcı DEĞİLDİR (alt satırdaki yıl telefona katılmasın). */
const PSEP = String.raw`[ \t .\-]`
/**
 * +90 532 123 45 67 · 0532 123 45 67 · (0532) 123-45-67 · 0(532) 123 45 67 · (0 532) 123 45 67 ·
 * 212 123 45 67 · +1 (415) 555-0132 · 415-555-0132 · +44 20 7946 0958 · 020 7946 0958
 */
export const PHONE_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}+])(?:\+\d{1,3}${PSEP}?)?(?:0${PSEP}?(?=\())?(?:\(${PSEP}?\d{1,4}(?:${PSEP}\d{1,4})?${PSEP}?\)${PSEP}?)?\d{2,4}(?:${PSEP}?\d{2,4}){1,4}(?!\d)`,
  'gu',
)

const YEAR_GROUP = /^(?:19|20)\d{2}$/

/** Telefon numarası mı (tarih aralığı, yıl dizisi, kimlik numarası ya da sözcüğe bitişik sayı değil)? `before`: önceki karakter. */
export function isPhone(candidate: string, before = ''): boolean {
  const c = candidate.trim()
  const digits = c.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/[\p{L}\d]$/u.test(before)) return false
  const plus = c.startsWith('+')
  if (!plus) {
    const groups = c.split(/\D+/).filter(Boolean)
    // Tarih aralığı ya da yıl dizisi: "2019 - 2023 2024"
    if (YEAR_GROUP.test(groups[0]) || groups.filter((g) => YEAR_GROUP.test(g)).length >= 2) return false
    // Tam tarih ya da ay.yıl içeren dizi: "01.02.2020 03.04.2021", "03.2020 05.2022"
    if (/(?<!\d)\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}(?!\d)/.test(c)) return false
    if (/(?<!\d)(?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}(?!\d)/.test(c)) return false
  }
  if (plus || c.startsWith('(') || c.startsWith('0')) return true
  if (digits.length === 10 && digits.startsWith('5')) return true
  // Ön eksiz ama ayraçlı: "212 123 45 67", "415-555-0132" (bitişik 10 hane herhangi bir numara olabilir)
  return /^[2-9]\d{2}[  .-]\d{3}[  .-](?:\d{4}|\d{2}[  .-]\d{2})$/.test(c)
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

/**
 * Aynı taban harfi paylaşan harfler: "e" → é, è, ê, ë, ē, ę… (büyükleriyle).
 * Unicode ayrıştırmasından (NFD: taban harf + birleşen işaretler) kurulur;
 * ayrışmayan birkaç harf (ı, ø, ł, đ) elle eklenir. Ad ve yer adları kendi
 * yazımıyla da ("José"), aksansız yazımla da ("Jose", "AYSE") eşleşir.
 */
const FAMILIES = new Map<string, string>()
;(() => {
  const add = (base: string, ch: string) => FAMILIES.set(base, (FAMILIES.get(base) ?? '') + ch)
  for (const [from, to] of [
    [0x00c0, 0x024f],
    [0x1e00, 0x1eff],
  ]) {
    for (let cp = from; cp <= to; cp++) {
      const ch = String.fromCodePoint(cp)
      if (!/\p{L}/u.test(ch)) continue
      const nfd = ch.normalize('NFD')
      if (nfd.length > 1 && /^[A-Za-z]$/.test(nfd[0])) add(nfd[0].toLowerCase(), ch)
    }
  }
  for (const [base, extra] of [
    ['i', 'ı'],
    ['o', 'øØ'],
    ['l', 'łŁ'],
    ['d', 'đĐ'],
  ]) {
    add(base, extra)
  }
})()

/** Harfin ASCII taban harfi (küçük): "É" → "e", "ş" → "s", "ı"/"İ" → "i", "ø" → "o"; taban yoksa null. */
function baseLetter(ch: string): string | null {
  const key = fold(ch).replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd')
  return /^[a-z]$/.test(key) ? key : null
}

const familyClass = (base: string) => `[${base}${base.toUpperCase()}${FAMILIES.get(base) ?? ''}]`
/** i/İ/ı/I/î: JavaScript'in büyük/küçük harf katlaması İ ve ı'yı i/I ile eşlemez; her kipte sınıfla eşleşir. */
const I_CLASS = familyClass('i')
/** Harften sonra gelebilecek birleşik işaretler (NFD yazım, "i̇" gibi Türkçe dışı küçültme) */
const MARKS = '\\p{M}*'

/**
 * Büyük/küçük harf duyarsız (`i` bayrağıyla birlikte) ve Türkçe i/İ/ı/I
 * farkını yok sayan desen. Her harften sonra birleşik işaret kabul edilir:
 * Türkçe dışı küçültmenin "İ" → "i̇" (birleşik nokta) biçimi ve NFD ile
 * ayrıştırılmış metin ("s" + U+0327) de yakalanır. Boşluklar herhangi bir
 * boşluk dizisiyle eşleşir. `ascii`: aksanlı her harf (ç, ğ, ö, ş, ü, â, é, è,
 * ë, á, ñ, š, ć…) hem kendi yazımıyla hem aksansız yazımla eşleşir.
 */
export function loosePattern(value: string, options: { ascii?: boolean } = {}): string {
  let out = ''
  for (const ch of value.normalize('NFC')) {
    if (/\s/u.test(ch)) {
      if (!out.endsWith('\\s+')) out += '\\s+'
      continue
    }
    if (/\p{M}/u.test(ch)) continue // NFC'de birleşmeyen işaret: harften sonraki \p{M}* karşılar
    const base = baseLetter(ch)
    const nfd = ch.normalize('NFD')
    if (base === 'i') out += I_CLASS
    else if (options.ascii && base) out += familyClass(base)
    // Aksanlı harf ayrıştırılmış yazımıyla da ("e" + U+0301) eşleşsin
    else if (nfd.length > 1) out += `(?:${escapeRe(ch)}|${escapeRe(nfd)})`
    else out += escapeRe(ch)
    if (/\p{L}/u.test(ch)) out += MARKS
  }
  return out
}

/** Sözcük sınırı (Unicode harf farkındalıklı): "Ali Can" adı "Kalina Canlı" içinde, "Rize" "summarize" içinde maskelenmesin. */
export const bounded = (pattern: string) => `(?<![\\p{L}\\p{N}\\p{M}])(?:${pattern})(?![\\p{L}\\p{N}\\p{M}])`
/** Bağlantı/e-posta içindeki bitişik ad: yalnız harf sınırı (ardından rakam gelebilir: "kamilozturk92"). */
const letterBounded = (pattern: string) => `(?<![\\p{L}\\p{M}])(?:${pattern})(?![\\p{L}\\p{M}])`

/**
 * Bağlantıyı protokol/www/son eğik çizgi farkı gözetmeden bulan desen. Harf
 * sınırıyla (Unicode): alana yalın kullanıcı adı yazıldıysa ("asil") sıradan
 * sözcüğün içi ("nasıl") eşleşmez; e-postanın yerel kısmı da (ardından "@").
 */
function urlPattern(value: string): string | null {
  const core = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
  if (core.length < 4) return null
  // Sondaki "/" yalnız ardından yol gelmiyorsa değere dahil (github.com/ad/proje → ⟦GITHUB⟧/proje).
  return `(?<![\\p{L}\\p{N}\\p{M}_@])(?:https?:\\/\\/)?(?:www\\.)?${loosePattern(core)}(?![\\p{L}\\p{N}\\p{M}_@-])(?:\\/(?![\\p{L}\\p{N}_-]))?`
}

/** Bilinen e-posta: başka bir adresin parçası olarak eşleşmez ("a@b.co" ≠ "a@b.com"). */
function emailPattern(value: string): string | null {
  if (value.length < 5) return null
  return `(?<![\\p{L}\\p{N}._%+-])${loosePattern(value)}(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}])`
}

/** Telefon: rakamlar arasında boşluk, nokta, tire, parantez olabilir; ülke kodu olmadan da yakalanır. */
function phonePattern(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 7) return null
  const variants = [digits]
  if (digits.length > 10) variants.push(digits.slice(-10))
  return variants
    .map((v) => `\\+?${v.split('').join('[\\s.\\-()]*')}(?!\\d)`)
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

// ---------------------------------------------------------------- Deseni olan kişisel bilgiler

const L = (s: string) => loosePattern(s, { ascii: true })
const WB = String.raw`(?<![\p{L}\p{N}])`
const WE = String.raw`(?![\p{L}\p{N}])`

/** "ad [at] alan [dot] com", "ad (at) alan.com", "ad at alan dot com" */
const AT_BRACKET = String.raw`\s*[\[({]\s*(?:at|et)\s*[\])}]\s*`
const DOT_BRACKET = String.raw`\s*[\[({]\s*(?:dot|nokta)\s*[\])}]\s*`
const DOT_WORD = String.raw`\s+(?:dot|nokta)\s+`
const HOST = String.raw`[\p{L}\d-]+`
const OBFUSCATED_EMAIL_RE = new RegExp(
  String.raw`(?<![\p{L}\d._%+-])[\p{L}\d._%+-]+(?:` +
    // köşeli/parantezli "at": nokta düz ya da yazıyla olabilir
    String.raw`${AT_BRACKET}${HOST}(?:(?:${DOT_BRACKET}|${DOT_WORD}|\.)${HOST})+` +
    '|' +
    // düz " at ": en az bir nokta yazıyla ("worked at example.com" e-posta değildir)
    String.raw`\s+at\s+${HOST}(?:\.${HOST})*(?:${DOT_BRACKET}|${DOT_WORD})${HOST}(?:(?:${DOT_BRACKET}|${DOT_WORD}|\.)${HOST})*` +
    String.raw`)(?![\p{L}\d])`,
  'giu',
)

/** Etiketin ardındaki tarih değeri: 12.03.1995 · 12/03/95 · 12 Mart 1995 · March 12, 1995 · 1995 */
const DATE_VALUE = String.raw`(?:\d{1,2}\s?[./-]\s?\d{1,2}\s?[./-]\s?(?:(?:19|20)\d{2}|\d{2})|\d{1,2}\.?\s+\p{L}{3,9}\.?,?\s+(?:19|20)\d{2}|\p{L}{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2}|(?:19|20)\d{2})(?!\d)`
const BIRTH_LABEL =
  `${WB}(?:` +
  `${L('doğum')}(?:\\s+${L('yeri')})?\\s*(?:${L('ve')}\\s+|[/,&-]\\s*)?(?:${L('tarihi')}|${L('tarih')}|${L('yılı')}|${L('günü')})(?:\\s*(?:${L('ve')}|[/&])\\s*${L('yeri')})?` +
  `|d\\.\\s*${L('tarihi')}|date\\s+of\\s+birth|birth\\s*date|birthday|year\\s+of\\s+birth|d\\.?o\\.?b\\.?|born(?:\\s+(?:on|in))?` +
  `)${WE}`
/** Doğum tarihi: yalnız etiketin ardındaki (aynı satırda, en çok 30 karakter sonra) tarih. Deneyim tarihleri eşleşmez. */
export const BIRTHDATE_RE = new RegExp(`(?<=${BIRTH_LABEL}\\s*[:：.–—-]?[^\\n\\d⟦⟧]{0,30}?)${DATE_VALUE}`, 'giu')

const ID_LABEL =
  `${WB}(?:` +
  `t\\.?\\s?c\\.?(?:\\s*${L('kimlik')})?(?:\\s*(?:no|${L('numarası')}|num)\\.?)?` +
  `|${L('kimlik')}\\s*(?:no|${L('numarası')})\\.?` +
  `|national\\s+id(?:entity)?(?:\\s*(?:no|number))?\\.?|id\\s*(?:no|number)\\.?` +
  `|passport(?:\\s*(?:no|number))?\\.?|${L('pasaport')}(?:\\s*(?:no|${L('numarası')}))?\\.?` +
  `|ssn|social\\s+security(?:\\s+(?:no|number))?\\.?` +
  `)(?![\\p{L}])`
/** Etiketli kimlik / pasaport numarası: "TC Kimlik No: 123…", "Passport No: U1234567" */
const LABELED_ID_RE = new RegExp(`(?<=${ID_LABEL}\\s*[:：#]?\\s*)(?:[A-Za-z]{1,2}[ -]?)?\\d(?:[ -]?\\d){5,12}(?![\\p{L}\\p{N}])`, 'giu')
/** Etiketsiz 11 haneli sayı (TC kimlik no biçimi; telefon 0 ya da + ile başlar, bu 1-9 ile) */
export const ID_NUMBER_RE = /(?<![\p{L}\p{N}.,/+-])[1-9]\d{10}(?![\p{L}\p{N}]|[.,]\d)/gu

/** Sosyal profil bağlantıları (kişinin kendi LinkedIn/GitHub alanı ayrıca maskelenir; proje adresleri olduğu gibi gider). */
const PROFILE_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}.@_-])(?:https?:\/\/)?(?:www\.|[a-z]{2,3}\.)?(?:` +
    String.raw`(?:twitter|x|instagram|facebook|fb|tiktok|threads|behance|dribbble|kaggle|medium|pinterest)\.(?:com|net)\/@?[\w.-]{2,}` +
    String.raw`|linkedin\.com\/(?:in|pub)\/[\p{L}\d%_.-]+` +
    String.raw`|t\.me\/\w{3,}` +
    String.raw`|youtube\.com\/(?:@|c\/|user\/|channel\/)[\w.-]+` +
    String.raw`|stackoverflow\.com\/users\/\d+(?:\/[\w.-]+)?` +
    String.raw`)\/?`,
  'giu',
)

/** "LinkedIn: aysecodes", "GitHub: @aysecodes": etiketin ardındaki kullanıcı adı ya da adres */
const HANDLE_LABEL = String.raw`${WB}(?:linkedin|github|gitlab|twitter|instagram|telegram|skype|discord|medium|behance|dribbble|kaggle|stack\s?overflow|tiktok|youtube|facebook)\s*[:：]\s*`
const LABELED_HANDLE_RE = new RegExp(String.raw`(?<=${HANDLE_LABEL})@?[\p{L}\d][^\s|,;<>⟦⟧()]{1,79}`, 'giu')
/** Tek başına "@aysecodes" ("@angular/core" gibi paket adları ve "@Component(" değil) */
const AT_HANDLE_RE = /(?<![\p{L}\p{N}@./_-])@[A-Za-z_][\w.-]{1,29}\w(?![\w/(])/gu

// Sokak adresi: işaretçiler (mahalle, sokak/cadde, kapı no, daire, kat, bina, posta kodu) bir aradaysa.
const ADDRESS_MARKERS: [string, RegExp][] = [
  ['mahalle', new RegExp(`${WB}(?:(?:${L('mah')}|${L('mh')})\\.|${L('mahallesi')}${WE})`, 'giu')],
  [
    'street',
    new RegExp(`${WB}(?:(?:${L('sok')}|${L('sk')}|${L('cad')}|${L('cd')}|${L('bulv')}|${L('blv')})\\.|(?:${L('sokağı')}|${L('caddesi')}|${L('bulvarı')})${WE})`, 'giu'),
  ],
  // "Çiçek Sokak", "1453. Sokak": sıradan sözcük ("sokak hayvanları") olmasın diye önünde büyük harf ya da sayı aranır
  ['street', new RegExp(`(?<=(?:\\p{Lu}[\\p{L}\\p{M}'’-]*|\\d+\\.?)\\s+)(?:Sokak|SOKAK|Cadde|CADDE)${WE}`, 'gu')],
  ['no', new RegExp(`${WB}no\\s*[:.]?\\s*\\d+[\\p{L}\\d/-]*`, 'giu')],
  ['unit', new RegExp(`${WB}(?:(?:${L('daire')}|d)\\s*[:.]\\s*\\d+|${L('daire')}\\s+\\d+)`, 'giu')],
  ['floor', new RegExp(`${WB}(?:(?:kat|k)\\s*[:.]\\s*\\d+|kat\\s+\\d+)`, 'giu')],
  ['building', new RegExp(`${WB}(?:apt\\.?|${L('apartmanı')}|${L('sitesi')}|blok|${L('bloğu')})${WE}`, 'giu')],
  ['postcode', new RegExp(`${WB}\\d{5}${WE}`, 'gu')],
  [
    'enstreet',
    /(?<![\p{L}\p{N}])\d{1,5}\s+(?:\p{Lu}[\p{L}'’.-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Square|Sq)\.?(?![\p{L}])/gu,
  ],
  ['unit', /(?<![\p{L}\p{N}])(?:apartment|suite|ste|unit|flat)\.?\s*#?\s*\d+[\p{L}\d-]*/giu],
]
const ADDRESS_DELIMITER = /[\n|;•·<>⟦⟧]/
/** İşaretçinin solundaki ad sözcükleri ("Atatürk", "Kadıköy/İstanbul, Moda") ve sağındaki ilçe/il ("Bornova / İzmir") */
const ADDRESS_LEFT = /(?:(?:\p{Lu}[\p{L}\p{M}'’.-]*|\d+\.?)(?:[ \t]*[,/-])?[ \t]+){1,4}$/u
const ADDRESS_RIGHT = /^(?:[ \t]*[,/-]?[ \t]*(?:\p{Lu}[\p{L}\p{M}'’-]*|\d{1,5}(?![\p{L}\d]))){1,5}/u

/** Metindeki sokak adreslerinin aralıkları (en iyi çaba). */
export function findAddresses(text: string): [number, number][] {
  const markers: { start: number; end: number; cat: string }[] = []
  for (const [cat, re] of ADDRESS_MARKERS) {
    for (const match of text.matchAll(re)) markers.push({ start: match.index, end: match.index + match[0].length, cat })
  }
  if (markers.length === 0) return []
  markers.sort((a, b) => a.start - b.start || b.end - a.end)
  const groups: { start: number; end: number; cats: Set<string> }[] = []
  for (const marker of markers) {
    const last = groups[groups.length - 1]
    const gap = last ? text.slice(last.end, Math.max(last.end, marker.start)) : ''
    if (last && marker.start <= last.end + 40 && !ADDRESS_DELIMITER.test(gap)) {
      last.end = Math.max(last.end, marker.end)
      last.cats.add(marker.cat)
    } else groups.push({ start: marker.start, end: marker.end, cats: new Set([marker.cat]) })
  }
  const out: [number, number][] = []
  for (const group of groups) {
    const streetish = group.cats.has('mahalle') || group.cats.has('street')
    if (!group.cats.has('enstreet') && !(streetish && group.cats.size >= 2)) continue
    const left = ADDRESS_LEFT.exec(text.slice(0, group.start))
    const right = ADDRESS_RIGHT.exec(text.slice(group.end))
    const start = left ? left.index : group.start
    const end = group.end + (right ? right[0].length : 0)
    const previous = out[out.length - 1]
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end)
    else out.push([start, end])
  }
  return out
}

const NEVER = /(?!)/g

/**
 * Kişisel bilgiden bağımsız genel desenler. Sıra önemlidir: kimlik numarası
 * telefondan, e-posta kullanıcı adından önce; adres en son (kalan metinde).
 */
function genericMasks(): ContactMask[] {
  const g = (placeholder: string, re: RegExp, accept?: ContactMask['accept']): ContactMask => ({
    placeholder,
    value: '',
    re: new RegExp(re.source, re.flags),
    fallback: false,
    generic: true,
    accept,
  })
  return [
    g('⟦EMAIL⟧', OBFUSCATED_EMAIL_RE),
    g('⟦EMAIL⟧', EMAIL_RE),
    g('⟦IDNO⟧', LABELED_ID_RE),
    g('⟦IDNO⟧', ID_NUMBER_RE),
    g('⟦PHONE⟧', PHONE_RE, (found, before) => isPhone(found, before)),
    g('⟦BIRTHDATE⟧', BIRTHDATE_RE),
    g('⟦PROFILE⟧', PROFILE_RE),
    g('⟦HANDLE⟧', LABELED_HANDLE_RE),
    g('⟦HANDLE⟧', AT_HANDLE_RE),
    { ...g('⟦ADDRESS⟧', NEVER), find: findAddresses },
  ]
}

/**
 * Kişisel bilgilerden ve referanslardan maskeler (boş ya da çok kısa değerler
 * maskelenmez). Sıra önemlidir: önce bilinen iletişim değerleri (uzun önce:
 * bağlantı içindeki ad bağlantıdan önce maskelenmesin), sonra genel desenler
 * (e-posta, kimlik no, telefon, doğum tarihi, profil, kullanıcı adı, adres),
 * sonra bağlantıdaki bitişik adlar, sonra tam adlar ve tam konum, sonra
 * "Soyad, Ad" biçimleri, en son tek parçalar (ad ve konum parçaları). Böylece
 * "Ayşe Yılmaz, AYŞE YILMAZ" listesinde "Yılmaz, AYŞE" ters ad sanılmaz; tam
 * ad, parçalarından önce maskelenir.
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
  add(contacts, '⟦EMAIL⟧', email, emailPattern(email), true)
  add(contacts, '⟦PHONE⟧', source.phone, phonePattern(source.phone ?? ''), true)
  add(contacts, '⟦LINKEDIN⟧', source.linkedin, urlPattern(source.linkedin ?? ''), true)
  add(contacts, '⟦GITHUB⟧', source.github, urlPattern(source.github ?? ''), true)
  add(contacts, '⟦WEBSITE⟧', source.website, urlPattern(source.website ?? ''), true)
  addName('⟦NAME⟧', source.fullName)
  for (const extra of source.extraNames ?? []) addName('⟦NAME⟧', extra)
  for (const loc of locationValues(source.location ?? '')) {
    const short = !/\s/.test(loc.value) && loc.value.replace(/[^\p{L}]/gu, '').length <= 4
    add(tiers[loc.full ? 0 : 2], '⟦LOCATION⟧', loc.value, bounded(loosePattern(loc.value, { ascii: true })), loc.full, short ? startsUpper : undefined)
  }
  for (const ref of source.references ?? []) {
    addName('⟦REFNAME⟧', ref.name)
    const refEmail = (ref.email ?? '').trim()
    add(contacts, '⟦REFEMAIL⟧', refEmail, emailPattern(refEmail))
    add(contacts, '⟦REFPHONE⟧', ref.phone, phonePattern(ref.phone ?? ''))
  }
  const byLength = (a: ContactMask, b: ContactMask) => b.value.length - a.value.length
  return [...contacts.sort(byLength), ...genericMasks(), ...slugs.sort(byLength), ...tiers.flatMap((t) => t.sort(byLength))]
}

export interface Masker {
  /** Metindeki değerleri yer tutucuya çevirir; aynı yazım hep aynı yer tutucuyu alır. */
  mask: (text: string) => string
  /** Yer tutucuları geri koyar; bilinmeyen yer tutucu olduğu gibi kalır. */
  unmask: (text: string) => string
  /** Şimdiye kadar kullanılan yer tutucular */
  placeholders: () => string[]
  /** Yanıtta geçebilecek yer tutucular: kullanılanlar + istekle açılan iletişim alanlarınınki */
  known: () => string[]
  /**
   * Sıkı geri koyma: yanıtta tanınmayan ya da bozulmuş yer tutucu varsa null
   * (o değer gösterilmez); yoksa yer tutucular geri konmuş metin.
   */
  restore: (text: string) => string | null
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
  /**
   * Önceki bir maskeleme adımının metne koyduğu yer tutucular: olduğu gibi
   * kalır (kaçışlanmaz), yenileri bunlarla çakışmaz.
   */
  reserved?: Iterable<string>
}

/** Metni yer tutucuların dışında kalan parçalarda dönüştürür (bir maske öncekinin yer tutucusuna dokunmasın). */
const outsidePlaceholders = (text: string, fn: (part: string) => string) =>
  text
    .split(/(⟦[A-Z]+(?:_\d+)?⟧)/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join('')

/** Kullanıcının metninde duran yer tutucu benzeri dizgi ya da tek başına ayraç */
const LITERAL_RE = /⟦[^⟦⟧\n]{0,40}⟧|[⟦⟧]/g

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
  const issue = (basePlaceholder: string, found: string, from: number) => {
    const known = byText.get(found)
    if (known) return known
    const base = basePlaceholder.slice(1, -1)
    const at = (n: number) => (n === 1 ? basePlaceholder : `⟦${base}_${n}⟧`)
    let n = from
    while (originals.has(at(n)) || reserved.has(at(n))) n++
    const placeholder = at(n)
    originals.set(placeholder, found)
    byText.set(found, placeholder)
    return placeholder
  }
  const numberFrom = (m: ContactMask) => (m.generic && (m.placeholder === '⟦EMAIL⟧' || m.placeholder === '⟦PHONE⟧') ? 2 : 1)
  const mask = (text: string) => {
    // Kullanıcının kendi yazdığı ⟦…⟧ gerçek yer tutucularla karışmasın: kaçışlanır, yanıtta aynen geri konur.
    let out = text.replace(LITERAL_RE, (token) => (reserved.has(token) ? token : issue('⟦RAW⟧', token, 1)))
    for (const m of masks) {
      out = outsidePlaceholders(out, (part) => {
        if (m.find) {
          let result = ''
          let at = 0
          for (const [start, end] of m.find(part)) {
            result += part.slice(at, start) + issue(m.placeholder, part.slice(start, end), numberFrom(m))
            at = end
          }
          return result + part.slice(at)
        }
        return part.replace(m.re, (found: string, ...rest: unknown[]) => {
          // Adlandırılmış grup yok: son iki bağımsız değişken konum ve bütün metin.
          const offset = rest[rest.length - 2] as number
          const whole = rest[rest.length - 1] as string
          if (!found || (m.accept && !m.accept(found, whole.slice(Math.max(0, offset - 1), offset)))) return found
          return issue(m.placeholder, found, numberFrom(m))
        })
      })
    }
    return out
  }
  // Model yer tutucuyu kendisi de yazabilir (ör. "⟦EMAIL⟧ adresinden ulaşın"): metinde geçmemişse
  // yalnız istekle açılan iletişim alanınınki doldurulur (`fallback`); gerisi olduğu gibi kalır (uydurma).
  const fallbackValue = (p: string) => (fallback.has(p) ? masks.find((m) => m.fallback && m.placeholder === p)?.value : undefined)
  const unmask = (s: string) => s.replace(PLACEHOLDER_RE, (p) => originals.get(p) ?? fallbackValue(p) ?? p)
  const known = () => [...originals.keys(), ...[...fallback].filter((p) => !originals.has(p) && fallbackValue(p) !== undefined)]
  return {
    mask,
    unmask,
    placeholders: () => [...originals.keys()],
    known,
    restore: (text) => (hasUnknownPlaceholder(text, known()) ? null : unmask(text)),
    map: () => Object.fromEntries(originals),
  }
}

/**
 * Yer tutucu → değer tablosundan sıkı geri koyma (PDF yolları: içe aktarma,
 * inceleme): yanıtta tanınmayan ya da bozulmuş yer tutucu varsa null (o değer
 * gösterilmez ya da yazılmaz); yoksa yer tutucular geri konmuş metin.
 */
export function strictRestorer(map: Record<string, string>): (text: string) => string | null {
  const known = new Set(Object.keys(map))
  return (text) => (hasUnknownPlaceholder(text, known) ? null : text.replace(PLACEHOLDER_RE, (p) => map[p] ?? p))
}

/** Metindeki yer tutucular (sırasız, tekil) */
export function placeholdersIn(text: string): Set<string> {
  return new Set(text.match(PLACEHOLDER_RE) ?? [])
}

/** Metinde yer tutucu ayracı (⟦ ya da ⟧) kaldı mı? Geri koymadan sonra kalan her ayraç geri konamamış demektir. */
export function hasPlaceholder(text: string): boolean {
  return /[⟦⟧]/.test(text)
}

/**
 * Yanıtta tanınmayan ya da bozulmuş yer tutucu var mı? Geri koymadan ÖNCE,
 * modelin yazdığı (maskeli) metinde denetlenir:
 * - `known` dışındaki her ⟦…⟧ (uydurma: ⟦PHONE_9⟧; bozuk: ⟦İSİM⟧, ⟦Name⟧, ⟦NAME 2⟧),
 * - eşi olmayan ⟦ ya da ⟧ ("⟦EMAIL"),
 * - gönderilen türlerin başka ayraçla yazımı ("[EMAIL]", "{NAME_2}", "<PHONE>").
 */
export function hasUnknownPlaceholder(text: string, known: Iterable<string>): boolean {
  const set = known instanceof Set ? (known as Set<string>) : new Set(known)
  const rest = text.replace(PLACEHOLDER_RE, (p) => (set.has(p) ? ' ' : p))
  if (/[⟦⟧]/.test(rest)) return true
  const kinds = new Set([...set].map((p) => /^⟦([A-Z]+)/.exec(p)?.[1]).filter((k): k is string => !!k))
  if (kinds.size === 0) return false
  return new RegExp(`[\\[{<«【〚⟨]\\s*(?:${[...kinds].join('|')})(?:[ _-]?\\d+)?\\s*[\\]}>»】〛⟩]`).test(rest)
}
