import type { CvLanguage } from '@/cv/schema'
import type { TranslateRequest, TranslateResult } from './types'

/**
 * Örnek çevirmen: yapay zekâ bağlanana kadar çeviri akışının uçtan uca
 * denenebilmesi için. Yalnız aşağıdaki küçük sözlükteki CV kelime ve
 * kalıplarını çevirir, gerisine dokunmaz (arayüz bunu "Örnek çeviri" diye
 * açıkça söyler). Belirlenimci: aynı girdi hep aynı çıktıyı verir.
 *
 * HTML etiketlerine ve özniteliklerine (href vb.) asla dokunmaz; yalnız
 * etiketlerin arasındaki metin çevrilir.
 */

interface Entry {
  tr: string
  en: string
  /** Yalnız bu yönde kullanılır (ör. Türkçe çekimli biçimler) */
  only?: 'tr-en' | 'en-tr'
  /** Özel ad gibi her zaman büyük harfle başlar (dil adları) */
  proper?: boolean
}

const e = (tr: string, en: string, extra: Omit<Entry, 'tr' | 'en'> = {}): Entry => ({ tr, en, ...extra })
const p = (tr: string, en: string): Entry => ({ tr, en, proper: true })

const GLOSSARY: Entry[] = [
  // Unvanlar
  e('Yazılım Geliştirici', 'Software Developer'),
  e('Yazılım Mühendisi', 'Software Engineer'),
  e('Yazılım Stajyeri', 'Software Intern'),
  e('Serbest Web Geliştirici', 'Freelance Web Developer'),
  e('Web Geliştirici', 'Web Developer'),
  e('Kıdemli', 'Senior'),
  e('Geliştirici', 'Developer'),
  e('Mühendis', 'Engineer'),
  e('Stajyer', 'Intern'),
  e('Stajyeri', 'Intern', { only: 'tr-en' }),
  e('Staj', 'Internship'),
  e('Ekip lideri', 'Team lead'),
  e('Takım lideri', 'Team lead', { only: 'tr-en' }),
  e('Kurucu geliştirici', 'Founding developer'),
  e('Proje Yöneticisi', 'Project Manager'),
  e('Ürün Yöneticisi', 'Product Manager'),
  e('Veri Analisti', 'Data Analyst'),
  e('Tasarımcı', 'Designer'),
  e('Danışman', 'Consultant'),
  e('Asistan', 'Assistant'),
  e('Gönüllü', 'Volunteer'),
  // Eğitim
  e('Yüksek Lisans', "Master's degree"),
  e('Doktora', 'PhD'),
  e('Ön Lisans', "Associate degree"),
  e('Lisans', "Bachelor's degree"),
  e('Lise', 'High school'),
  e('Bilgisayar Mühendisliği', 'Computer Engineering'),
  e('Yazılım Mühendisliği', 'Software Engineering'),
  e('Endüstri Mühendisliği', 'Industrial Engineering'),
  e('Makine Mühendisliği', 'Mechanical Engineering'),
  e('Bilgisayar Bilimleri', 'Computer Science'),
  e('İşletme', 'Business Administration'),
  e('Ekonomi', 'Economics'),
  e('Matematik', 'Mathematics'),
  // Diller ve seviyeler
  p('Türkçe', 'Turkish'),
  p('İngilizce', 'English'),
  p('Almanca', 'German'),
  p('Fransızca', 'French'),
  p('İspanyolca', 'Spanish'),
  p('İtalyanca', 'Italian'),
  p('Rusça', 'Russian'),
  p('Arapça', 'Arabic'),
  p('Japonca', 'Japanese'),
  p('Çince', 'Chinese'),
  e('Ana dil', 'Native'),
  e('Anadil', 'Native', { only: 'tr-en' }),
  e('Akıcı', 'Fluent'),
  e('İleri', 'Advanced'),
  e('Orta', 'Intermediate'),
  e('Başlangıç', 'Beginner'),
  e('Temel', 'Basic'),
  // Beceri grupları, konum
  e('Diller', 'Languages'),
  e('Programlama Dilleri', 'Programming Languages'),
  e('Çatılar', 'Frameworks'),
  e('Araçlar', 'Tools'),
  e('Veritabanları', 'Databases'),
  e('Teknolojiler', 'Technologies'),
  e('Yetkinlikler', 'Competencies'),
  e('Uzaktan', 'Remote'),
  e('Hibrit', 'Hybrid'),
  e('Tam zamanlı', 'Full-time'),
  e('Yarı zamanlı', 'Part-time'),
  e('Serbest', 'Freelance'),
  // Bölüm başlığı olarak sık kullanılanlar
  e('Deneyim', 'Experience'),
  e('İş Deneyimi', 'Work Experience'),
  e('Eğitim', 'Education'),
  e('Projeler', 'Projects'),
  e('Beceriler', 'Skills'),
  e('Sertifikalar', 'Certifications'),
  e('Ödüller', 'Awards'),
  e('Yayınlar', 'Publications'),
  e('Hobiler', 'Hobbies'),
  e('İlgi Alanları', 'Interests'),
  e('Referanslar', 'References'),
  e('Gönüllülük', 'Volunteering'),
]

