import { z } from 'zod'
import { CURRENT_SCHEMA_VERSION, CvSchema, type Cv } from './schema'

/**
 * Eski şema sürümündeki CV'yi bugünkü sürüme taşır. Her sürüm artışında
 * buraya bir adım eklenir: MIGRATIONS[n] n → n+1 dönüşümüdür.
 */
const MIGRATIONS: Record<number, (cv: Record<string, unknown>) => Record<string, unknown>> = {}

export function migrateCv(raw: unknown): Cv {
  if (!raw || typeof raw !== 'object') throw new Error('CV verisi okunamadı')
  let data = raw as Record<string, unknown>
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error('Bu CV daha yeni bir CVeditör sürümüyle kaydedilmiş')
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(`Şema sürümü ${version} desteklenmiyor`)
    data = step(data)
    version += 1
  }
  return CvSchema.parse(data)
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
    throw new Error('Dosya geçerli bir JSON değil')
  }
  const parsed = BackupSchema.safeParse(json)
  if (!parsed.success) throw new Error('Bu dosya bir CVeditör yedeği değil')
  if (parsed.data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('Yedek daha yeni bir CVeditör sürümüyle alınmış')
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
