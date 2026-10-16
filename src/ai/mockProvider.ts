import { TEXT_FIELDS } from '@/cv/fields'
import { SECTION_TITLES } from '@/cv/locale'
import type { CvLanguage, SectionType } from '@/cv/schema'
import { isRichTextEmpty } from '@/render/richtext'
import { m } from '@/paraglide/messages'
import { heuristicImport } from './importHeuristics'
import { mockMatchKeywords, mockReview } from './mockReview'
import { mockTranslate } from './mockTranslate'
import { AiError, type AiErrorCode, type AiProvider, type EditOperation, type EditPayload, type EditResult } from './types'

/**
 * ÖRNEK SAĞLAYICI — gerçek yapay zekâ değildir, hiçbir yere istek atmaz.
 * Yalnız gönderilecek payload'u görür (gerçek sağlayıcıyla aynı girdi) ve
 * öneri ekranını gerçek CV'de denemek için zararsız işlemler döndürür:
 *   - madde başlarını büyük harfe çevirir, fazla boşlukları siler
 *   - madde sonlarındaki noktaları çoğunluğa göre tutarlı yapar
 *   - birkaç zayıf kalıbı güçlü fiille değiştirir
 *   - istekte bölüm adı geçiyorsa o bölüme odaklanır
 *   - "ekle" / "sil" geçiyorsa örnek bir ekleme / kaldırma önerir
 * Arayüz bu sağlayıcıda "Örnek" rozeti gösterir (isDemo).
 */

const WEAK_PHRASES: Record<CvLanguage, [RegExp, string][]> = {
  tr: [
    [/\bgörev aldım\b/gi, 'yürüttüm'],
    [/\byardımcı oldum\b/gi, 'katkı sağladım'],
    [/\bsorumluydum\b/gi, 'yönettim'],
    [/\bilgilendim\b/gi, 'üstlendim'],
  ],
  en: [
    [/\bresponsible for\b/gi, 'led'],
    [/\bworked on\b/gi, 'built'],
    [/\bhelped (to )?/gi, 'contributed to '],
    [/\bwas involved in\b/gi, 'drove'],
  ],
}

function capitalizeFirst(text: string, language: CvLanguage) {
  const match = text.match(/^(\s*(?:<[^>]+>\s*)*)(\p{Ll})/u)
  if (!match) return text
  const [, prefix, letter] = match
  return prefix + letter.toLocaleUpperCase(language) + text.slice(prefix.length + letter.length)
}

/** Madde ve paragraf metinlerini düzeltir; yapıya (etiketlere) dokunmaz. */
export function tidyHtml(html: string, language: CvLanguage): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild!
  const blocks = Array.from(root.querySelectorAll('li, p')).filter((el) => !el.querySelector('li, p'))
  const lis = blocks.filter((el) => el.tagName === 'LI')
  const withPeriod = lis.filter((li) => /\.\s*$/.test(li.textContent ?? '')).length
  const wantPeriod = lis.length > 0 && withPeriod * 2 > lis.length

  for (const el of blocks) {
    let inner = el.innerHTML.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '')
    for (const [re, replacement] of WEAK_PHRASES[language]) inner = inner.replace(re, replacement)
    inner = capitalizeFirst(inner, language)
    if (el.tagName === 'LI' && lis.length > 1) {
      inner = wantPeriod ? (/[.!?](<\/[^>]+>)*$/.test(inner) ? inner : `${inner}.`) : inner.replace(/\.((<\/[^>]+>)*)$/, '$1')
    }
    el.innerHTML = inner
  }
  return root.innerHTML
}

/** Bölüm türünü istekte anan kelimeler (başlık da ayrıca aranır). */
const TYPE_WORDS: Record<SectionType, string[]> = {
  summary: ['özet', 'profil', 'summary', 'profile', 'about'],
  experience: ['deneyim', 'tecrübe', 'iş geçmiş', 'experience', 'work'],
  education: ['eğitim', 'okul', 'üniversite', 'education', 'school'],
  projects: ['proje', 'project'],
  skills: ['beceri', 'yetenek', 'yetkinlik', 'skill'],
  languages: ['yabancı dil', 'diller', 'language'],
  certificates: ['sertifika', 'certific'],
  awards: ['ödül', 'award'],
  volunteer: ['gönüllü', 'volunteer'],
  references: ['referans', 'reference'],
  custom: [],
}

const SAMPLE_SUMMARY: Record<CvLanguage, string> = {
  tr: '<p>Kullanıcı odaklı arayüzler geliştiren yazılımcı. Son projemde sayfa yüklenme süresini %30 kısalttım; ekip içinde erişilebilirlik ve test kültürünü yaygınlaştırıyorum.</p>',
  en: '<p>Developer building user-focused interfaces. In my latest project I cut page load time by 30% and I champion accessibility and testing within the team.</p>',
}

