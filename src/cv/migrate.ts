import { z } from 'zod'
import { m } from '@/paraglide/messages'
import { newId } from './factory'
import { isSafePhoto } from './photo'
import { CURRENT_SCHEMA_VERSION, CvSchema, type Cv } from './schema'

type RawCv = Record<string, unknown>

/** Nedeni bilinen ve arayüz dilinde yazılmış okuma hatası (mesajı kullanıcıya gösterilebilir). */
export class CvReadError extends Error {
  override name = 'CvReadError'
}

/** Göçte gereken eski şablon bilgisi; templates.ts değişse de göç aynı kalsın diye burada sabit. */
interface V1Template {
  to: string
  accent: string
  font: string
  align: 'left' | 'center'
  toAccent: string
  toFont: string
  toAlign: 'left' | 'center'
  columns: (1 | 2)[]
}
const V1_TEMPLATES: Record<string, V1Template> = {
  // Klasik → Zarif (yalnız tek sütun; Zarif'in başlığı ortalı)
  klasik: { to: 'zarif', accent: '#1f5f8b', font: 'source-serif-4', align: 'left', toAccent: '#7a2e2e', toFont: 'eb-garamond', toAlign: 'center', columns: [1] },
  // Modern → Panel (yalnız iki sütun)
  modern: { to: 'panel', accent: '#2f6f62', font: 'inter', align: 'left', toAccent: '#2f8f7f', toFont: 'inter', toAlign: 'left', columns: [2] },
}
const V1_SIDE_TYPES = ['skills', 'languages', 'certificates', 'awards', 'references']

/**
 * 1 → 2 (10 şablon): Klasik → Zarif, Modern → Panel. İçerik değişmez. Kullanıcının
 * değiştirmediği (eski şablonun varsayılanındaki) vurgu rengi, yazı tipi ve başlık hizası yeni
 * şablonunkine geçer (şablon değiştirme kuralı; Klasik'in sola yaslı başlığı Zarif'te ortalı olur —
 * eski kayıtta "seçilmiş" ile "varsayılan" ayırt edilemez, varsayılanda kaldığı kabul edilir); sütun sayısı yeni şablonun desteklediğine çekilir.
 * `showPhoto` olduğu gibi kalır (yalnız yeni CV'lerde varsayılan açık). Yeni alan:
 * `template.baseColor` (null = şablonun varsayılan zemini).
 */
function migrate1to2(cv: RawCv): RawCv {
  const template = { ...((cv.template as Record<string, unknown> | undefined) ?? {}) }
  const old = typeof cv.templateId === 'string' ? V1_TEMPLATES[cv.templateId] : undefined
  let templateId = cv.templateId
  if (old) {
    templateId = old.to
    if (typeof template.accentColor === 'string' && template.accentColor.toLowerCase() === old.accent) template.accentColor = old.toAccent
    if (template.font === old.font) template.font = old.toFont
    if (template.headerAlign === old.align) template.headerAlign = old.toAlign
    if (!old.columns.includes(template.columns as 1 | 2)) template.columns = old.columns[0]
    const sections = Array.isArray(cv.sections) ? (cv.sections as { id?: unknown; type?: unknown }[]) : []
    if (template.columns === 2 && Array.isArray(template.sideSections) && template.sideSections.length === 0) {
      template.sideSections = sections.filter((s) => V1_SIDE_TYPES.includes(String(s.type))).map((s) => s.id)
    }
  }
  template.baseColor = template.baseColor ?? null
  return { ...cv, schemaVersion: 2, templateId, template }
}

/**
 * Şema 2'nin (10 şablon) şablonları ve 3'teki (14 şablon) karşılıkları; göç sabit kalsın diye
 * templateMeta.ts'ten okunmaz, burada dondurulur. `accents`: eski şablonun hazır takımlarının vurgu
 * renkleri (ilki varsayılan). `toAccents`: yeni şablonun takım vurguları (ilki varsayılan).
 * `toColumns`: yeni şablonun desteklediği sütunlar (ilki varsayılan). `resetBase`: zemin rengi null olur
 * (Gece'nin koyu sayfası, Çift Ton'un yarısı yeni şablonda anlamsız).
 */
