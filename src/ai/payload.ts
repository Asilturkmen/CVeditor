import { isItemEmpty } from '@/cv/factory'
import { CONTACT_FIELDS, PERSONAL_TEXT_FIELDS, TEXT_FIELDS, type TextField } from '@/cv/fields'
import { sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv, DateRange, Section, YearMonth } from '@/cv/schema'
import { buildContactMasks, createMasker, maskSourceOf } from './mask'
import type { AiScope, EditPayload, PayloadField } from './types'

export { hasPlaceholder } from './mask'

/**
 * Sağlayıcıya giden düzenleme isteğini kurar. Gizlilik kuralları:
 * - yalnız seçili kapsam (Tüm CV → görünür bölümler; gizli kayıtlar hiç gitmez)
 * - ad soyad hiç gitmez
 * - iletişim alanları (e-posta, telefon, konum, site, LinkedIn, GitHub) YALNIZ
 *   kullanıcı "İletişim bilgilerimi de gönder"i açıkça seçerse gider
 *   (`options.contact`; varsayılan kapalı). İstekteki anahtar kelime
 *   ("e-postamı düzelt") yalnız ipucudur (`contactFieldsForPrompt`): arayüz
 *   kutuyu önerir, kendiliğinden göndermez.
 * - referans kişilerin e-postası/telefonu (üçüncü kişi) kendiliğinden hiç
 *   gitmez: yalnız iletişim seçiliyken VE kapsam bir referans bölümü/kaydıysa.
 * - unvan yalnız "Tüm CV" kapsamında gider (yalnız orada değiştirilebilir)
 * - metinlerde geçen ad (parçaları ve bağlantıdaki bitişik biçimi dahil), her
 *   e-posta adresi ve telefon numarası, kişinin bağlantıları, konum, referans
 *   kişilerin adı / e-postası / telefonu ve deseni olan kişisel bilgiler
 *   (adres, doğum tarihi, kimlik no, kullanıcı adı) ⟦…⟧ yer tutucusuyla
 *   maskelenir (kurallar mask.ts'te); referansın ad alanı da maskeli gider.
 * - seçilen iletişim alanları özgün değerleriyle gider ki model onları görüp
 *   düzeltebilsin; metinlerdeki geçişleri yine maskeli.
 * - yanıtta yalnız gönderilen yer tutucular geri konur (`restore`): model
 *   metinde geçmeyen bir yer tutucu uydurursa (ör. ⟦PHONE⟧) ya da bozarsa
 *   ("⟦İSİM⟧", "[EMAIL]") o değer atılır. İstisna: seçilen kişisel iletişim
 *   alanının yer tutucusu (ör. ⟦EMAIL⟧) kişisel bilgideki değerle doldurulur;
 *   o değer zaten açıkça gitti.
 * - her bölümle birlikte yazılabilecek alanlar (`fields`: ad + zengin/düz)
 *   gider; `add` işlemi yalnız bu adları kullanabilir.
 */

type ContactField = (typeof CONTACT_FIELDS)[number]

export interface EditPayloadOptions {
  /** Kullanıcı "İletişim bilgilerimi de gönder"i seçti */
  contact?: boolean
}

/** Seçilen iletişim alanının yer tutucusu (metinde geçmese de geri konabilir) */
const FALLBACK_PLACEHOLDER: Record<ContactField, string> = {
  email: '⟦EMAIL⟧',
  phone: '⟦PHONE⟧',
  location: '⟦LOCATION⟧',
  website: '⟦WEBSITE⟧',
  linkedin: '⟦LINKEDIN⟧',
  github: '⟦GITHUB⟧',
}

// JavaScript'in \b'si yalnız ASCII harf tanır ("şehir"de çalışmaz); harf sınırı elle yazılır.
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const kw = (source: string) => new RegExp(source.replaceAll('\\b<', B).replaceAll('\\b>', E), 'u')

/**
 * İstekte geçen açık ifadeye göre ilgili iletişim alanları (TR/EN). YALNIZ
 * İPUCU: arayüz "İletişim bilgilerimi de gönder" kutusunu önerir; gönderim
 * kutunun seçimine bağlıdır. Yalnız açık biçimler sayılır: "web geliştirme",
 * "site reliability", "address the gaps", "mail order", "iletişim becerileri"
 * iletişim değildir.
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

/** İstek hangi iletişim alanlarıyla ilgili görünüyor? (yalnız ipucu; boş dizi: hiçbiri) */
export function contactFieldsForPrompt(prompt: string): ContactField[] {
  // Türkçe küçültme "LinkedIn"i "linkedın" yapar; iki küçültme birlikte aranır.
  const text = `${prompt.toLocaleLowerCase('tr')}\n${prompt.toLowerCase()}`
  const found = new Set<ContactField>()
  for (const [re, fields] of CONTACT_KEYWORDS) if (re.test(text)) fields.forEach((f) => found.add(f))
  return CONTACT_FIELDS.filter((f) => found.has(f))
}

/** Alan bu istekte gönderilir mi? Üçüncü kişi iletişim alanı (referans e-postası/telefonu) yalnız açıkça seçildiyse. */
export function sendsContactField(field: TextField, referenceContacts: boolean): boolean {
  return !field.contact || referenceContacts
}

const pad = (n: number) => String(n).padStart(2, '0')
const ym = (v: YearMonth | null) => (v ? (v.month ? `${v.year}-${pad(v.month)}` : String(v.year)) : undefined)

function itemPayload(
  section: Section,
  item: AnyItem,
  mask: (s: string) => string,
  referenceContacts: boolean,
): { id: string } & Record<string, unknown> {
  const record = item as unknown as Record<string, unknown>
  const out: { id: string } & Record<string, unknown> = { id: item.id }
  for (const f of TEXT_FIELDS[section.type]) {
    if (!sendsContactField(f, referenceContacts)) continue
    const value = record[f.key]
    // Seçilen referans e-postası/telefonu özgün değeriyle gider (kişisel iletişim alanları gibi).
    if (typeof value === 'string') out[f.key] = f.contact ? value : mask(value)
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

export interface BuiltEditPayload {
  payload: EditPayload
  /** Yer tutucuları geri koyar (bilinmeyen olduğu gibi kalır); yalnız gösterim/test için */
  unmask: (s: string) => string
  /** Sıkı geri koyma: tanınmayan ya da bozulmuş yer tutucu varsa null (değer atılır) */
  restore: (s: string) => string | null
}

export function buildEditPayload(cv: Cv, scope: AiScope, prompt: string, options: EditPayloadOptions = {}): BuiltEditPayload {
  const contacts: readonly ContactField[] = options.contact ? CONTACT_FIELDS : []
  const masker = createMasker(buildContactMasks(maskSourceOf(cv)), { fallback: contacts.map((f) => FALLBACK_PLACEHOLDER[f]) })
  const { mask } = masker

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
    // Referansın iletişimi: iletişim seçili ve kullanıcı referans bölümünü/kaydını kapsam olarak seçti.
    const referenceContacts = !!options.contact && scope.kind !== 'all' && section.type === 'references'
    const fields: PayloadField[] = TEXT_FIELDS[section.type]
      .filter((f) => sendsContactField(f, referenceContacts))
      .map((f) => ({ key: f.key, rich: f.rich }))
    sections.push({
      id: section.id,
      type: section.type,
      title: mask(sectionTitle(cv.language, section.type, section.title)),
      fields,
      items: items.map((i) => itemPayload(section, i, mask, referenceContacts)),
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
  return { payload, unmask: masker.unmask, restore: masker.restore }
}
