import { newId } from '@/cv/factory'
import type { AnyItem, Cv, CvLanguage, Section } from '@/cv/schema'
import { isRichTextEmpty } from '@/render/richtext'
import { m } from '@/paraglide/messages'
import type { AiScope, Suggestion } from './ui'

/**
 * V1 ÖRNEK ÖNERİ ÜRETİCİSİ — gerçek yapay zekâ değildir, hiçbir yere istek
 * atmaz. Yalnız öneri işaretleme / kabul / ret ekranını gerçek CV üzerinde
 * denemek için basit, zararsız biçim düzeltmeleri önerir:
 *   - madde başlarını büyük harfe çevirir, fazla boşlukları siler
 *   - madde sonlarındaki noktaları çoğunluğa göre tutarlı yapar
 *   - birkaç zayıf kalıbı güçlü fiille değiştirir (örnek amaçlı)
 * V3'te bu dosyanın yerini sağlayıcıya bağlı tek katman alacak; arayüz
 * aynı Suggestion biçimini kullanmaya devam eder.
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

function inScope(scope: AiScope, section: Section, item: AnyItem) {
  if (scope.kind === 'all') return true
  if (scope.kind === 'section') return scope.sectionId === section.id
  return scope.itemId === item.id
}

const SAMPLE_SUMMARY: Record<CvLanguage, string> = {
  tr: '<p>Kullanıcı odaklı arayüzler geliştiren yazılımcı. Son projemde sayfa yüklenme süresini %30 kısalttım; ekip içinde erişilebilirlik ve test kültürünü yaygınlaştırıyorum.</p>',
  en: '<p>Developer building user-focused interfaces. In my latest project I cut page load time by 30% and I champion accessibility and testing within the team.</p>',
}

export function generateMockSuggestions(cv: Cv, scope: AiScope, limit = 4): Suggestion[] {
  const result: Suggestion[] = []
  const lang = cv.language

  for (const section of cv.sections) {
    if (section.hidden) continue
    for (const item of section.items as AnyItem[]) {
      if (result.length >= limit) break
      if (item.hidden || !inScope(scope, section, item)) continue
      const field = section.type === 'summary' ? 'content' : 'description'
      const value = (item as unknown as Record<string, unknown>)[field]
      if (typeof value !== 'string' || isRichTextEmpty(value)) continue
      const after = tidyHtml(value, lang)
      if (after !== value) {
        result.push({
          id: newId(),
          sectionId: section.id,
          target: item.id,
          field,
          before: value,
          after,
          rich: true,
          note: m.ai_note_tidy(),
        })
      }
    }
  }

  // Düzeltilecek bir şey yoksa ekranın görülebilmesi için özet üzerinde örnek öneri.
  if (result.length === 0) {
    const summary = cv.sections.find((s) => s.type === 'summary' && !s.hidden)
    const item = summary?.items[0] as AnyItem | undefined
    if (summary && item && inScope(scope, summary, item)) {
      const before = (item as unknown as { content: string }).content
      result.push({
        id: newId(),
        sectionId: summary.id,
        target: item.id,
        field: 'content',
        before,
        after: SAMPLE_SUMMARY[lang],
        rich: true,
        note: m.ai_note_sample(),
      })
    }
  }
  return result
}
