import type { CvLanguage } from '@/cv/schema'
import { fold } from './text'

/**
 * İş ilanı ↔ CV kaba anahtar kelime karşılaştırması. Anlam bilmez: ilandaki
 * sık ve teknik görünen kelimeleri/ikilileri çıkarır, CV'de (ek ve çoğul
 * farkını yok sayarak) arar. Anlamsal karşılaştırma yapay zekâ bağlanınca.
 */

export type KeywordKind = 'tech' | 'phrase' | 'term'

export interface Keyword {
  /** İlanda en sık geçen yazılışı */
  term: string
  /** Karşılaştırma anahtarı (kök, katlanmış) */
  key: string
  kind: KeywordKind
  /** İlanda kaç kez geçiyor */
  count: number
  /** CV'de kaç kez geçiyor */
  cvCount: number
}

export interface KeywordMatch {
  present: Keyword[]
  missing: Keyword[]
  /** İlanın dili (kök bulma buna göre) */
  language: CvLanguage
}

// Katlanmış biçimde (aksansız, küçük harf).
const STOP_TR = `
acaba ama ancak artik aslinda az bana bazen bazi belki ben beni benim beri bile bir birkac birsey biz bize bizi bizim
bu buna bunda bundan bunu bunun burada cok cunku da daha dahi de defa diye dolayi en gibi hem hep hepsi her hic icin
ile ise iste kadar ki kim kimi mi mu mi neden nasil ne nerde nerede nereye niye o olan olarak oldu olduk oldugu olmak
olmasi olsun olur on ona ondan onlar onlari onlarin onu onun orada oyle pek ra sadece sanki se sey siz sizi sizin
sonra su suna sunu tarafindan tum ve veya ya yani yine yoksa zaten uzere uzerinde icinde arasinda gore dahil ayrica
olmali olabilecek olacak olan olmayan veya ya da ise eger herhangi kendi kendini tarafindan surekli ile ilgili
`
const STOP_EN = `
a about above after again against all also am an and any are as at be because been before being below between both
but by can could did do does doing down during each etc few for from further had has have having he her here hers him
his how i if in into is it its itself just me more most my no nor not of off on once only or other our ours out over
own same she should end so some such than that the their them then there these they this those through to too under until
up very was we were what when where which while who whom why will with would you your yours within across per via
including include includes must may might shall well able plus new using use used eg ie
`
/** İlanların her yerinde geçen, kendi başına bir şey söylemeyen kelimeler */
const GENERIC = `
aranan aranilan nitelik nitelikler genel tanim tanimi sorumluluk sorumluluklar gorev gorevler aday adaylar tercihen tercih
sebep sahip iyi derece derecede duzey duzeyde seviye seviyede yil yillik deneyim deneyimli tecrube tecrubeli bilgi bilgili
bilgisi konusunda alaninda ilgili calisacak calisma calismak arkadas arkadaslar ariyoruz katilacak firma firmamiz sirket
sirketimiz bunyemizde pozisyon pozisyonu takim ekip ekibimize ekibimiz kisi kisiler yetkin yetkinlik is isi isler olan
olumlu yuksek guclu tam zamanli istanbul ankara izmir lokasyon basvuru imkan imkani imkanlari en az hakim hakimiyet
yatkin ilgi duyan arti yazabilen kullanabilen olabilen bilen sahibi istekli tercihen
requirement requirements responsibility responsibilities qualification qualifications preferred required experience
experienced year years strong ability knowledge work working team teams role position candidate candidates job company
looking seeking join opportunity skills skill excellent good great plus bonus nice minimum least degree etc ideal
`
const toSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean))
const STOP = new Set([...toSet(STOP_TR), ...toSet(STOP_EN)])
const GENERIC_SET = toSet(GENERIC)

/**
 * Cümle başında büyük harfle yazılsa da (madde başı) önemli sayılan yaygın
 * teknoloji, araç ve dil adları. Ortada büyük harfle geçen her kelime zaten
 * özel ad sayılır; bu liste yalnız madde başlarını kurtarır.
 */
