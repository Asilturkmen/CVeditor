import { duplicateCv, stripHtml } from '@/cv/factory'
import { PERSONAL_TEXT_FIELDS, TEXT_FIELDS } from '@/cv/fields'
import { SECTION_TITLES } from '@/cv/locale'
import type { AnyItem, Cv, CvLanguage, SectionType } from '@/cv/schema'
import { sanitizeRichText } from '@/render/richtext'
import { buildContactMasks, createMasker, hasPlaceholder, placeholdersIn, type Masker, type MaskSource } from './mask'
import { AiError, TranslateResultSchema, type TranslateRequest, type TranslateResult } from './types'

/**
 * Çeviri akışının sağlayıcıdan bağımsız kısmı: CV'den (ya da tek kayıttan)
 * çevrilecek metinleri toplar, sağlayıcının yanıtını eşler ve onaylanan
 * metinleri yeni CV'ye / kayda uygular. Hangi alanın çevrileceği
 * src/cv/fields.ts'teki tablodan gelir (şirket, kişi, ürün adları, bağlantı,
 * e-posta, beceri anahtar kelimeleri çevrilmez). Tarihler ve varsayılan
 * bölüm başlıkları CV diline göre zaten kendiliğinden değişir (locale.ts).
 *
 * Gizlilik (düzenleme yoluyla aynı): gizli bölüm ve kayıtlar gönderilmez
 * (yeni CV'ye çevrilmeden, olduğu gibi kopyalanır); metinlerde geçen ad,
 * iletişim bilgileri ve konum (verilirse referans kişiler de) ⟦…⟧ ile
 * maskelenir, yanıtta yerelde geri konur. Yer
 * tutucusu geri konamayan alan kaynak metniyle kalır ve işaretlenir.
 *
 * Anahtar biçimi: `${itemId}:${field}`, `personal:${field}`, `section:${id}:title`.
 */

export interface TranslationEntry {
  key: string
  /** Kaynak metin */
  text: string
  rich: boolean
  /** null → kişisel bilgiler */
  sectionId: string | null
  sectionType: SectionType | null
  /** null → bölüm başlığı ya da kişisel alan */
  itemId: string | null
  field: string
}

export interface TranslatedEntry extends TranslationEntry {
  translated: string
  /** Sağlayıcı bu anahtarı döndürmedi ya da yanıt kullanılamadı; kaynak metin aynen kaldı */
  missing: boolean
  /** Yanıttaki kişisel bilgi yer tutucuları geri konamadı (kaybolmuş ya da uydurulmuş); kaynak metin kaldı */
  unrestored: boolean
}

export const personalKey = (field: string) => `personal:${field}`
export const sectionTitleKey = (sectionId: string) => `section:${sectionId}:title`
export const itemKey = (itemId: string, field: string) => `${itemId}:${field}`

export const otherLanguage = (language: CvLanguage): CvLanguage => (language === 'tr' ? 'en' : 'tr')

function hasText(value: unknown, rich: boolean): value is string {
  if (typeof value !== 'string') return false
  return (rich ? stripHtml(value) : value).trim() !== ''
}

/** Özel başlık, kaynak dilin varsayılan başlığıyla aynıysa çevrilmez; hedefte otomatik başlığa döner. */
function isDefaultTitle(title: string, type: SectionType, from: CvLanguage) {
  return title.trim().toLocaleLowerCase(from) === SECTION_TITLES[from][type].toLocaleLowerCase(from)
}

export function collectItemTexts(sectionId: string, type: SectionType, item: AnyItem): TranslationEntry[] {
  const record = item as unknown as Record<string, unknown>
  return TEXT_FIELDS[type]
    .filter((f) => f.translate && hasText(record[f.key], f.rich))
    .map((f) => ({
      key: itemKey(item.id, f.key),
      text: record[f.key] as string,
      rich: f.rich,
      sectionId,
      sectionType: type,
      itemId: item.id,
      field: f.key,
    }))
}

/** Gizli bölüm ve kayıtlar çeviriye gönderilmez; yeni CV'ye olduğu gibi kopyalanır. */
export function collectCvTexts(cv: Cv): TranslationEntry[] {
  const entries: TranslationEntry[] = []
  for (const f of PERSONAL_TEXT_FIELDS) {
    const value = (cv.personal as unknown as Record<string, unknown>)[f.key]
    if (f.translate && hasText(value, f.rich)) {
      entries.push({ key: personalKey(f.key), text: value, rich: f.rich, sectionId: null, sectionType: null, itemId: null, field: f.key })
    }
  }
  for (const section of cv.sections) {
    if (section.hidden) continue
    const title = section.title
    if (title && title.trim() && !isDefaultTitle(title, section.type, cv.language)) {
      entries.push({
        key: sectionTitleKey(section.id),
        text: title,
        rich: false,
        sectionId: section.id,
        sectionType: section.type,
        itemId: null,
        field: 'title',
      })
    }
    for (const item of section.items as AnyItem[]) {
      if (!item.hidden) entries.push(...collectItemTexts(section.id, section.type, item))
    }
  }
  return entries
}