const SAMPLE_BULLET: Record<CvLanguage, string> = {
  tr: 'Süreçleri sadeleştirerek teslim süresini yaklaşık %20 kısalttım.',
  en: 'Streamlined the workflow, cutting delivery time by about 20%.',
}

/** "Ekle" isteğine örnek kayıt (bölüm türüne göre). */
const SAMPLE_ADD: Record<CvLanguage, Partial<Record<SectionType, Record<string, string>>>> = {
  tr: {
    skills: { name: 'Araçlar', keywords: 'Git, Docker, Figma' },
    languages: { name: 'Almanca', level: 'Başlangıç (A2)' },
    experience: { position: 'Stajyer', company: 'Örnek Şirket', description: '<ul><li>Ekibin test sürecine katkı sağladım.</li></ul>' },
    education: { school: 'Örnek Üniversitesi', degree: 'Sertifika programı', field: 'Veri Bilimi' },
    projects: { name: 'Örnek Proje', role: 'Geliştirici', description: '<ul><li>Küçük bir web uygulaması geliştirdim.</li></ul>' },
    certificates: { name: 'Örnek Sertifika', issuer: 'Örnek Kurum' },
    awards: { title: 'Örnek Ödül', issuer: 'Örnek Kurum' },
    volunteer: { role: 'Gönüllü', organization: 'Örnek Dernek' },
    references: { name: 'Örnek Kişi', position: 'Takım Lideri' },
    custom: { title: 'Örnek kayıt' },
  },
  en: {
    skills: { name: 'Tools', keywords: 'Git, Docker, Figma' },
    languages: { name: 'German', level: 'Beginner (A2)' },
    experience: { position: 'Intern', company: 'Example Inc.', description: '<ul><li>Contributed to the team’s testing process.</li></ul>' },
    education: { school: 'Example University', degree: 'Certificate program', field: 'Data Science' },
    projects: { name: 'Example Project', role: 'Developer', description: '<ul><li>Built a small web application.</li></ul>' },
    certificates: { name: 'Example Certificate', issuer: 'Example Institute' },
    awards: { title: 'Example Award', issuer: 'Example Institute' },
    volunteer: { role: 'Volunteer', organization: 'Example Association' },
    references: { name: 'Example Person', position: 'Team Lead' },
    custom: { title: 'Example entry' },
  },
}

const wantsAdd = (p: string) => /(^|[^\p{L}])(ekle|add)/u.test(p)
const wantsRemove = (p: string) => /(^|[^\p{L}])(sil|kaldır|çıkar|remove|delete)/u.test(p)

type SentSection = EditPayload['sections'][number]

/** İstekte adı geçen bölümler; hiçbiri geçmiyorsa hepsi. */
function focusSections(payload: EditPayload): SentSection[] {
  const prompt = payload.prompt.toLocaleLowerCase(payload.language)
  const mentioned = payload.sections.filter((s) => {
    const words = [s.title, SECTION_TITLES.tr[s.type], SECTION_TITLES.en[s.type], ...TYPE_WORDS[s.type]]
    return words.some((w) => w && prompt.includes(w.toLocaleLowerCase(payload.language)))
  })
  return mentioned.length > 0 ? mentioned : payload.sections
}

