import { z } from 'zod'
import { m } from '@/paraglide/messages'
import { CURRENT_SCHEMA_VERSION, CvSchema, type Cv } from './schema'

type RawCv = Record<string, unknown>

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
 * Eski şema sürümündeki CV'yi bugünkü sürüme taşır. Her sürüm artışında
 * buraya bir adım eklenir: MIGRATIONS[n] n → n+1 dönüşümüdür.
 */
const MIGRATIONS: Record<number, (cv: RawCv) => RawCv> = {
  1: migrate1to2,
}

/**
 * Göç adımlarını doğrulamadan uygular (IndexedDB yükseltmesi bunu kullanır; okurken
 * migrateCv yine doğrular). Daha yeni ya da bilinmeyen sürümde hata verir.
 */
export function upgradeRawCv(raw: unknown): RawCv {
  if (!raw || typeof raw !== 'object') throw new Error(m.cv_err_unreadable())
  let data = raw as RawCv
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(m.cv_err_newer())
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(m.cv_err_schema({ version }))
    data = step(data)
    version += 1
  }
  return data
}

export function migrateCv(raw: unknown): Cv {
  return CvSchema.parse(upgradeRawCv(raw))
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
    throw new Error(m.backup_err_json())
  }
  const parsed = BackupSchema.safeParse(json)
  if (!parsed.success) throw new Error(m.backup_err_format())
  if (parsed.data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(m.backup_err_newer())
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
      result.failures.push({ index, name, reason: error instanceof Error ? error.message : String(error) })
    }
  })
  return result
}