const KNOWN = toSet(`
react angular vue svelte nextjs python java kotlin swift go golang rust ruby rails php laravel django flask spring
docker kubernetes terraform ansible jenkins git github gitlab jira confluence figma sketch photoshop illustrator
excel powerpoint sap salesforce tableau linux unix azure gcp aws kafka redis postgresql postgres mysql mongodb
elasticsearch graphql rest grpc html css sass javascript typescript webpack vite jest cypress playwright selenium
pandas numpy pytorch tensorflow spark hadoop airflow snowflake dbt looker scrum agile kanban oracle android ios
flutter unity matlab autocad solidworks revit bootstrap tailwind nginx prometheus grafana datadog sentry bash
powershell ingilizce almanca fransizca ispanyolca english german french spanish seo sql nosql erp crm
`)

// Türkçe ekler (katlanmış). Uzundan kısaya; kök en az 3 harf kalır.
const TR_SUFFIXES = [
  'larinda', 'lerinde', 'larini', 'lerini', 'larin', 'lerin', 'lari', 'leri', 'lar', 'ler',
  'sinda', 'sinde', 'sunda', 'sunde', 'indaki', 'indeki', 'daki', 'deki', 'taki', 'teki',
  'sini', 'sunu', 'ini', 'unu', 'nin', 'nun', 'lik', 'luk', 'li', 'lu', 'siz', 'suz',
  'dan', 'den', 'tan', 'ten', 'da', 'de', 'ta', 'te', 'yla', 'yle', 'la', 'le',
  'si', 'su', 'in', 'un', 'ya', 'ye', 'yi', 'yu', 'i', 'u', 'a', 'e',
]

/**
 * Hafif kök bulma: Türkçede ekleri (tekrarlı) atar, İngilizcede çoğul ve
 * yaygın sonekleri. Amaç dilbilgisi değil, iki tarafı aynı anahtara indirmek.
 */
export function stem(word: string, language: CvLanguage): string {
  let w = word
  if (language === 'tr') {
    for (let round = 0; round < 3; round++) {
      const suffix = TR_SUFFIXES.find((s) => w.endsWith(s) && w.length - s.length >= 4)
      if (!suffix) break
      w = w.slice(0, -suffix.length)
    }
    return w
  }
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 5 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1)
  if (w.length > 6 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2)
  return w
}

interface Token {
  raw: string
  /** Katlanmış ve teknik işaretler sadeleşmiş biçim */
  norm: string
  tech: boolean
  capital: boolean
  /** Cümle başı mı (büyük harf bilgisi o zaman anlamsız) */
  sentenceStart: boolean
  /** Önceki tokenla arasında noktalama var mı (ikili kurulmaz) */
  breakBefore: boolean
}

