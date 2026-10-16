import { isItemEmpty } from '@/cv/factory'
import { TEXT_FIELDS } from '@/cv/fields'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv, Section } from '@/cv/schema'

/**
 * İncelemenin ortak metin araçları. DOM'a dayanmaz (sunucuda da çalışsın):
 * kısıtlı zengin metin (p, ul/li, strong, em, a, br) düzenli ifadeyle çözülür.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (all, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENTITIES[name.toLowerCase()] ?? all
  })
}

/** Etiketleri atıp düz metin: satır içi etiketler boşluksuz, blok etiketleri boşlukla. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/(p|li|ul)>|<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t\n\r]+/g, ' ')
    .trim()
}

/** Açıklamanın maddeleri ve madde dışı paragrafları (boşluklar korunur, kırpılır). */
export function richParts(html: string): { bullets: string[]; paragraphs: string[] } {
  const bullets = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => inlineText(m[1])).filter(Boolean)
  const rest = html.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, ' ')
  const paragraphs = [...rest.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => inlineText(m[1])).filter(Boolean)
  // Etiketsiz düz metin (eski veri ya da içe aktarma)
  if (!paragraphs.length && !/<p[\s>]/i.test(rest)) {
    const plain = inlineText(rest)
    if (plain) paragraphs.push(plain)
  }
  return { bullets, paragraphs }
}

/** Satır içi metin: etiketler atılır, çift boşluk tespiti için boşluklar sadeleştirilmez. */
function inlineText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/[\n\r\t]/g, ' ').trim()
}

/**
 * Karşılaştırma anahtarı: Türkçe küçük harf + aksan katlama (ı→i, ş→s ...).
 * "SKILLS" Türkçe küçültmede "skılls" olur; katlama bunu da "skills"e çevirir.
 */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/i̇/g, 'i')
    .replace(/[ıîìí]/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/[öòó]/g, 'o')
    .replace(/[üûùú]/g, 'u')
    .replace(/[âàá]/g, 'a')
    .replace(/[éèê]/g, 'e')
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Çizilen (gizli ve boş olmayan) kayıtlar */
export function visibleItems(section: Section): AnyItem[] {
  return (section.items as AnyItem[]).filter((i) => !i.hidden && !isItemEmpty(i))
}

/** Kaydın bütün metin alanları, düz metin olarak */
export function itemText(section: Section, item: AnyItem): string {
  const record = item as unknown as Record<string, unknown>
  return TEXT_FIELDS[section.type]
    .map((f) => {
      const value = record[f.key]
      return typeof value === 'string' ? (f.rich ? htmlToText(value) : value.trim()) : ''
    })
    .filter(Boolean)
    .join('\n')
}

export function sectionText(cv: Cv, section: Section): string {
  return [sectionTitle(cv.language, section.type, section.title), ...visibleItems(section).map((i) => itemText(section, i))].join('\n')
}

/** CV'nin görünen metni (anahtar kelime karşılaştırması için). Gizliler katılmaz. */
export function cvPlainText(cv: Cv): string {
  const p = cv.personal
  const head = [p.fullName, p.headline, p.location].filter(Boolean).join('\n')
  const body = cv.sections.filter((s) => !s.hidden).map((s) => sectionText(cv, s))
  return [head, ...body].join('\n\n')
}
