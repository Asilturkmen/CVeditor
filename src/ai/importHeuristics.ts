import type { CvLanguage } from '@/cv/schema'
import { detectLanguage, EMAIL_RE, extractContacts, fold, joinWrappedUrls, looksLikeLocation, phonesIn } from './importText'
import type { ImportRequest, ImportResult } from './types'

/**
 * Kurala dayalı ön ayrıştırma: yapay zekâ bağlanana kadar (ve bağlantı
 * yokken) PDF metnini CV kayıtlarına böler. Bölüm başlıklarını (TR/EN)
 * tanır, kayıtları tarih satırlarından ayırır, maddeleri ve satır
 * kaymalarını birleştirir. Tanınmayan metin "Diğer" bölümüne gider; hiçbir
 * şey sessizce atılmaz. Sonuç her zaman kullanıcı onayından geçer.
 *
 * Girdi maskeli olabilir (⟦EMAIL⟧ gibi); yer tutucular ilgili alana
 * yazılır, asıl değerleri çağıran yerelde geri koyar.
 */

type SectionType = ImportResult['sections'][number]['type']
type ImportSection = ImportResult['sections'][number]
type ImportItem = ImportSection['items'][number]

// ---------------------------------------------------------------- Başlıklar

type HeadingKind = SectionType | 'contact'
interface Heading {
  kind: HeadingKind
  /** Bölüm başlığı korunacaksa (özel bölüm, staj) asıl başlık */
  keepTitle: boolean
}

const HEADING_TABLE: [HeadingKind, boolean, string[]][] = [
  [
    'summary',
    false,
    [
      'ozet', 'hakkimda', 'profil', 'profile', 'summary', 'professional summary', 'profesyonel ozet', 'kariyer hedefi',
      'career objective', 'objective', 'about me', 'about', 'kisa ozet', 'genel bakis', 'overview', 'kariyer ozeti',
      'career summary', 'profesyonel profil', 'professional profile', 'ozgecmis ozeti', 'kisisel ozet', 'personal statement',
    ],
  ],
  [
    'experience',
    false,
    [
      'deneyim', 'deneyimler', 'is deneyimi', 'is deneyimleri', 'is tecrubesi', 'tecrube', 'tecrubeler',
      'profesyonel deneyim', 'mesleki deneyim', 'calisma deneyimi', 'is gecmisi', 'kariyer', 'experience',
      'work experience', 'professional experience', 'employment', 'employment history', 'work history',
      'career history', 'relevant experience', 'experiences',
    ],
  ],
  ['experience', true, ['staj', 'stajlar', 'staj deneyimi', 'staj deneyimleri', 'internship', 'internships', 'internship experience']],
  [
    'education',
    false,
    ['egitim', 'egitim bilgileri', 'egitim gecmisi', 'ogrenim', 'ogrenim bilgileri', 'education', 'academic background', 'akademik gecmis', 'education & training'],
  ],
  [
    'skills',
    false,
    [
      'beceriler', 'yetenekler', 'yetkinlikler', 'teknik beceriler', 'teknik yetenekler', 'teknik yetkinlikler',
      'bilgisayar becerileri', 'bilgisayar bilgisi', 'skills', 'technical skills', 'core skills', 'key skills',
      'core competencies', 'competencies', 'skills & tools', 'tools & technologies', 'technologies', 'teknolojiler',
      'araclar & teknolojiler', 'beceriler & yetkinlikler', 'skills & abilities', 'hard skills', 'soft skills',
      'kisisel beceriler', 'skills & expertise', 'uzmanlik alanlari', 'expertise',
    ],
  ],
  [
    'projects',
    false,
    ['projeler', 'proje', 'projects', 'personal projects', 'selected projects', 'side projects', 'kisisel projeler', 'academic projects', 'akademik projeler', 'secili projeler'],
  ],
  [
    'languages',
    false,
    ['diller', 'yabanci diller', 'yabanci dil', 'dil bilgisi', 'dil becerileri', 'languages', 'language skills', 'language'],
  ],
  [
    'certificates',
    false,
    [
      'sertifikalar', 'sertifika', 'sertifikalar & kurslar', 'kurslar & sertifikalar', 'kurslar',
      'egitimler & sertifikalar', 'sertifika & kurslar', 'certificates', 'certifications', 'certificates & courses',
      'certifications & courses', 'courses', 'licenses & certifications', 'certifications & licenses',
      'lisanslar & sertifikalar',
    ],
  ],
  [
    'awards',
    false,
    ['oduller', 'basarilar', 'oduller & basarilar', 'basarilar & oduller', 'awards', 'honors', 'honors & awards', 'awards & honors', 'achievements', 'awards & achievements'],
  ],
  [
    'volunteer',
    false,
    [
      'gonulluluk', 'gonullu calismalar', 'gonullu deneyim', 'gonulluluk deneyimi', 'gonullu faaliyetler',
      'sosyal sorumluluk', 'toplumsal calismalar', 'volunteer', 'volunteering', 'volunteer experience',
      'volunteer work', 'community involvement',
    ],
  ],
  ['references', false, ['referanslar', 'referans', 'references']],
  [
    'contact',
    true,
    ['iletisim', 'iletisim bilgileri', 'kisisel bilgiler', 'contact', 'contact information', 'contact info', 'personal information', 'personal details', 'kisisel detaylar'],
  ],
  [
    'custom',
    true,
    [
      'hobiler', 'ilgi alanlari', 'hobiler & ilgi alanlari', 'interests', 'hobbies', 'hobbies & interests',
      'yayinlar', 'publications', 'uyelikler', 'memberships', 'konferanslar', 'conferences', 'etkinlikler',
      'activities', 'extracurricular activities', 'ders disi etkinlikler', 'kulupler', 'clubs', 'leadership',
      'liderlik', 'patentler', 'patents', 'research', 'arastirma', 'arastirmalar', 'tez', 'thesis',
    ],
  ],
]