export interface PreparedTranslation {
  request: TranslateRequest
  masker: Masker
  /** anahtar → sağlayıcıya giden (maskeli) metin */
  sent: Map<string, string>
}

/**
 * Sağlayıcıya gidecek istek: her metinde kişinin adı, iletişim bilgileri ve
 * konumu maskelenir (kurallar mask.ts'te). `maskSourceOf(cv)` verilirse
 * referans kişilerin adı ve iletişim bilgileri de maskelenir.
 */
export function buildTranslateRequest(from: CvLanguage, to: CvLanguage, entries: TranslationEntry[], personal: MaskSource): PreparedTranslation {
  const masker = createMasker(buildContactMasks(personal))
  const sent = new Map<string, string>()
  const items = entries.map((e) => {
    const text = masker.mask(e.text)
    sent.set(e.key, text)
    return { key: e.key, text, rich: e.rich }
  })
  return { request: { from, to, items }, masker, sent }
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))

/**
 * Sağlayıcı yanıtını girdilerle eşler. Şemaya uymayan yanıt reddedilir;
 * eksik anahtar kaynak metinle kalır (arayüz işaretler), fazla anahtar
 * yok sayılır. Yer tutucular yerelde geri konur; gönderilenle aynı yer
 * tutucular gelmediyse (biri kaybolmuş ya da uydurulmuş) alan kaynak
 * metinle kalır ve `unrestored` işaretlenir. Zengin metin, yer tutucular
 * geri konduktan sonra kısıtlı HTML'e süzülür (href içindeki bağlantı kaybolmasın).
 */
export function mergeTranslations(entries: TranslationEntry[], result: TranslateResult, prepared: Pick<PreparedTranslation, 'masker' | 'sent'>): TranslatedEntry[] {
  const parsed = TranslateResultSchema.safeParse(result)
  if (!parsed.success) throw new AiError('Çeviri yanıtı beklenen biçimde değil', 'invalid_response')
  const byKey = new Map(parsed.data.items.map((i) => [i.key, i.text]))
  return entries.map((entry) => {
    const text = byKey.get(entry.key)
    if (text === undefined) return { ...entry, translated: entry.text, missing: true, unrestored: false }
    const expected = placeholdersIn(prepared.sent.get(entry.key) ?? entry.text)
    const restored = prepared.masker.unmask(text)
    if (!sameSet(expected, placeholdersIn(text)) || hasPlaceholder(restored)) {
      return { ...entry, translated: entry.text, missing: true, unrestored: true }
    }
    return { ...entry, translated: entry.rich ? sanitizeRichText(restored) : restored, missing: false, unrestored: false }
  })
}

/** Onaylanan metinler: anahtar → son metin. Listede olmayan alan kaynaktaki gibi kalır. */
export type TranslationValues = Record<string, string>

/** Kaydın çevrilmiş kopyası (id ve translationGroupId aynı; kaydetmeden önce çağıran id verir). */
export function applyToItem<T extends AnyItem>(item: T, values: TranslationValues): T {
  const copy = structuredClone(item) as unknown as Record<string, unknown>
  for (const key of Object.keys(copy)) {
    const value = values[itemKey(item.id, key)]
    if (value !== undefined && typeof copy[key] === 'string') copy[key] = value
  }
  return copy as unknown as T
}

/**
 * Çevrilmiş yeni CV: aynı şablon ve görünüm, yeni id'ler, kayıtlar
 * translationGroupId ile kaynaktakilere bağlı. Kaynak CV değişmez.
 */
export function createTranslatedCv(source: Cv, values: TranslationValues, options: { name: string; language: CvLanguage }): Cv {
  const draft = structuredClone(source)
  for (const f of PERSONAL_TEXT_FIELDS) {
    const value = values[personalKey(f.key)]
    if (value !== undefined) (draft.personal as unknown as Record<string, unknown>)[f.key] = value
  }
  draft.sections = draft.sections.map((section) => {
    const title = section.title
    const translatedTitle = values[sectionTitleKey(section.id)]
    const nextTitle =
      title && isDefaultTitle(title, section.type, source.language) ? null : translatedTitle !== undefined ? translatedTitle : title
    return {
      ...section,
      title: nextTitle,
      items: (section.items as AnyItem[]).map((item) => applyToItem(item, values)),
    } as typeof section
  })
  return duplicateCv(draft, options)
}

/** "Genel TR" → "Genel EN"; dil eki yoksa sona eklenir. */
export function suggestTranslatedName(name: string, to: CvLanguage): string {
  const suffix = to.toUpperCase()
  const trimmed = name.trim()
  const match = /^(.*?)([\s_\-(]+)(tr|en)(\)?)$/i.exec(trimmed)
  if (match) return `${match[1]}${match[2]}${suffix}${match[4]}`
  return trimmed ? `${trimmed} ${suffix}` : suffix
}