/** Kelime: harf/rakam dizisi; kesme işaretli ek ya da iyelik kelimeye dahil (CV'nin, Bachelor's). */
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu

function tokenize(text: string): { words: string[]; seps: string[] } {
  const words: string[] = []
  const seps: string[] = []
  let last = 0
  for (const match of text.matchAll(WORD)) {
    seps.push(text.slice(last, match.index))
    words.push(match[0])
    last = match.index + match[0].length
  }
  seps.push(text.slice(last))
  return { words, seps }
}

const locale = (lang: CvLanguage) => (lang === 'tr' ? 'tr-TR' : 'en-US')
const lower = (s: string, lang: CvLanguage) => s.toLocaleLowerCase(locale(lang)).replace(/’/g, "'")

interface Rule {
  source: string[]
  target: string
  proper: boolean
}

const rulesCache = new Map<string, { byFirst: Map<string, Rule[]> }>()

function rules(from: CvLanguage, to: CvLanguage) {
  const cacheKey = `${from}-${to}`
  const cached = rulesCache.get(cacheKey)
  if (cached) return cached
  const byFirst = new Map<string, Rule[]>()
  const seen = new Set<string>()
  for (const entry of GLOSSARY) {
    if (entry.only && entry.only !== cacheKey) continue
    const source = from === 'tr' ? entry.tr : entry.en
    const target = to === 'tr' ? entry.tr : entry.en
    const words = tokenize(source).words.map((w) => lower(w, from))
    const id = words.join(' ')
    // Aynı kaynak birden çok kez geçerse ilki geçerli (ters yönde eş anlamlılar)
    if (seen.has(id) || words.length === 0) continue
    seen.add(id)
    const list = byFirst.get(words[0]) ?? []
    list.push({ source: words, target, proper: !!entry.proper })
    byFirst.set(words[0], list)
  }
  // Uzun kalıp önce: "Yazılım Geliştirici" tek kelimelik "Geliştirici"den önce denenir
  for (const list of byFirst.values()) list.sort((a, b) => b.source.length - a.source.length)
  const result = { byFirst }
  rulesCache.set(cacheKey, result)
  return result
}

function isUpper(s: string, lang: CvLanguage) {
  return s.toLocaleUpperCase(locale(lang)) === s && s.toLocaleLowerCase(locale(lang)) !== s
}

/** Kaynaktaki büyük/küçük harf biçimini hedefe taşır (Türkçe İ/ı kurallarıyla). */
function matchCase(matched: string, rule: Rule, from: CvLanguage, to: CvLanguage): string {
  const first = matched.charAt(0)
  if (matched.length > 1 && isUpper(matched.replace(/[^\p{L}]/gu, ''), from)) return rule.target.toLocaleUpperCase(locale(to))
  if (isUpper(first, from)) return rule.target.charAt(0).toLocaleUpperCase(locale(to)) + rule.target.slice(1)
  if (rule.proper) return rule.target
  return rule.target.toLocaleLowerCase(locale(to))
}

/** Etiket dışındaki düz metin parçasını sözlükle çevirir. */
function translatePlain(text: string, from: CvLanguage, to: CvLanguage): string {
  const { byFirst } = rules(from, to)
  const { words, seps } = tokenize(text)
  if (words.length === 0) return text
  const lowered = words.map((w) => lower(w, from))
  // Türkçe klavyesiz yazılmış "Ingilizce" gibi biçimler için ikinci, dil bağımsız küçük harf
  const plain = words.map((w) => w.toLowerCase().replace(/’/g, "'"))
  const same = (index: number, w: string) => lowered[index] === w || plain[index] === w
  let out = seps[0]
  let i = 0
  while (i < words.length) {
    const candidates = [...(byFirst.get(lowered[i]) ?? []), ...(byFirst.get(plain[i]) ?? [])].sort(
      (a, b) => b.source.length - a.source.length,
    )
    const rule = candidates.find(
      (r) =>
        i + r.source.length <= words.length &&
        r.source.every((w, k) => same(i + k, w) && (k === 0 || /^[ \t ]+$/.test(seps[i + k]))),
    )
    if (rule) {
      const end = i + rule.source.length
      const matched = words.slice(i, end).reduce((acc, w, k) => (k === 0 ? w : acc + seps[i + k] + w), '')
      out += matchCase(matched, rule, from, to) + seps[end]
      i = end
    } else {
      out += words[i] + seps[i + 1]
      i++
    }
  }
  return out
}

/** Etiketler (<...>) ve HTML varlıkları (&amp;) olduğu gibi kalır; arası çevrilir. */
export function translateText(text: string, from: CvLanguage, to: CvLanguage): string {
  if (from === to || !text) return text
  return text
    .split(/(<[^>]*>|&[#\w]+;)/)
    .map((part, index) => (index % 2 === 1 ? part : translatePlain(part, from, to)))
    .join('')
}

export function mockTranslate(request: TranslateRequest): TranslateResult {
  return {
    items: request.items.map((i) => ({ key: i.key, text: translateText(i.text, request.from, request.to) })),
  }
}