/** Örnek düzenleme: payload'dan işlem listesi üretir (saf işlev; testlerde doğrudan çağrılır). */
export function mockEdit(payload: EditPayload, limit = 4): EditResult {
  const lang = payload.language
  const prompt = payload.prompt.toLocaleLowerCase(lang)
  const sections = focusSections(payload)
  const operations: EditOperation[] = []

  // Kaldırma ve ekleme örnekleri (istekte geçiyorsa).
  if (wantsRemove(prompt)) {
    const from = [...sections].reverse().find((s) => s.type !== 'summary' && s.items.length > 0)
    const item = from?.items.at(-1)
    if (from && item) operations.push({ op: 'remove', sectionId: from.id, itemId: item.id, reason: m.ai2_note_sample_remove() })
  }
  if (wantsAdd(prompt) && payload.scope.kind !== 'item') {
    const target =
      sections.find((s) => s.type === 'skills' || s.type === 'languages') ?? sections.find((s) => s.type !== 'summary')
    const fields = target && SAMPLE_ADD[lang][target.type]
    if (target && fields) {
      operations.push({
        op: 'add',
        sectionId: target.id,
        afterItemId: target.items.at(-1)?.id ?? null,
        fields,
        reason: m.ai2_note_sample_add(),
      })
    }
  }

  // Biçim düzeltmeleri: odaktaki bölümlerin zengin metin alanları.
  const tidyOps: EditOperation[] = []
  for (const section of sections) {
    const richFields = TEXT_FIELDS[section.type].filter((f) => f.rich)
    for (const item of section.items) {
      for (const f of richFields) {
        const value = item[f.key]
        if (tidyOps.length >= limit || typeof value !== 'string' || isRichTextEmpty(value)) continue
        const after = tidyHtml(value, lang)
        if (after !== value) tidyOps.push({ op: 'set', target: item.id, field: f.key, value: after, reason: m.ai_note_tidy() })
      }
    }
  }
  operations.push(...tidyOps)

  // Düzeltilecek bir şey yoksa ekranın görülebilmesi için örnek bir yeniden yazım.
  if (tidyOps.length === 0) {
    const summary = sections.find((s) => s.type === 'summary' && s.items.length > 0)
    const listSection = sections.find((s) => s.type !== 'summary' && s.items.some((i) => typeof i.description === 'string'))
    // İstek bir liste bölümünü anıyorsa (ör. "Deneyim maddelerini…") özeti değil o bölümü örnekle.
    if (listSection && (!summary || sections.length < payload.sections.length)) {
      const item = listSection.items.find((i) => typeof i.description === 'string')!
      const before = item.description as string
      const bullet = `<li>${SAMPLE_BULLET[lang]}</li>`
      const after = /<\/ul>\s*$/.test(before) ? before.replace(/<\/ul>\s*$/, `${bullet}</ul>`) : `${before}<ul>${bullet}</ul>`
      operations.push({ op: 'set', target: item.id, field: 'description', value: after, reason: m.ai2_note_sample_bullet() })
    } else if (summary) {
      operations.push({ op: 'set', target: summary.items[0].id, field: 'content', value: SAMPLE_SUMMARY[lang], reason: m.ai_note_sample() })
    }
  }
  return { operations }
}

/** Gecikme ve iptal taklidi. İptalde AiError('aborted') (adı AbortError: iki kontrol de tutar). */
function delay<T>(value: () => T, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      const error = new AiError('İstek durduruldu', 'aborted')
      error.name = 'AbortError'
      reject(error)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      try {
        resolve(value())
      } catch (error) {
        reject(error)
      }
    }, ms)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

// ---------------------------------------------------------------- Deneme bayrakları

/**
 * Yalnız denemek için (uçtan uca testler ve elle deneme): localStorage'daki
 * `cveditor:mockAi` JSON'u örnek sağlayıcıyı gerçek sunucu gibi davrandırır.
 *   { "password": "deneme" }  → parola ister; doğru parola girilene dek her çağrı 'unauthorized'
 *   { "fail": "rate_limited" } → her çağrı bu hata koduyla döner
 *   { "malformed": true }     → her çağrı şemaya uymayan bir yanıt döndürür (doğrulama hatası)
 * Bayrak yoksa (varsayılan) parola istenmez, hata üretilmez.
 */
export const MOCK_FLAGS_KEY = 'cveditor:mockAi'

interface MockFlags {
  password?: string
  fail?: AiErrorCode
  /** Yanıt şemaya uymayan bir nesne olur (doğrulama yolunu denemek için) */
  malformed?: boolean
}

function mockFlags(): MockFlags {
  try {
    const raw = localStorage.getItem(MOCK_FLAGS_KEY)
    return raw ? (JSON.parse(raw) as MockFlags) : {}
  } catch {
    return {}
  }
}

/** Örnek oturum: doğru parola girilince açılır (gerçekte HttpOnly çerez). */
let session = false

/** Testler için: örnek oturumu kapatır. */
export function resetMockSession() {
  session = false
}

function guarded<T>(value: () => T): () => T {
  return () => {
    const flags = mockFlags()
    if (flags.password && !session) throw new AiError('Parola gerekli', 'unauthorized')
    if (flags.fail) throw new AiError(`Örnek hata: ${flags.fail}`, flags.fail)
    if (flags.malformed) return { bozuk: 'yanıt' } as unknown as T
    return value()
  }
}

export const mockProvider: AiProvider = {
  id: 'mock',
  isDemo: true,
  get requiresAuth() {
    return !!mockFlags().password
  },
  authenticate: (password, signal) =>
    delay(
      () => {
        const expected = mockFlags().password
        if (expected && password !== expected) throw new AiError('Parola yanlış', 'unauthorized')
        session = true
      },
      400,
      signal,
    ),
  edit: (payload, signal) => delay(guarded(() => mockEdit(payload)), 900, signal),
  translate: (request, signal) => delay(guarded(() => mockTranslate(request)), 700, signal),
  parseImport: (request, signal) => delay(guarded(() => heuristicImport(request)), 600, signal),
  review: (request, signal) => delay(guarded(() => mockReview(request)), 900, signal),
  matchKeywords: (request, signal) => delay(guarded(() => mockMatchKeywords(request)), 700, signal),
}