interface V2Template {
  to: string
  accents: string[]
  font: string
  align: 'left' | 'center'
  toAccents: string[]
  toFont: string
  toAlign: 'left' | 'center'
  toColumns: (1 | 2)[]
  resetBase?: boolean
}
const DERGI = { to: 'dergi', toAccents: ['#a63d1e', '#1f3a5f', '#2f5d50', '#161616', '#8c2f39'], toFont: 'source-serif-4', toAlign: 'left', toColumns: [1, 2] } as const
const PANEL = { to: 'panel', toAccents: ['#1f4e79', '#256b52', '#3d4651', '#7d2a3c', '#1f3a5f'], toFont: 'source-sans-3', toAlign: 'left', toColumns: [2] } as const
const V2_TEMPLATES: Record<string, V2Template> = {
  zarif: {
    to: 'zarif',
    accents: ['#7a2e2e', '#1f3a5f', '#2f5d50'],
    font: 'eb-garamond',
    align: 'center',
    toAccents: ['#7a2e2e', '#1f3a5f', '#2f5d50', '#26221d', '#6b3a2a'],
    toFont: 'eb-garamond',
    toAlign: 'center',
    toColumns: [1],
  },
  panel: { ...PANEL, toAccents: [...PANEL.toAccents], toColumns: [2], accents: ['#2f8f7f', '#c9a45c', '#e0a96d', '#5aa9e6'], font: 'inter', align: 'left' },
  bant: {
    to: 'bant',
    accents: ['#0f4c75', '#0b5d4b', '#5b2a4e', '#2b2f36'],
    font: 'source-sans-3',
    align: 'left',
    toAccents: ['#14365a', '#0b5d4b', '#5b2a4e', '#2b2f36', '#0d5463'],
    toFont: 'inter',
    toAlign: 'left',
    toColumns: [1, 2],
  },
  manset: { ...DERGI, toAccents: [...DERGI.toAccents], toColumns: [1, 2], accents: ['#c2410c', '#b91c1c', '#1d4ed8'], font: 'archivo', align: 'left' },
  gece: {
    to: 'yonetici',
    accents: ['#d4a85a', '#e2b866', '#e8b4a0', '#f6e36b'],
    font: 'inter',
    align: 'left',
    toAccents: ['#1a1a1a', '#1b2f4b', '#6e1f2b', '#234a3d'],
    toFont: 'literata',
    toAlign: 'left',
    toColumns: [1],
    resetBase: true,
  },
  isvicre: {
    to: 'isvicre',
    accents: ['#d62828', '#1f4fd1', '#161616'],
    font: 'ibm-plex-sans',
    align: 'left',
    toAccents: ['#c62828', '#1f4fd1', '#161616', '#1f6b4f'],
    toFont: 'ibm-plex-sans',
    toAlign: 'left',
    toColumns: [1],
  },
  cizelge: {
    to: 'cizelge',
    accents: ['#e0663a', '#0f766e', '#4f46e5'],
    font: 'manrope',
    align: 'left',
    toAccents: ['#3b5b7a', '#4a4f57', '#2f5d50', '#7a2e2e'],
    toFont: 'archivo',
    toAlign: 'left',
    toColumns: [1],
  },
  cift: { ...PANEL, toAccents: [...PANEL.toAccents], toColumns: [2], accents: ['#ffcf70', '#f2c46d', '#ffd9a8'], font: 'space-grotesk', align: 'left', resetBase: true },
  afis: {
    to: 'blok',
    accents: ['#ffd400', '#b6f36b', '#ff8a7a', '#ffffff'],
    font: 'archivo',
    align: 'left',
    toAccents: ['#ffd84d', '#e9dfcf', '#d3e4f0', '#d3e9da', '#ffffff'],
    toFont: 'archivo',
    toAlign: 'left',
    toColumns: [1, 2],
  },
  cerceve: { ...DERGI, toAccents: [...DERGI.toAccents], toColumns: [1, 2], accents: ['#8c2f39', '#2f5d50', '#1f3a5f', '#b7791f'], font: 'source-sans-3', align: 'left' },
}

