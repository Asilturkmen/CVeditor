import { isItemEmpty } from '@/cv/factory'
import { CONTACT_FIELDS, PERSONAL_TEXT_FIELDS, TEXT_FIELDS, type TextField } from '@/cv/fields'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv, DateRange, Section, YearMonth } from '@/cv/schema'
import { buildContactMasks, createMasker } from './mask'
import type { AiScope, EditPayload } from './types'

export { hasPlaceholder } from './mask'

/**
 * Sağlayıcıya giden düzenleme isteğini kurar. Gizlilik kuralları:
 * - yalnız seçili kapsam (Tüm CV → görünür bölümler; gizli kayıtlar hiç gitmez)
 * - ad soyad hiç gitmez; iletişim alanları (kişinin ve referansların) yalnız
 *   istek iletişimle ilgiliyse
 * - unvan yalnız "Tüm CV" kapsamında gider (yalnız orada değiştirilebilir)
 * - metinlerde geçen ad / e-posta / telefon / bağlantılar ⟦…⟧ yer tutucusuyla
 *   maskelenir (mask.ts); `unmask` yanıttaki yer tutucuları yerelde geri koyar.
 */

type ContactField = (typeof CONTACT_FIELDS)[number]

// JavaScript'in \b'si yalnız ASCII harf tanır ("şehir"de çalışmaz); harf sınırı elle yazılır.
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const kw = (source: string) => new RegExp(source.replaceAll('\\b<', B).replaceAll('\\b>', E), 'u')

/**
 * İstekte geçen açık ifadeye göre gönderilecek iletişim alanları (TR/EN).
 * Yalnız açık biçimler sayılır: "web geliştirme", "site reliability",
 * "address the gaps", "mail order", "iletişim becerileri" iletişim değildir.
 */
const CONTACT_KEYWORDS: [RegExp, readonly ContactField[]][] = [
  [kw(String.raw`\b<e-?posta|\b<e-?mail|\b<mail adres`), ['email']],
  [kw(String.raw`\b<telefon|\b<phone\b>|\b<numaram|\b<gsm\b>|\b<cep numara`), ['phone']],
  // "e-posta adresi", "web adresi" konum sayılmaz.
  [
    kw(String.raw`(?<!(?:posta|mail|web|site)\s?)\b<adres(?:im|imi|imin|imde|i|ini)?\b>|\b<my address\b>|\b<location\b>|\b<konum|\b<şehir|\b<şehrim`),
    ['location'],
  ],
  [kw(String.raw`linkedin|linkedın`), ['linkedin']],
  [kw(String.raw`github`), ['github']],
  [
    kw(String.raw`\b<web ?site(?:si|sini|m|mi|mı|me|mde|min|mın)?\b>|\b<kişisel (?:web ?)?site|\b<personal (?:web ?)?site|\b<my web ?site|\b<portfol(?:io|yo) ?site`),
    ['website'],
  ],
  [kw(String.raw`\b<iletişim (?:bilgi|kısm|alan|satır|bölüm)|\b<contact (?:info|information|details|section)\b>`), CONTACT_FIELDS],
]

/** İstek hangi iletişim alanlarıyla ilgili? (boş dizi: hiçbiri) */
export function contactFieldsForPrompt(prompt: string): ContactField[] {
  // Türkçe küçültme "LinkedIn"i "linkedın" yapar; iki küçültme birlikte aranır.
  const text = `${prompt.toLocaleLowerCase('tr')}\n${prompt.toLowerCase()}`
  const found = new Set<ContactField>()
  for (const [re, fields] of CONTACT_KEYWORDS) if (re.test(text)) fields.forEach((f) => found.add(f))
  return CONTACT_FIELDS.filter((f) => found.has(f))
}

/** Üçüncü kişi iletişim alanı (referans e-postası/telefonu) bu istekte gönderilir mi? */
export function sendsContactField(field: TextField, contacts: readonly ContactField[]): boolean {
  return !field.contact || contacts.includes(field.contact)
}

const pad = (n: number) => String(n).padStart(2, '0')
const ym = (v: YearMonth | null) => (v ? (v.month ? `${v.year}-${pad(v.month)}` : String(v.year)) : undefined)

function itemPayload(
  section: Section,
  item: AnyItem,
  mask: (s: string) => string,
  contacts: readonly ContactField[],
): { id: string } & Record<string, unknown> {
  const record = item as unknown as Record<string, unknown>
  const out: { id: string } & Record<string, unknown> = { id: item.id }
  for (const f of TEXT_FIELDS[section.type]) {
    if (!sendsContactField(f, contacts)) continue
    const value = record[f.key]
    if (typeof value === 'string') out[f.key] = mask(value)
  }
  // Tarihler yalnız bağlam için (değiştirilemez alanlar).
  const range = record.dates as DateRange | undefined
  if (range) {
    const start = ym(range.start)
    const end = range.current ? 'present' : ym(range.end)
    if (start) out.start = start
    if (end) out.end = end
  }
  const date = ym((record.date as YearMonth | null | undefined) ?? null)
  if (date) out.date = date
  return out
}

export function buildEditPayload(cv: Cv, scope: AiScope, prompt: string): { payload: EditPayload; unmask: (s: string) => string } {
  const masker = createMasker(buildContactMasks(cv.personal))
  const { mask } = masker
  const contacts = contactFieldsForPrompt(prompt)

  const sections: EditPayload['sections'] = []
  for (const section of cv.sections) {
    let items = section.items as AnyItem[]
    if (scope.kind === 'all') {
      if (section.hidden) continue
      items = items.filter((i) => !i.hidden && !isItemEmpty(i))
    } else {
      if (section.id !== scope.sectionId) continue
      // Kullanıcı bölümü ya da kaydı kendisi seçti: gizli olsa da gönderilir.
      items = scope.kind === 'item' ? items.filter((i) => i.id === scope.itemId) : items.filter((i) => !i.hidden)
    }
    sections.push({
      id: section.id,
      type: section.type,
      title: mask(sectionTitle(cv.language, section.type, section.title)),
      items: items.map((i) => itemPayload(section, i, mask, contacts)),
    })
  }

  const personal: EditPayload['personal'] = {}
  if (scope.kind === 'all') {
    for (const f of PERSONAL_TEXT_FIELDS) personal[f.key as 'headline'] = mask(cv.personal[f.key as 'headline'])
  }
  for (const f of contacts) personal[f] = cv.personal[f]

  const payload: EditPayload = {
    language: cv.language,
    prompt: mask(prompt.trim()),
    scope,
    personal,
    sections,
    placeholders: masker.placeholders(),
  }
  return { payload, unmask: masker.unmask }
}
