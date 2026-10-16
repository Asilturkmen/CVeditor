import type { CvLanguage } from '@/cv/schema'
import { m } from '@/paraglide/messages'
import { detectLanguage, extractKeywords } from '@/review/keywords'
import { fold, htmlToText } from '@/review/text'
import type { KeywordMatchRequest, KeywordMatchResult, ReviewComment, ReviewRequest, ReviewResult } from './types'

/**
 * ÖRNEK SAĞLAYICININ inceleme yorumu ve ilan eşleşmesi. Gerçek yapay zekâ
 * değildir: gönderilecek isteği görür (gerçek sağlayıcıyla aynı girdi) ve
 * birkaç basit kuralla zararsız, deterministik örnek çıktı üretir. Puan ya da
 * yüzde üretmez.
 */

/** Zayıf kalıplar (mockProvider'ın düzeltme listesindekilerle aynı). */
const WEAK: Record<CvLanguage, RegExp> = {
  tr: /(görev aldım|yardımcı oldum|sorumluydum|ilgilendim)/i,
  en: /(responsible for|worked on|helped|was involved in)/i,
}

interface Bullet {
  text: string
  target?: ReviewComment['target']
}

function bulletsOf(request: ReviewRequest): Bullet[] {
  if (request.source.kind === 'text') {
    return request.source.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[•▪◦·\-–*]\s*\S/.test(line))
      .map((line) => ({ text: line.replace(/^[•▪◦·\-–*]\s*/, '') }))
  }
  const out: Bullet[] = []
  for (const section of request.source.sections) {
    if (section.type === 'summary') continue
    for (const item of section.items) {
      for (const value of Object.values(item)) {
        if (typeof value !== 'string' || !value.includes('<li')) continue
        for (const match of value.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
          out.push({ text: htmlToText(match[1]), target: { sectionId: section.id, itemId: item.id } })
        }
      }
    }
  }
  return out
}

function hasSummary(request: ReviewRequest): boolean {
  if (request.source.kind === 'cv') return request.source.sections.some((s) => s.type === 'summary' && s.items.length > 0)
  return /^(özet|profil|hakkımda|summary|profile|about me)\b/im.test(request.source.text)
}

/** Örnek yorum: payload'dan birkaç gözlem (saf işlev; testlerde doğrudan çağrılır). */
export function mockReview(request: ReviewRequest): ReviewResult {
  const comments: ReviewComment[] = []
  const bullets = bulletsOf(request)

  if (hasSummary(request)) comments.push({ kind: 'strength', message: m.rv_ai_mock_summary_ok() })
  else comments.push({ kind: 'improve', message: m.rv_ai_mock_summary_missing() })

  const numberless = bullets.filter((b) => !/\p{N}/u.test(b.text))
  if (numberless.length > 0) {
    comments.push({
      kind: 'improve',
      message: m.rv_ai_mock_numbers({ count: numberless.length }),
      ...(numberless[0].target ? { target: numberless[0].target } : {}),
    })
  } else if (bullets.length > 0) {
    comments.push({ kind: 'strength', message: m.rv_ai_mock_numbers_ok() })
  }

  const weak = bullets.find((b) => WEAK[request.cvLanguage].test(b.text) || WEAK.tr.test(b.text) || WEAK.en.test(b.text))
  if (weak) {
    const phrase = (weak.text.match(WEAK[request.cvLanguage]) ?? weak.text.match(WEAK.tr) ?? weak.text.match(WEAK.en))![0]
    comments.push({ kind: 'improve', message: m.rv_ai_mock_weak({ phrase }), ...(weak.target ? { target: weak.target } : {}) })
  }

  if (request.jobAd) {
    const terms = extractKeywords(request.jobAd, detectLanguage(request.jobAd, request.cvLanguage), 3).map((k) => k.term)
    if (terms.length > 0) comments.push({ kind: 'job_fit', message: m.rv_ai_mock_job({ terms: terms.join(', ') }) })
  }
  return { comments }
}

/**
 * Eş anlamlı / yakın kavram grupları (katlanmış yazım). Örnek eşleşme yalnız
 * bu küçük tabloyu bilir; gerçek model anlamı kendisi kurar.
 */
const GROUPS: string[][] = [
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['react', 'react.js', 'reactjs'],
  ['node.js', 'nodejs', 'node'],
  ['takim calismasi', 'ekip calismasi', 'is birligi', 'teamwork', 'collaboration'],
  ['ci/cd', 'github actions', 'gitlab ci', 'jenkins'],
  ['frontend', 'front-end', 'on yuz', 'arayuz gelistirme'],
  ['backend', 'back-end', 'arka uc'],
  ['rest', 'rest api', 'api'],
  ['sql', 'postgresql', 'mysql', 'sqlite'],
  ['test', 'testing', 'birim testi', 'unit test', 'jest', 'vitest', 'playwright'],
  ['agile', 'cevik', 'scrum', 'kanban'],
  ['ux', 'kullanici deneyimi', 'user experience'],
  ['iletisim', 'communication'],
  ['liderlik', 'leadership', 'ekip yonetimi', 'team lead'],
  ['cloud', 'bulut', 'aws', 'azure', 'gcp'],
  ['docker', 'kubernetes', 'container'],
  ['erisilebilirlik', 'accessibility', 'a11y', 'wcag'],
]

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRe = (needle: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(needle)}(?![\\p{L}\\p{N}])`, 'u')

/** Örnek anlamsal eşleşme: kurallı sonucu küçük eş anlamlı tablosuyla genişletir. */
export function mockMatchKeywords(request: KeywordMatchRequest): KeywordMatchResult {
  const cv = fold(request.cvText)
  // Katlama uzunluğu korursa CV'deki özgün yazım gösterilir ("ekip çalışması").
  const original = (alt: string) => {
    const at = cv.search(wordRe(alt))
    return cv.length === request.cvText.length && at >= 0 ? request.cvText.slice(at, at + alt.length) : alt
  }
  const matched = [...request.ruleKeywords.present]
  const related: KeywordMatchResult['related'] = []
  const missing: string[] = []
  for (const term of request.ruleKeywords.missing) {
    const key = fold(term)
    const group = GROUPS.find((g) => g.includes(key))
    const found = group?.find((alt) => alt !== key && wordRe(alt).test(cv))
    if (found) related.push({ term, cvTerm: original(found) })
    else missing.push(term)
  }
  return { matched, missing, related }
}