// Harf/rakamla başlayan, içinde + # . / - _ olabilen kelime; ".NET" gibi baştaki nokta da.
const TOKEN_RE = /(?<![\p{L}\p{N}])\.?[\p{L}\p{N}](?:[\p{L}\p{N}+#./_-]*[\p{L}\p{N}+#])?/gu

/** "Node.js" → "nodejs", "CI/CD" → "cicd", "C#" aynı kalır. */
function normalizeTech(folded: string): string {
  return folded.replace(/[./_-]/g, '')
}

/**
 * Teknik görünümlü mü: rakam, + # . / içerir ("C#", "Node.js", "CI/CD"),
 * ortasında büyük harf vardır ("TypeScript", "iOS") ya da kısa kısaltmadır
 * ("SQL", "AWS"). Uzun büyük harfli kelime başlıktır ("NİTELİKLER"), teknik değil.
 */
function isTech(raw: string): boolean {
  if (/[\p{N}+#./]/u.test(raw)) return true
  const upper = raw === raw.toLocaleUpperCase('tr') || raw === raw.toUpperCase()
  if (upper) return raw.length >= 2 && raw.length <= 5
  return /\p{Lu}/u.test(raw.slice(1))
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN_RE)) {
    const at = match.index ?? 0
    const gap = text.slice(last, at)
    last = at + match[0].length
    // Türkçe kesme işaretinden sonraki ek atılır: "React'te" → "React"
    let raw = match[0]
    const sentenceStart = tokens.length === 0 || /[.!?:;•\n]/.test(gap)
    const breakBefore = sentenceStart || /[,()[\]{}"“”|]/.test(gap)
    if (/['’]$/.test(gap) && tokens.length) continue
    // "React/Vue" gibi uzun parçalar ayrılır; "CI/CD", "UI/UX", "TCP/IP" kalır.
    const parts = raw.includes('/') && raw.split('/').some((p) => p.length > 3) ? raw.split('/') : [raw]
    parts.forEach((part, i) => {
      raw = part.replace(/^\.+/, '').replace(/[.-]+$/, '')
      if (!raw) return
      const tech = isTech(raw)
      const folded = fold(raw)
      tokens.push({
        raw,
        norm: tech ? normalizeTech(folded) : folded,
        tech,
        capital: /^\p{Lu}/u.test(raw),
        sentenceStart: sentenceStart && i === 0,
        breakBefore: breakBefore || i > 0,
      })
    })
  }
  return tokens
}

/** İlanın dili: Türkçe ve İngilizce bağlaçların sayısına göre. */
export function detectLanguage(text: string, fallback: CvLanguage = 'tr'): CvLanguage {
  const words = fold(text).split(/[^\p{L}]+/u)
  const tr = words.filter((w) => ['ve', 'ile', 'bir', 'icin', 'olarak', 'veya', 'olan', 'bu', 'gibi'].includes(w)).length
  const en = words.filter((w) => ['and', 'the', 'with', 'for', 'of', 'to', 'you', 'our', 'in'].includes(w)).length
  if (tr === en) return fallback
  return tr > en ? 'tr' : 'en'
}

function keyOf(token: Token, language: CvLanguage): string {
  return token.tech ? token.norm : stem(token.norm, language)
}

const genericStems: Partial<Record<CvLanguage, Set<string>>> = {}
function isGeneric(norm: string, language: CvLanguage): boolean {
  if (STOP.has(norm) || GENERIC_SET.has(norm)) return true
  genericStems[language] ??= new Set([...GENERIC_SET].map((w) => stem(w, language)))
  return genericStems[language].has(stem(norm, language))
}

function isContent(token: Token, language: CvLanguage): boolean {
  if (isGeneric(token.norm, language)) return false
  if (/^\p{N}+\+?$/u.test(token.norm)) return false
  if (KNOWN.has(token.norm)) return true
  if (token.norm.length < 2) return false
  // Tek harf yalnız "C#" / "C++" gibi teknik biçimde anlamlı.
  if (token.norm.length < 3 && !token.tech) return false
  return true
}

interface Candidate {
  key: string
  kind: KeywordKind
  count: number
  forms: Map<string, number>
}

/** İlandan anahtar kelimeleri çıkarır, önem sırasıyla. */
export function extractKeywords(adText: string, language: CvLanguage, limit = 40): Omit<Keyword, 'cvCount'>[] {
  const tokens = tokenize(adText)
  const content = tokens.map((t) => isContent(t, language))
  const keys = tokens.map((t) => keyOf(t, language))
  const unigrams = new Map<string, Candidate>()
  const phrases = new Map<string, Candidate & { capitalized: number }>()
  const bump = <T extends Candidate>(map: Map<string, T>, key: string, form: string, init: () => T) => {
    const c = map.get(key) ?? init()
    c.count++
    c.forms.set(form, (c.forms.get(form) ?? 0) + 1)
    map.set(key, c)
    return c
  }
  const phrase = (from: number, to: number, capitalized: boolean) => {
    const key = keys.slice(from, to + 1).join(' ')
    const form = tokens.slice(from, to + 1).map((t) => t.raw).join(' ')
    const p = bump(phrases, key, form, () => ({ key, kind: 'phrase', count: 0, forms: new Map(), capitalized: 0 }))
    if (capitalized) p.capitalized++
  }

  tokens.forEach((t, i) => {
    if (!content[i]) return
    // Ortada büyük harfle geçen kelime özel addır (araç, ürün, teknoloji); madde başında yalnız bilinenler.
    const proper = (t.capital && !t.sentenceStart) || KNOWN.has(t.norm)
    const u = bump(unigrams, keys[i], t.raw, () => ({ key: keys[i], kind: 'term', count: 0, forms: new Map() }))
    if (t.tech || proper) u.kind = 'tech'
  })

  // Büyük harfli diziler ("Senior Backend Engineer", "Machine Learning") tek ifade;
  // diğer ikililer ilanda en az iki kez geçerse ifade sayılır.
  let i = 0
  while (i < tokens.length) {
    let j = i
    const capital = (k: number) => content[k] && tokens[k].capital
    while (j + 1 < tokens.length && j - i < 3 && capital(i) && capital(j + 1) && !tokens[j + 1].breakBefore) j++
    // Aynı kelimenin tekrarı ya da boşlukla sıralanmış araç listesi ("React Vue Angular") ifade değildir.
    const run = tokens.slice(i, j + 1)
    const toolList = run.length > 2 && run.every((t) => t.tech || KNOWN.has(t.norm))
    if (j > i) {
      if (!toolList && new Set(keys.slice(i, j + 1)).size === run.length) phrase(i, j, true)
      i = j + 1
      continue
    }
    if (i + 1 < tokens.length && content[i] && content[i + 1] && !tokens[i + 1].breakBefore && keys[i] !== keys[i + 1])
      phrase(i, i + 1, false)
    i++
  }

  const kept = [...phrases.values()].filter((p) => p.capitalized > 0 || p.count >= 2)
  // İfadenin içindeki tekil kelimeler ifade kadar düşülür; yalnız ifadede geçiyorsa listeden çıkar.
  const rest = new Map([...unigrams].map(([k, u]) => [k, u.count]))
  for (const p of kept) for (const part of p.key.split(' ')) if (rest.has(part)) rest.set(part, rest.get(part)! - p.count)
  const singles = [...unigrams.values()].filter((u) => rest.get(u.key)! > 0)

  const all: Candidate[] = [...kept, ...singles]
  // Tek kez geçen sıradan kelime gürültüdür; teknik terim tek geçse de önemlidir.
  const chosen = all.filter((c) => c.kind !== 'term' || c.count >= 2 || all.length <= 12)
  const weight = (c: Candidate) => c.count * (c.kind === 'tech' ? 2 : c.kind === 'phrase' ? 1.6 : 1)
  chosen.sort((a, b) => weight(b) - weight(a) || a.key.localeCompare(b.key))

  return chosen.slice(0, limit).map((c) => {
    // En sık yazılış; eşitlikte en kısa (eksiz) biçim
    const term = [...c.forms.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]
    return { term, key: c.key, kind: c.kind, count: c.count }
  })
}

/** CV metnindeki tekil, ikili ve üçlü anahtarların sayısı */
function indexText(text: string, language: CvLanguage) {
  const tokens = tokenize(text)
  const keys = tokens.map((t) => keyOf(t, language))
  const counts = new Map<string, number>()
  const inc = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1)
  tokens.forEach((t, i) => {
    inc(keys[i])
    // Teknik terim düz yazılmış olabilir ("nodejs" ↔ "Node.js"): katlanmış biçim de eklenir.
    if (!t.tech) inc(normalizeTech(t.norm))
    for (let n = 1; n <= 3 && i - n >= 0; n++) inc(keys.slice(i - n, i + 1).join(' '))
  })
  return counts
}

export function matchJobAd(adText: string, cvText: string, language: CvLanguage): KeywordMatch {
  const lang = detectLanguage(adText, language)
  const keywords = extractKeywords(adText, lang)
  const cv = indexText(cvText, lang)
  const present: Keyword[] = []
  const missing: Keyword[] = []
  for (const k of keywords) {
    const cvCount = cv.get(k.key) ?? 0
    ;(cvCount > 0 ? present : missing).push({ ...k, cvCount })
  }
  return { present, missing, language: lang }
}