const HEADINGS = new Map<string, Heading>()
for (const [kind, keepTitle, keys] of HEADING_TABLE) {
  for (const key of keys) {
    HEADINGS.set(key, { kind, keepTitle })
    // Harf aralıklı ya da bitişik yazılmış başlıklar için boşluksuz biçim
    HEADINGS.set(key.replace(/[ &]/g, ''), { kind, keepTitle })
  }
}

/** Satır bir bölüm başlığıysa türünü döndürür ("İŞ DENEYİMİ", "D E N E Y İ M", "Skills:"). */
export function headingOf(line: string): Heading | null {
  const raw = line.trim()
  if (!raw || raw.length > 48 || /\d{2}|@|⟦/.test(raw)) return null
  const letters = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
  if (!letters) return null
  const key = fold(letters)
    .replace(/\s*(?:&|\+|\/|,)\s*|\s+(?:ve|and)\s+/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim()
  return HEADINGS.get(key) ?? HEADINGS.get(key.replace(/[ &]/g, '')) ?? null
}

// ---------------------------------------------------------------- Tarihler

const MONTHS: Record<string, number> = {
  ocak: 1, oca: 1, subat: 2, sub: 2, mart: 3, mar: 3, nisan: 4, nis: 4, mayis: 5, may: 5, haziran: 6, haz: 6,
  temmuz: 7, tem: 7, agustos: 8, agu: 8, eylul: 9, eyl: 9, ekim: 10, eki: 10, kasim: 11, kas: 11, aralik: 12,
  ara: 12, january: 1, jan: 1, february: 2, feb: 2, march: 3, april: 4, apr: 4, june: 6, jun: 6, july: 7, jul: 7,
  august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12,
  dec: 12,
}

const TOKEN_RE = new RegExp(
  [
    String.raw`(?<mname>\p{L}{3,9})\.?\s?['’]?\s*(?<my>(?:19|20)\d{2})(?!\d)`,
    String.raw`(?<!\d)(?<mm>0?[1-9]|1[0-2])\s?[./-]\s?(?<mmy>(?:19|20)\d{2})(?!\d)`,
    String.raw`(?<!\d)(?<ym>(?:19|20)\d{2})[./-](?<ymm>0[1-9]|1[0-2])(?!\d)`,
    String.raw`(?<!\d)(?<y>(?:19|20)\d{2})(?!\d)`,
    String.raw`(?<![\p{L}])(?<present>günümüz|gunumuz|halen|hâlâ|hala|devam ediyor|şu an|present|currently|current|now|today|ongoing)(?![\p{L}])`,
  ].join('|'),
  'giu',
)

interface DateToken {
  index: number
  end: number
  /** "2024-02", "2024" ya da "present" */
  value: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateTokens(line: string): DateToken[] {
  const out: DateToken[] = []
  for (const match of line.matchAll(TOKEN_RE)) {
    const g = match.groups ?? {}
    const index = match.index
    const end = index + match[0].length
    if (g.mname) {
      const month = MONTHS[fold(g.mname)]
      if (month) out.push({ index, end, value: `${g.my}-${pad(month)}` })
      else out.push({ index: end - 4, end, value: g.my })
    } else if (g.mm) out.push({ index, end, value: `${g.mmy}-${pad(Number(g.mm))}` })
    else if (g.ym) out.push({ index, end, value: `${g.ym}-${g.ymm}` })
    else if (g.y) out.push({ index, end, value: g.y })
    else if (g.present) out.push({ index, end, value: 'present' })
  }
  return out
}

const RANGE_GLUE = /^\s*(?:[-–—~>→]|to|until|till|ile|\/)?\s*$/i
const EDGE_SEPARATORS = /^[\s|·•,;:–—\-()[\]]+|[\s|·•,;:–—\-([\]]+$/g

export interface DateInfo {
  start: string
  end?: string
  /** Tarih dışında kalan metin (ör. unvan) */
  rest: string
}

/**
 * Satırdaki tarih ya da tarih aralığı: "Şub 2024 – Günümüz", "2019 - 2023",
 * "01/2020 – 06/2021", "Jan 2024 – Present". Tek tarih yalnız satırın
 * başında ya da sonundaysa sayılır (cümle içindeki yıllar tarih değildir).
 */
export function findDates(line: string): DateInfo | null {
  const tokens = dateTokens(line)
  if (tokens.length === 0) return null
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i]
    const b = tokens[i + 1]
    if (a.value === 'present') continue
    if (!RANGE_GLUE.test(line.slice(a.end, b.index))) continue
    const rest = (line.slice(0, a.index) + '   ' + line.slice(b.end)).replace(/\(\s*\)/g, '')
    return { start: a.value, end: b.value, rest: cleanRest(rest) }
  }
  const single = tokens.find((t) => t.value !== 'present')
  if (!single) return null
  const before = line.slice(0, single.index).replace(EDGE_SEPARATORS, '')
  const after = line.slice(single.end).replace(EDGE_SEPARATORS, '')
  if (before && after) return null
  // "2023 yılında ...", "2019'da ..." cümledir, tarih satırı değil
  if (!before && /^['’]?\p{Ll}/u.test(line.slice(single.end).trim())) return null
  const rest = cleanRest(before || after)
  if (rest.length > 70 || /[.!?]$/.test(rest)) return null
  return { start: single.value, rest }
}

function cleanRest(rest: string): string {
  return rest
    .replace(/\(\s*\)/g, '')
    .split(/\s{3,}/)
    .map((p) => p.replace(EDGE_SEPARATORS, '').trim())
    .filter(Boolean)
    .join('   ')
    .replace(EDGE_SEPARATORS, '')
    .trim()
}

// ---------------------------------------------------------------- Satır sınıfları

const BULLET_RE = /^(?:[•▪◦●■□➢►‣⁃∙◆◇✓✔→*]|[-–—](?=\s))\s*/

interface Line {
  text: string
  bullet: boolean
  date: DateInfo | null
}

const NAME_PLACEHOLDER = /^⟦NAME(?:_\d+)?⟧$/

function isContactLine(text: string): boolean {
  return (
    /⟦(?!LOCATION|NAME)[A-Z]+(?:_\d+)?⟧/.test(text) ||
    new RegExp(EMAIL_RE.source, 'iu').test(text) ||
    /(?:linkedin|github)\.com|https?:\/\/|www\./i.test(text) ||
    phonesIn(text).length > 0
  )
}

const endsSentence = (text: string) => /[.!?:;]$/.test(text.trim()) && !/(?:\b(?:A\.Ş|Ltd|Inc|Co|Şti|LLC|Corp|vb|etc))\.$/i.test(text.trim())
const startsLower = (text: string) => /^\p{Ll}/u.test(text)

/** Başlık satırı gibi mi: kısa, cümle değil. */
function isTitleish(text: string): boolean {
  const words = text.split(/\s+/).length
  return text.length <= 90 && words <= 12 && !endsSentence(text) && !isContactLine(text)
}

/** "Deniz Aksoy", "DENİZ AKSOY", "Ayşe Nur Kaya-Demir" */
export function looksLikeName(text: string): boolean {
  const t = text.trim()
  if (t.length < 4 || t.length > 40 || /[\d@:|/⟦,]/.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  if (headingOf(t)) return false
  return words.every((w) => /^\p{Lu}[\p{L}'’.-]*$/u.test(w) && w.length >= 2) && !KNOWN_LANGUAGES.has(fold(words[0]))
}

function joinWrapped(a: string, b: string): string {
  if (/\p{L}-$/u.test(a) && startsLower(b)) return a + b
  return `${a} ${b}`
}

/** Satır kaymalarını birleştirerek madde ve paragraf listesi çıkarır. */
function bodyText(lines: Line[]): { bullets: string[]; paragraphs: string[] } {
  const bullets: string[] = []
  const paragraphs: string[] = []
  let last: 'bullet' | 'para' | null = null
  for (const line of lines) {
    const text = line.text
    if (line.bullet) {
      if (last === 'bullet' && startsLower(text) && !endsSentence(bullets[bullets.length - 1])) {
        bullets[bullets.length - 1] = joinWrapped(bullets[bullets.length - 1], text)
      } else bullets.push(text)
      last = 'bullet'
    } else if (last === 'bullet' && (startsLower(text) || !endsSentence(bullets[bullets.length - 1]))) {
      bullets[bullets.length - 1] = joinWrapped(bullets[bullets.length - 1], text)
    } else if (last === 'para' && (startsLower(text) || !endsSentence(paragraphs[paragraphs.length - 1]))) {
      paragraphs[paragraphs.length - 1] = joinWrapped(paragraphs[paragraphs.length - 1], text)
    } else {
      paragraphs.push(text)
      last = 'para'
    }
  }
  return { bullets, paragraphs }
}

// ---------------------------------------------------------------- Sınıflandırıcı sözlükler

const POSITION_WORDS = [
  'engineer', 'developer', 'gelistirici', 'muhendis', 'muhendisi', 'manager', 'muduru', 'mudur', 'yonetici', 'uzman',
  'uzmani', 'specialist', 'analyst', 'analist', 'analisti', 'designer', 'tasarimci', 'tasarimcisi', 'intern', 'stajyer',
  'stajyeri', 'lead', 'lider', 'lideri', 'consultant', 'danisman', 'danismani', 'architect', 'mimar', 'mimari',
  'director', 'direktor', 'direktoru', 'officer', 'founder', 'kurucu', 'ortak', 'ogretmen', 'ogretmeni', 'teacher',
  'asistan', 'asistani', 'assistant', 'sorumlu', 'sorumlusu', 'sefi', 'sef', 'head', 'cto', 'ceo', 'cfo', 'coo',
  'coordinator', 'koordinator', 'koordinatoru', 'administrator', 'editor', 'writer', 'yazar', 'researcher',
  'arastirmaci', 'gorevlisi', 'scientist', 'technician', 'teknisyen', 'teknisyeni', 'operator', 'temsilci',
  'temsilcisi', 'representative', 'associate', 'programmer', 'programci', 'devops', 'tester', 'qa', 'owner',
  'kidemli', 'senior', 'junior', 'sr', 'jr', 'trainee', 'freelance', 'freelancer', 'muhasebeci', 'accountant',
  'avukat', 'lawyer', 'hemsire', 'nurse', 'doktor', 'doctor', 'supervisor', 'denetci', 'auditor', 'executive',
]
const COMPANY_WORDS = [
  'a.s', 'as', 'ltd', 'sti', 'inc', 'llc', 'gmbh', 'corp', 'co', 'holding', 'teknoloji', 'teknolojileri',
  'technologies', 'technology', 'bank', 'banka', 'bankasi', 'group', 'grup', 'grubu', 'solutions', 'cozumleri',
  'software', 'labs', 'studio', 'studyo', 'ajans', 'agency', 'universitesi', 'university', 'hastanesi', 'hospital',
  'belediyesi', 'bakanligi', 'ministry', 'vakfi', 'foundation', 'dernegi', 'association', 'sirketi', 'company',
  'sanayi', 'ticaret', 'insaat', 'enerji', 'plc', 'ag', 'sa', 'bv', 'limited', 'consulting', 'danismanlik', 'digital',
  'dijital', 'systems', 'sistemleri', 'media', 'medya', 'payments', 'analytics', 'partners', 'ventures', 'startup',
]
const SCHOOL_WORDS = [
  'universitesi', 'university', 'universite', 'college', 'lisesi', 'lise', 'high school', 'institute', 'enstitusu',
  'fakultesi', 'faculty', 'academy', 'akademi', 'akademisi', 'okulu', 'school', 'polytechnic', 'yuksekokulu',
  'myo', 'kolej', 'koleji',
]
const DEGREE_RE =
  /^(yüksek lisans|ön lisans|lisans|doktora|lise|associate(?:'s)?(?: degree)?|bachelor(?:'s)?(?: of (?:science|arts|engineering|business administration))?(?: degree)?|master(?:'s)?(?: of (?:science|arts|engineering|business administration))?(?: degree)?|ph\.?\s?d\.?|doctorate|b\.?\s?sc?\.?|m\.?\s?sc?\.?|b\.?\s?a\.?|m\.?\s?a\.?|b\.?\s?eng\.?|m\.?\s?eng\.?|mba|bs|ms|ba|ma)(?![\p{L}])/iu

function wordScore(text: string, words: string[]): number {
  const tokens = ` ${fold(text).replace(/[^\p{L}\d. ]/gu, ' ').replace(/\.(?=\s|$)/g, '').replace(/\s+/g, ' ')} `
  return words.reduce((n, w) => n + (tokens.includes(` ${w} `) ? 1 : 0), 0)
}

const KNOWN_LANGUAGES = new Set(
  [
    'turkce', 'ingilizce', 'almanca', 'fransizca', 'ispanyolca', 'italyanca', 'rusca', 'arapca', 'japonca', 'cince',
    'korece', 'portekizce', 'felemenkce', 'hollandaca', 'yunanca', 'farsca', 'azerice', 'azerbaycan turkcesi',
    'kurtce', 'lehce', 'isvecce', 'bulgarca', 'romence', 'ukraynaca', 'english', 'turkish', 'german', 'french',
    'spanish', 'italian', 'russian', 'arabic', 'japanese', 'chinese', 'mandarin', 'korean', 'portuguese', 'dutch',
    'greek', 'persian', 'polish', 'swedish', 'hindi', 'azerbaijani', 'kurdish', 'bulgarian', 'romanian', 'ukrainian',
  ],
)

const GRADE_RE =
  /^(?:genel )?(?:not ortalamas[ıi]|gano|agno|gpa|cgpa|ortalama|grade|derece|ortalamas[ıi])\s*[:：]?\s*(.+)$/iu
const GRADE_VALUE_RE = /^\(?\d[.,]\d{1,2}\s*\/\s*\d{1,3}(?:[.,]\d{1,2})?\)?$/

/** " · ", " | ", " – ", 3+ boşluk gibi ayırıcılarla parçalar. */
function splitParts(text: string, extra?: RegExp): string[] {
  let parts = text.split(/\s{3,}|\t|\s+[·|•–—]\s+|\s*\|\s*/)
  if (extra) parts = parts.flatMap((p) => p.split(extra))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** Parçalardan konum olanı ayırır ("Örnek A.Ş., İstanbul" → "İstanbul"). */
function takeLocation(parts: string[]): { parts: string[]; location?: string } {
  const out: string[] = []
  let location: string | undefined
  for (const part of parts) {
    if (!location && looksLikeLocation(part)) {
      location = part.replace(/[()]/g, '').trim()
      continue
    }
    const comma = /^(.+?),\s*([^,]+(?:,\s*[^,]+)?)$/.exec(part)
    if (!location && comma && looksLikeLocation(comma[2])) {
      location = comma[2].trim()
      out.push(comma[1].trim())
      continue
    }
    const paren = /^(.+?)\s*\(([^)]+)\)$/.exec(part)
    if (!location && paren && looksLikeLocation(paren[2])) {
      location = paren[2].trim()
      out.push(paren[1].trim())
      continue
    }
    out.push(part)
  }
  return { parts: out, location }
}

const EMPLOYMENT_RE = /^(?:tam zamanlı|yarı zamanlı|full[- ]time|part[- ]time|contract|sözleşmeli|freelance|serbest|hibrit|hybrid|remote|uzaktan|internship|staj)$/i

// ---------------------------------------------------------------- Kayıt ayırma

interface Entry {
  head: string[]
  date: DateInfo | null
  body: Line[]
}

/** Tarih satırlarına göre kayıtlara böler; tarih yoksa null. */
function splitDated(lines: Line[]): Entry[] | null {
  const dateIdx = lines.map((l, i) => (l.date ? i : -1)).filter((i) => i >= 0)
  if (dateIdx.length === 0) return null
  const headish = (l: Line) => !l.bullet && !l.date && isTitleish(l.text)
  const countBefore = (end: number, floor: number, cap: number) => {
    let k = 0
    while (k < cap && end - k - 1 >= floor && headish(lines[end - k - 1])) k++
    return k
  }
  const first = dateIdx[0]
  const k = Math.min(countBefore(first, 0, 3), 3)
  const entries: Entry[] = []

  if (first === 0 || k === 0) {
    // Tarih kaydın ilk satırı: "Unvan   Tarih" ya da "Tarih" / "Unvan" / "Şirket"
    if (first > 0) entries.push({ head: [], date: null, body: lines.slice(0, first) })
    dateIdx.forEach((d, j) => {
      const next = dateIdx[j + 1] ?? lines.length
      const date = lines[d].date!
      const head = date.rest ? [date.rest] : []
      let i = d + 1
      while (i < next && headish(lines[i]) && (head.length < 2 || looksLikeLocation(lines[i].text) || GRADE_RE.test(lines[i].text))) {
        head.push(lines[i].text)
        i++
      }
      entries.push({ head, date, body: lines.slice(i, next) })
    })
    return entries
  }

  // Tarih başlık satırlarının ardından: "Unvan" / "Şirket" / "Tarih"
  const starts = dateIdx.map((d, j) => {
    const floor = j === 0 ? 0 : dateIdx[j - 1] + 1
    return d - countBefore(d, floor, k)
  })
  if (starts[0] > 0) entries.push({ head: [], date: null, body: lines.slice(0, starts[0]) })
  dateIdx.forEach((d, j) => {
    const date = lines[d].date!
    const head = lines.slice(starts[j], d).map((l) => l.text)
    if (date.rest) head.push(date.rest)
    const end = starts[j + 1] ?? lines.length
    let i = d + 1
    while (i < end && headish(lines[i]) && (looksLikeLocation(lines[i].text) || GRADE_RE.test(lines[i].text))) {
      head.push(lines[i].text)
      i++
    }
    entries.push({ head, date, body: lines.slice(i, end) })
  })
  return entries
}

/** Tarihsiz kayıtlar: kısa başlık satırı (ya da iki) + madde/paragraf gövdesi. */
function splitUndated(lines: Line[], maxHead = 2): Entry[] {
  const entries: Entry[] = []
  let cur: Entry | null = null
  let prev: Line | null = null
  for (const line of lines) {
    const titleish = !line.bullet && isTitleish(line.text)
    const continuation = prev && startsLower(line.text) && !endsSentence(prev.text)
    if (titleish && !continuation && (!cur || cur.body.length > 0)) {
      cur = { head: [line.text], date: null, body: [] }
      entries.push(cur)
    } else if (titleish && !continuation && cur && cur.body.length === 0 && cur.head.length < maxHead) {
      cur.head.push(line.text)
    } else {
      if (!cur) {
        cur = { head: [], date: null, body: [] }
        entries.push(cur)
      }
      cur.body.push(line)
    }
    prev = line
  }
  return entries
}

/** Her satır bir kayıt (sertifika, ödül listeleri); maddeler önceki kayda. */
function splitPerLine(lines: Line[]): Entry[] {
  const entries: Entry[] = []
  for (const line of lines) {
    const last = entries[entries.length - 1]
    if ((line.bullet || startsLower(line.text)) && last) last.body.push(line)
    else entries.push({ head: [line.date ? line.date.rest || line.text : line.text], date: line.date, body: [] })
  }
  return entries
}

// ---------------------------------------------------------------- Kayıt → alanlar

function item(fields: Record<string, string | undefined>, entry: Entry | null, body?: ReturnType<typeof bodyText>): ImportItem {
  const clean = Object.fromEntries(
    Object.entries(fields)
      .map(([k, v]) => [k, (v ?? '').replace(/\s+/g, ' ').trim()] as const)
      .filter(([, v]) => v !== ''),
  )
  const out: ImportItem = { fields: clean }
  if (entry?.date) {
    out.start = entry.date.start
    if (entry.date.end) out.end = entry.date.end
  }
  if (body?.paragraphs.length && !('description' in clean) && !('content' in clean)) {
    out.fields.description = body.paragraphs.join('\n')
  }
  if (body?.bullets.length) out.bullets = body.bullets
  return out
}

function experienceLike(entry: Entry, kind: 'experience' | 'volunteer' | 'custom'): ImportItem {
  const body = bodyText(entry.body)
  const split = entry.head.flatMap((h) => splitParts(h, kind === 'experience' ? /\s+(?:at|@)\s+/i : undefined))
  const loc = takeLocation(split)
  const parts = loc.parts.filter((p) => {
    if (EMPLOYMENT_RE.test(p)) {
      body.paragraphs.unshift(p)
      return false
    }
    return true
  })
  let location = loc.location
  if (!location && body.paragraphs[0] && looksLikeLocation(body.paragraphs[0])) location = body.paragraphs.shift()
  let [a = '', b = '', ...rest] = parts
  // "Şirket / Unvan" sırasıyla yazılmışsa çevir
  if (kind !== 'custom') {
    const aCompany = wordScore(a, COMPANY_WORDS) > wordScore(a, POSITION_WORDS)
    const bPosition = !b || wordScore(b, POSITION_WORDS) >= wordScore(b, COMPANY_WORDS)
    if (aCompany && bPosition && (b || wordScore(a, COMPANY_WORDS) > 0)) [a, b] = [b, a]
  }
  if (rest.length) body.paragraphs.unshift(rest.join(' · '))
  if (kind === 'experience') return item({ position: a, company: b, location }, entry, body)
  if (kind === 'volunteer') return item({ role: a, organization: b, location }, entry, body)
  return item({ title: a, subtitle: b, location }, entry, body)
}

function parseDegree(text: string): { degree: string; field: string } {
  const t = text.trim()
  const paren = /^(.+?)\s*\(([^)]+)\)$/.exec(t)
  if (paren && DEGREE_RE.test(paren[2])) return { degree: paren[2].trim(), field: paren[1].trim() }
  const inMatch = /^(.+?)\s+in\s+(.+)$/i.exec(t)
  if (inMatch && DEGREE_RE.test(inMatch[1])) return { degree: inMatch[1].trim(), field: inMatch[2].trim() }
  const lead = DEGREE_RE.exec(t)
  if (lead) {
    const field = t.slice(lead[0].length).replace(/^[\s,–—:-]+|\s+(?:in|of)\s+/gi, ' ').trim()
    return { degree: lead[0].trim(), field }
  }
  const comma = t.split(/\s*,\s*/)
  if (comma.length === 2 && DEGREE_RE.test(comma[1])) return { degree: comma[1], field: comma[0] }
  const tail = /^(.+?)\s+(yüksek lisans|ön lisans|lisans|doktora)$/i.exec(t)
  if (tail) return { degree: tail[2], field: tail[1] }
  return { degree: '', field: t }
}

function education(entry: Entry): ImportItem {
  const body = bodyText(entry.body)
  // "Lisans, Bilgisayar Müh." bir parça kalır; "BSc ..., X University, İzmir" virgülden bölünür
  const split = entry.head
    .flatMap((h) => splitParts(h))
    .flatMap((p) => (p.includes(',') && p.split(',').some((c) => wordScore(c, SCHOOL_WORDS) > 0) ? p.split(/\s*,\s*/) : [p]))
  const loc = takeLocation(split)
  let grade = ''
  const parts: string[] = []
  for (const part of loc.parts) {
    const g = GRADE_RE.exec(part)
    if (g) grade = g[1]
    else if (GRADE_VALUE_RE.test(part)) grade = part.replace(/[()]/g, '')
    else parts.push(part)
  }
  body.paragraphs = body.paragraphs.filter((p) => {
    const g = GRADE_RE.exec(p)
    if (g && !grade) grade = g[1]
    return !g
  })
  const schoolIdx = parts.findIndex((p) => wordScore(p, SCHOOL_WORDS) > 0)
  const school = schoolIdx >= 0 ? parts.splice(schoolIdx, 1)[0] : (parts.shift() ?? '')
  // "Lisans, Bilgisayar Mühendisliği" iki parça olarak da gelebilir
  let degree = ''
  let field = ''
  const joined = parts.join(', ')
  if (joined) ({ degree, field } = parseDegree(joined))
  if (!degree && parts.length >= 2) {
    const d = parts.findIndex((p) => DEGREE_RE.test(p))
    if (d >= 0) {
      degree = parts[d]
      field = parts.filter((_, i) => i !== d).join(', ')
    }
  }
  return item({ school, degree, field, location: loc.location, grade }, entry, body)
}

const URLISH = /^(?:https?:\/\/|www\.|⟦(?:GITHUB|WEBSITE|LINKEDIN)(?:_\d+)?⟧|[a-z\d-]+\.(?:com|io|dev|app|org|net|me)(?:\/\S*)?$)/i

function project(entry: Entry): ImportItem {
  let url = ''
  const body = bodyText(entry.body.filter((l) => {
    if (!url && URLISH.test(l.text) && !/\s/.test(l.text)) {
      url = l.text
      return false
    }
    return true
  }))
  const parts: string[] = []
  for (const part of entry.head.flatMap((h) => splitParts(h))) {
    if (!url && URLISH.test(part) && !/\s/.test(part)) url = part
    else parts.push(part)
  }
  const [name = '', second = '', ...rest] = parts
  let role = ''
  if (second && !second.includes(',') && (wordScore(second, POSITION_WORDS) > 0 || second.split(/\s+/).length <= 3)) role = second
  else if (second) rest.unshift(second)
  if (rest.length) body.paragraphs.unshift(rest.join(' · '))
  return item({ name, role, url }, entry, body)
}

function namedWithIssuer(entry: Entry, nameKey: 'name' | 'title'): ImportItem {
  const body = bodyText(entry.body)
  let url = ''
  let parts = entry.head.flatMap((h) => splitParts(h)).filter((p) => {
    if (!url && URLISH.test(p) && !/\s/.test(p)) {
      url = p
      return false
    }
    return true
  })
  if (parts.length === 1) {
    // "Ad - Kurum" ya da "Ad, Kurum"
    const dash = parts[0].split(/\s+-\s+/)
    const comma = /^(.+),\s*([^,]{2,50})$/.exec(parts[0])
    if (dash.length === 2) parts = dash
    else if (comma) parts = [comma[1], comma[2]]
  }
  const [name = '', issuer = '', ...rest] = parts
  if (rest.length) body.paragraphs.unshift(rest.join(' · '))
  const fields: Record<string, string> = { [nameKey]: name, issuer }
  if (nameKey === 'name') fields.url = url
  const out = item(fields, entry, nameKey === 'title' ? body : undefined)
  if (nameKey === 'name' && body.bullets.length + body.paragraphs.length > 0) {
    // Sertifikanın açıklama alanı yok; kaybolmasın diye adın ardına
    out.fields.name = [out.fields.name, ...body.paragraphs, ...body.bullets].filter(Boolean).join(' — ')
  }
  return out
}

function skills(lines: Line[]): ImportItem[] {
  const merged: string[] = []
  for (const line of lines) {
    const prev = merged[merged.length - 1]
    if (prev && (/[,;/&]$/.test(prev) || (startsLower(line.text) && !line.bullet && !/[:：]/.test(line.text)))) {
      merged[merged.length - 1] = `${prev} ${line.text}`
    } else merged.push(line.text)
  }
  const items: ImportItem[] = []
  let loose: string[] = []
  const flush = () => {
    if (loose.length) items.push({ fields: { keywords: loose.join(', ') } })
    loose = []
  }
  for (const text of merged) {
    const clean = text.replace(/[●○◯◉★☆■□▪]+/g, '').trim()
    const labeled = /^([^:：]{1,40})[:：]\s*(.+)$/.exec(clean)
    if (labeled) {
      flush()
      items.push({ fields: { name: labeled[1].trim(), keywords: normalizeList(labeled[2]) } })
    } else if (/[,;·|•]/.test(clean) && clean.split(/[,;·|•]/).length > 2) {
      flush()
      items.push({ fields: { keywords: normalizeList(clean) } })
    } else if (clean) loose.push(clean)
  }
  flush()
  return items
}

const normalizeList = (text: string) =>
  text
    .split(/\s*[,;·|•]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ')

function languages(lines: Line[]): ImportItem[] {
  const items: ImportItem[] = []
  const texts = lines.flatMap((l) =>
    // "Türkçe (ana dil), İngilizce (C1)" tek satırda birden çok dil
    /\),\s*\p{Lu}/u.test(l.text) ? l.text.split(/(?<=\)),\s*/) : [l.text],
  )
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i].trim()
    const m =
      /^([\p{L} ]{2,30}?)\s*(?:[—–:|-]|,|(?=\())\s*(.+)$/u.exec(text) ??
      /^([\p{L}]{2,20})\s+((?:[ABC][12]|native|fluent|ana dil|anadil)\b.*)$/iu.exec(text)
    const level = (raw: string) => (/^\([^()]*\)$/.test(raw.trim()) ? raw.trim().slice(1, -1) : raw).trim()
    if (m && KNOWN_LANGUAGES.has(fold(m[1].trim()))) {
      items.push({ fields: { name: m[1].trim(), level: level(m[2]) } })
    } else if (KNOWN_LANGUAGES.has(fold(text))) {
      // İki satırlı yazım: "İngilizce" / "İleri (C1)"
      const next = texts[i + 1]?.trim()
      const nextIsLanguage = next ? KNOWN_LANGUAGES.has(fold(next.split(/[\s(—–:-]/)[0])) : true
      items.push({ fields: { name: text, level: nextIsLanguage ? '' : next } })
      if (!nextIsLanguage) i++
    } else if (items.length && /^(?:okuma|yazma|konuşma|reading|writing|speaking)\b/i.test(text)) {
      const last = items[items.length - 1]
      last.fields.level = [last.fields.level, text].filter(Boolean).join(', ')
    } else if (m) {
      items.push({ fields: { name: m[1].trim(), level: level(m[2]) } })
    } else items.push({ fields: { name: text } })
  }
  return items
}

function references(lines: Line[]): ImportItem[] {
  if (lines.length <= 2 && lines.every((l) => /talep|istek|request|verilecektir|available/i.test(l.text))) return []
  const items: ImportItem[] = []
  let cur: Record<string, string> | null = null
  for (const { text } of lines) {
    if (looksLikeName(text) && (!cur || cur.position || cur.email || cur.phone)) {
      cur = { name: text }
      items.push({ fields: cur })
      continue
    }
    if (!cur) {
      cur = { name: '' }
      items.push({ fields: cur })
    }
    const email = /⟦EMAIL(?:_\d+)?⟧/.exec(text)?.[0] ?? text.match(new RegExp(EMAIL_RE.source, 'iu'))?.[0]
    const phone = /⟦PHONE(?:_\d+)?⟧/.exec(text)?.[0]
    if (email || phone) {
      if (email) cur.email = email
      if (phone) cur.phone = phone
      const digits = text.replace(/⟦[^⟧]+⟧|[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[a-z]{2,}/giu, '').match(/\+?[\d\s()-]{10,}/)
      if (!phone && digits) cur.phone = digits[0].trim()
      continue
    }
    const parts = splitParts(text, /\s*,\s*|\s+(?:at|@)\s+/i)
    if (!cur.position) {
      cur.position = parts[0] ?? ''
      if (parts[1]) cur.organization = parts.slice(1).join(', ')
    } else if (!cur.organization) cur.organization = parts.join(', ')
  }
  return items.filter((i) => Object.values(i.fields).some(Boolean))
}

// ---------------------------------------------------------------- Ana akış

/** Büyük harfle yazılmış adı/başlığı düzeltir: "DENİZ AKSOY" → "Deniz Aksoy". */
export function titleCase(text: string, language: CvLanguage): string {
  if (text !== text.toLocaleUpperCase(language === 'tr' ? 'tr' : 'en') || !/\p{L}{2}/u.test(text)) return text
  const locale = language === 'tr' || /[ÇĞİÖŞÜ]/.test(text) ? 'tr' : 'en'
  const small = new Set(['ve', 'ile', 'and', 'of', 'in', 'the', '&'])
  return text
    .toLocaleLowerCase(locale)
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toLocaleUpperCase(locale) + w.slice(1)))
    .join('')
}

const PAGE_ARTIFACT = /^(?:(?:sayfa|page)\s*)?\d{1,2}(?:\s*(?:\/|of|-)\s*\d{1,2})?$/i

function toLines(text: string): Line[] {
  const out: Line[] = []
  for (const raw of text.split('\n')) {
    let t = raw.replace(/\s+$/, '').trim()
    if (!t || PAGE_ARTIFACT.test(t)) continue
    // Sol sütunda başlık, sağında içerik: "DENEYİM   Kıdemli Geliştirici"
    const gap = /^(.{2,40}?)\s{3,}(.+)$/.exec(t)
    if (gap && headingOf(gap[1])) {
      out.push({ text: gap[1], bullet: false, date: null })
      t = gap[2]
    }
    const bullet = BULLET_RE.test(t)
    if (bullet) t = t.replace(BULLET_RE, '').trim()
    if (!t) continue
    const date = bullet || isContactLine(t) ? null : findDates(t)
    out.push({ text: t, bullet, date })
  }
  return out
}

interface RawSection {
  heading: Heading | null
  title: string
  lines: Line[]
}

const OTHER_TITLE: Record<CvLanguage, string> = { tr: 'Diğer', en: 'Other' }

export function heuristicImport(request: ImportRequest): ImportResult {
  const detected = detectLanguage(request.text)
  const language = detected.confidence >= 0.6 ? detected.language : request.language
  const lines = toLines(joinWrappedUrls(request.text))
  const personal: ImportResult['personal'] = {}
  const sections: ImportSection[] = []
  const other: string[] = []

  // Bölümlere ayır
  const preamble: Line[] = []
  const raw: RawSection[] = []
  for (const line of lines) {
    const heading = !line.bullet ? headingOf(line.text) : null
    if (heading) raw.push({ heading, title: line.text.replace(/[:：]\s*$/, ''), lines: [] })
    else if (raw.length) raw[raw.length - 1].lines.push(line)
    else preamble.push(line)
  }

  // Ad ve unvan: önce başlık bölgesinde; yoksa (Canva'da yan sütun önce gelebilir) metnin herhangi bir yerinde.
  // Ad satırı yerelde maskelenmiş olabilir (⟦NAME⟧): o satır addır.
  const isNamePlaceholder = (text: string) => NAME_PLACEHOLDER.test(text.trim())
  let nameAt = preamble.slice(0, 6).findIndex((l) => isNamePlaceholder(l.text))
  if (nameAt < 0) nameAt = preamble.slice(0, 6).findIndex((l) => !l.bullet && looksLikeName(l.text) && wordScore(l.text, POSITION_WORDS) === 0)
  if (nameAt < 0) nameAt = preamble.slice(0, 6).findIndex((l) => !l.bullet && looksLikeName(l.text))
  if (nameAt >= 0) {
    const nameLine = preamble[nameAt].text.trim()
    personal.fullName = isNamePlaceholder(nameLine) ? nameLine : titleCase(nameLine, language)
    preamble.splice(nameAt, 1)
    const next = preamble.findIndex((l, i) => i >= nameAt && !isContactLine(l.text))
    if (next === nameAt && isTitleish(preamble[next].text) && !looksLikeLocation(preamble[next].text)) {
      personal.headline = titleCase(preamble.splice(next, 1)[0].text, language)
    }
  } else {
    outer: for (const section of raw) {
      for (let i = 0; i < section.lines.length; i++) {
        const l = section.lines[i]
        const nextLine = section.lines[i + 1]
        if (l.bullet || !looksLikeName(l.text) || wordScore(l.text, POSITION_WORDS) > 0) continue
        if (nextLine && !nextLine.bullet && wordScore(nextLine.text, POSITION_WORDS) > 0 && isTitleish(nextLine.text)) {
          personal.fullName = titleCase(l.text, language)
          personal.headline = titleCase(nextLine.text, language)
          section.lines.splice(i, 2)
          break outer
        }
        if (!nextLine && section === raw[raw.length - 1]) break
      }
    }
  }

  // İletişim: yer tutucular (maskeli metin) ya da metinden çıkarılanlar
  const contacts = extractContacts(request.text)
  const slot = (kind: string) => (new RegExp(`⟦${kind}⟧`).test(request.text) ? `⟦${kind}⟧` : undefined)
  personal.email = slot('EMAIL') ?? contacts.email
  personal.phone = slot('PHONE') ?? contacts.phone
  personal.linkedin = slot('LINKEDIN') ?? contacts.linkedin
  personal.github = slot('GITHUB') ?? contacts.github
  personal.website = slot('WEBSITE') ?? contacts.website
  personal.location = slot('LOCATION') ?? contacts.location

  // Başlık bölgesinin kalanı
  const headerSummary: Line[] = []
  for (const line of preamble) {
    if (isContactLine(line.text)) continue
    if (looksLikeLocation(line.text)) {
      personal.location ??= line.text
      continue
    }
    if (line.text.split(/\s+/).length >= 8 || headerSummary.length) headerSummary.push(line)
    else other.push(line.text)
  }

  const push = (type: SectionType, title: string | null, items: ImportItem[]) => {
    const kept = items.filter((i) => Object.keys(i.fields).length > 0 || i.bullets?.length)
    if (kept.length === 0) return
    const same = sections.find((s) => s.type === type && (s.title ?? null) === title && type !== 'custom')
    if (same) same.items.push(...kept)
    else sections.push({ type, title, items: kept })
  }

  if (headerSummary.length && !raw.some((s) => s.heading?.kind === 'summary')) {
    const body = bodyText(headerSummary)
    push('summary', null, [{ fields: { content: body.paragraphs.join('\n') }, ...(body.bullets.length ? { bullets: body.bullets } : {}) }])
  } else other.push(...headerSummary.map((l) => l.text))

  for (const section of raw) {
    const kind = section.heading!.kind
    const keptTitle = section.heading!.keepTitle ? titleCase(section.title, language) : null
    const body = section.lines
    if (body.length === 0) continue
    switch (kind) {
      case 'summary': {
        const text = bodyText(body)
        push('summary', null, [{ fields: { content: text.paragraphs.join('\n') }, ...(text.bullets.length ? { bullets: text.bullets } : {}) }])
        break
      }
      case 'experience':
      case 'volunteer': {
        const entries = splitDated(body) ?? splitUndated(body)
        push(kind, keptTitle, entries.map((e) => experienceLike(e, kind)))
        break
      }
      case 'education': {
        const entries = splitDated(body) ?? splitUndated(body, 3)
        push('education', null, entries.map(education))
        break
      }
      case 'projects': {
        const entries = splitDated(body) ?? splitUndated(body)
        push('projects', null, entries.map(project))
        break
      }
      case 'certificates':
      case 'awards': {
        const standalone = body.some((l) => l.date && !l.date.rest)
        const entries = standalone ? (splitDated(body) ?? splitPerLine(body)) : splitPerLine(body)
        push(kind, null, entries.map((e) => namedWithIssuer(e, kind === 'awards' ? 'title' : 'name')))
        break
      }
      case 'skills':
        push('skills', null, skills(body))
        break
      case 'languages':
        push('languages', null, languages(body))
        break
      case 'references':
        push('references', null, references(body))
        break
      case 'contact': {
        const extra: ImportItem[] = []
        for (const line of body) {
          if (isContactLine(line.text)) continue
          const labeled = /^([^:：]{2,30})[:：]\s*(.+)$/.exec(line.text)
          const value = labeled?.[2] ?? line.text
          if (looksLikeLocation(value) || (labeled && /adres|address|konum|location/i.test(labeled[1]))) {
            personal.location ??= value
            continue
          }
          if (/^(?:linkedin|github|e-?posta|e-?mail|telefon|phone|tel|gsm|web(?:site)?)$/i.test(labeled?.[1] ?? '')) continue
          extra.push({ fields: labeled ? { title: labeled[1].trim(), subtitle: labeled[2].trim() } : { title: line.text } })
        }
        push('custom', keptTitle, extra)
        break
      }
      case 'custom': {
        const dated = splitDated(body)
        const entries = dated ?? splitPerLine(body)
        push(
          'custom',
          keptTitle,
          entries.map((e) =>
            !dated && e.head[0] && e.head[0].length > 90
              ? item({}, e, bodyText([{ text: e.head[0], bullet: false, date: null }, ...e.body]))
              : experienceLike(e, 'custom'),
          ),
        )
        break
      }
    }
  }

  if (other.length) {
    push('custom', OTHER_TITLE[language], [{ fields: { description: other.join('\n') } }])
  }

  for (const key of Object.keys(personal) as (keyof typeof personal)[]) {
    if (!personal[key]) delete personal[key]
  }
  return { personal, sections }
}
