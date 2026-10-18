import Dexie, { type EntityTable } from 'dexie'
import { upgradeRawCv } from '@/cv/migrate'
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
    // Şema 2 (10 şablon): Klasik → Zarif, Modern → Panel, template.baseColor. Dizinler aynı;
    // kayıtlar yerinde yükseltilir. Okunamayan kayıt olduğu gibi kalır (açılınca migrateCv hata gösterir).
    this.version(2)
      .stores({
        cvs: 'id, updatedAt, name, language',
        meta: 'key',
      })
      .upgrade((tx) =>
        tx
          .table('cvs')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            if (row.schemaVersion !== 1) return
            try {
              Object.assign(row, upgradeRawCv(structuredClone(row)))
            } catch {
              // bozuk kayıt: dokunma
            }
          }),
      )
  }
}

/** Veritabanını başka bir sekme yükseltmek istediğinde (`versionchange`) ya da yükseltme bu sekmeyi beklediğinde (`blocked`). */
export type DbVersionEvent = 'versionchange' | 'blocked'

/**
 * Sürüm değişimini izler. Daha yeni kodla açılan bir sekme veritabanını yükseltmek isteyince bu
 * sekmedeki bağlantı kapatılır (yükseltme beklemesin) ve kullanıcıya haber verilir: eski kod yeni
 * şemaya yazamaz, kayıtlar sessizce kaybolmasın diye sayfa yenilenmeli. Kapalı bağlantı kendiliğinden
 * yeniden açılmaz; sonraki kayıt denemesi hata verir (kaydetme göstergesi "Kaydedilemedi").
 */
export function watchVersionChange(database: Dexie, notify: (event: DbVersionEvent) => void) {
  database.on('versionchange', () => {
    database.close()
    notify('versionchange')
    return false
  })
  database.on('blocked', () => notify('blocked'))
}

export const db = new CvDatabase()
