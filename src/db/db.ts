import Dexie, { type EntityTable } from 'dexie'
import type { Cv } from '@/cv/schema'

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * Tarayıcıdaki veritabanı (IndexedDB). Sunucu yok; CV verisi yalnız bu
 * tarayıcıda ve bu adreste (port dahil) durur. Yedek/taşıma JSON ile.
 *
 * Şema değişikliği: yeni `this.version(n)` ekle, eskisini silme.
 */
export class CvDatabase extends Dexie {
  cvs!: EntityTable<Cv, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'cveditor') {
    super(name)
    this.version(1).stores({
      cvs: 'id, updatedAt, name, language',
      meta: 'key',
    })
  }
}

export const db = new CvDatabase()