/**
 * 2 → 3 (14 şablonluk set, docs/sablonlar/SET-14.md §2.4): Manşet, Çerçeve → Dergi; Gece → Yönetici;
 * Çift Ton → Panel; Afiş → Blok. Zarif, Panel, Bant, İsviçre, Çizelge aynı kimlikte kalır ama tasarımları
 * ve renk takımları değişti; kural hepsinde aynı (şablon değiştirme kuralı):
 * - Renk: eski şablonun hazır takımlarından biri seçiliyse yeni şablonun varsayılan vurgusu (o renk yeni
 *   şablonda da hazır takımsa aynen kalır); özel renk aynen kalır. Hazır takımdan gelen zemin rengi
 *   sıfırlanır (null = şablonun varsayılan zemini); Gece ve Çift Ton'da zemin her durumda sıfırlanır.
 * - Yazı tipi ve başlık hizası: eski şablonun varsayılanındaysa yeni şablonun varsayılanı; değilse kalır.
 * - Sütun: destekleniyorsa kalır, değilse yeni şablonun varsayılanı. İki sütuna geçip yan sütun listesi
 *   boşsa beceri/dil/sertifika… bölümleriyle dolar.
 * - İçerik, fotoğraf, `sideSections` (doluysa) dokunulmaz.
 * Bilinmeyen kimlik olduğu gibi kalır (çizimde varsayılan şablona düşer).
 */
function migrate2to3(cv: RawCv): RawCv {
  const template = { ...((cv.template as Record<string, unknown> | undefined) ?? {}) }
  const old = typeof cv.templateId === 'string' ? V2_TEMPLATES[cv.templateId] : undefined
  let templateId = cv.templateId
  if (old) {
    templateId = old.to
    const accent = typeof template.accentColor === 'string' ? template.accentColor.toLowerCase() : null
    const preset = accent !== null && old.accents.includes(accent)
    if (preset) {
      template.accentColor = old.toAccents.includes(accent) ? accent : old.toAccents[0]
      template.baseColor = null
    }
    if (old.resetBase) template.baseColor = null
    if (template.font === old.font) template.font = old.toFont
    if (template.headerAlign === old.align) template.headerAlign = old.toAlign
    if (!old.toColumns.includes(template.columns as 1 | 2)) template.columns = old.toColumns[0]
    const sections = Array.isArray(cv.sections) ? (cv.sections as { id?: unknown; type?: unknown }[]) : []
    if (template.columns === 2 && Array.isArray(template.sideSections) && template.sideSections.length === 0) {
      template.sideSections = sections.filter((s) => V1_SIDE_TYPES.includes(String(s.type))).map((s) => s.id)
    }
  }
  return { ...cv, schemaVersion: 3, templateId, template }
}

/**
 * Eski şema sürümündeki CV'yi bugünkü sürüme taşır. Her sürüm artışında
 * buraya bir adım eklenir: MIGRATIONS[n] n → n+1 dönüşümüdür.
 */
const MIGRATIONS: Record<number, (cv: RawCv) => RawCv> = {
  1: migrate1to2,
  2: migrate2to3,
}

/**
 * Göç adımlarını doğrulamadan uygular (IndexedDB yükseltmesi bunu kullanır; okurken
 * migrateCv yine doğrular). Daha yeni ya da bilinmeyen sürümde hata verir.
 */
export function upgradeRawCv(raw: unknown): RawCv {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CvReadError(m.cv_err_unreadable())
  let data = raw as RawCv
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new CvReadError(m.cv_err_newer())
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new CvReadError(m.cv_err_schema({ version }))
    data = step(data)
    version += 1
  }
  return data
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/** Geçerli tarih ISO biçimine getirilir (sıralama ve karşılaştırma metin üzerinden yapılır); geçersizse `fallback`. */
function repairDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value === '') return fallback
  if (ISO_DATE_TIME.test(value) && Number.isFinite(Date.parse(value))) return value
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * İçeriği kurtarılabilir kusurları onarır; CV'yi reddetmek yerine düzeltir (yedekten geri yükleme,
 * başka sürümden kalan kayıt, elle düzenlenmiş dosya):
 * - `createdAt` / `updatedAt` geçerli tarih değilse şimdiki zaman (geçersiz tarih liste ekranını çökertir).
 * - Fotoğraf gömülü görsel (güvenli data URL) değilse null: uzak adres her açılışta dışarıya istek attırır.
 * - Aynı `id` iki bölümde ya da iki kayıtta varsa ikincisi yeni id alır (`translationGroupId` korunur;
 *   çeviri bağı kopmaz). Aynı id'li kayıtlar sıralamayı, kaydırmayı ve öneri hedefini bozar.
 */
