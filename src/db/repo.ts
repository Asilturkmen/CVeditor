import { duplicateCv } from '@/cv/factory'
import type { Cv } from '@/cv/schema'
import { db } from './db'

export async function getCv(id: string): Promise<Cv | undefined> {
  return db.cvs.get(id)
}

export async function saveCv(cv: Cv): Promise<void> {
  await db.cvs.put(cv)
}

export async function deleteCv(id: string): Promise<Cv | undefined> {
  const existing = await db.cvs.get(id)
  await db.cvs.delete(id)
  return existing
}

export async function countCvs(): Promise<number> {
  return db.cvs.count()
}

export async function allCvs(): Promise<Cv[]> {
  return db.cvs.orderBy('updatedAt').reverse().toArray()
}

/**
 * Yedekten gelen CV'leri ekler. Aynı id'li CV varsa:
 * - "replace": yedektekiyle değiştirilir
 * - "keepBoth": yedekteki yeni id'yle kopya olarak eklenir
 */
export async function importCvs(cvs: Cv[], mode: 'replace' | 'keepBoth'): Promise<{ added: number; replaced: number }> {
  let added = 0
  let replaced = 0
  await db.transaction('rw', db.cvs, async () => {
    for (const cv of cvs) {
      const exists = await db.cvs.get(cv.id)
      if (!exists) {
        await db.cvs.add(cv)
        added++
      } else if (mode === 'replace') {
        await db.cvs.put(cv)
        replaced++
      } else {
        const copy = duplicateCv(cv, { name: cv.name })
        copy.updatedAt = cv.updatedAt
        await db.cvs.add(copy)
        added++
      }
    }
  })
  return { added, replaced }
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.cvs, db.meta, async () => {
    await db.cvs.clear()
    await db.meta.clear()
  })
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export const META_LAST_BACKUP = 'lastBackupAt'