export function repairRawCv(cv: RawCv, now = new Date().toISOString()): RawCv {
  const out: RawCv = { ...cv }
  out.updatedAt = repairDate(cv.updatedAt, now)
  out.createdAt = repairDate(cv.createdAt, out.updatedAt as string)

  if (isRecord(cv.personal) && cv.personal.photo != null && !isSafePhoto(cv.personal.photo)) {
    out.personal = { ...cv.personal, photo: null }
  }

  if (Array.isArray(cv.sections)) {
    const template = isRecord(cv.template) ? { ...cv.template } : null
    const side = template && Array.isArray(template.sideSections) ? [...(template.sideSections as unknown[])] : null
    const sectionIds = new Set<unknown>()
    const itemIds = new Set<unknown>()
    let changed = false
    const sections = cv.sections.map((section: unknown) => {
      if (!isRecord(section)) return section
      let next = section
      if (typeof section.id === 'string' && sectionIds.has(section.id)) {
        const id = newId()
        // Yan sütundaysa kopyası da yan sütunda kalır (görünüm değişmesin).
        if (side?.includes(section.id)) side.push(id)
        next = { ...next, id }
        changed = true
      }
      sectionIds.add(next.id)
      if (Array.isArray(section.items)) {
        let itemsChanged = false
        const items = section.items.map((item: unknown) => {
          if (!isRecord(item)) return item
          if (typeof item.id === 'string' && itemIds.has(item.id)) {
            itemsChanged = true
            const fresh = { ...item, id: newId() }
            itemIds.add(fresh.id)
            return fresh
          }
          itemIds.add(item.id)
          return item
        })
        if (itemsChanged) {
          next = { ...next, items }
          changed = true
        }
      }
      return next
    })
    if (changed) {
      out.sections = sections
      if (template && side) out.template = { ...template, sideSections: side }
    }
  }
  return out
}

export function migrateCv(raw: unknown): Cv {
  return CvSchema.parse(repairRawCv(upgradeRawCv(raw)))
}

/** Okuma hatasının arayüz dilinde kısa açıklaması (ham doğrulama çıktısı kullanıcıya gösterilmez). */
export function describeCvError(error: unknown): string {
  if (error instanceof CvReadError) return error.message
  if (error instanceof z.ZodError) {
    const path = error.issues[0]?.path ?? []
    const where = describePath(path)
    return where ? m.cv_err_invalid_at({ where }) : m.cv_err_invalid()
  }
  return m.cv_err_unreadable()
}

function describePath(path: readonly PropertyKey[]): string | null {
  const [head, index, sub, subIndex] = path
  if (head === 'personal') return m.editor_personal_title()
  if (head === 'template' || head === 'templateId') return m.tab_appearance()
  if (head === 'sections' && typeof index === 'number') {
    return sub === 'items' && typeof subIndex === 'number'
      ? m.cv_err_where_item({ section: index + 1, item: subIndex + 1 })
      : m.cv_err_where_section({ section: index + 1 })
  }
  return null
}

export const BACKUP_FORMAT_VERSION = 1

const BackupSchema = z.object({
  app: z.literal('cveditor'),
  kind: z.literal('backup'),
  formatVersion: z.number().int(),
  exportedAt: z.string(),
  cvs: z.array(z.unknown()),
})

export interface Backup {
  app: 'cveditor'
  kind: 'backup'
  formatVersion: number
  exportedAt: string
  cvs: Cv[]
}

export function createBackup(cvs: Cv[]): Backup {
  return {
    app: 'cveditor',
    kind: 'backup',
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    cvs,
  }
}

export interface ParsedBackup {
  cvs: Cv[]
  /** Okunamayan CV'lerin sıra numarası ve nedeni */
  failures: { index: number; name: string; reason: string }[]
}

export function parseBackup(text: string): ParsedBackup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new CvReadError(m.backup_err_json())
  }
  const parsed = BackupSchema.safeParse(json)
  if (!parsed.success) throw new CvReadError(m.backup_err_format())
  if (parsed.data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new CvReadError(m.backup_err_newer())
  }
  const result: ParsedBackup = { cvs: [], failures: [] }
  parsed.data.cvs.forEach((raw, index) => {
    try {
      result.cvs.push(migrateCv(raw))
    } catch (error) {
      const name =
        raw && typeof raw === 'object' && typeof (raw as { name?: unknown }).name === 'string'
          ? (raw as { name: string }).name
          : `#${index + 1}`
      console.error(error)
      result.failures.push({ index, name, reason: describeCvError(error) })
    }
  })
  return result
}
