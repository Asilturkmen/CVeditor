import Dexie from 'dexie'
import { describe, expect, it, vi } from 'vitest'
import { CvDatabase, watchVersionChange, type DbVersionEvent } from './db'

describe('veritabanı sürüm değişimi', () => {
  it('başka sekme daha yeni sürümle açınca bağlantı kapanır, kullanıcıya haber verilir, yükseltme beklemez', async () => {
    const name = `versionchange-test-${Math.random().toString(36).slice(2)}`
    const current = new CvDatabase(name)
    const events: DbVersionEvent[] = []
    watchVersionChange(current, (event) => events.push(event))
    await current.open()
    expect(current.isOpen()).toBe(true)

    // "Yeni kod": aynı veritabanı bir üst sürümle
    const newer = new Dexie(name)
    newer.version(2).stores({ cvs: 'id, updatedAt, name, language', meta: 'key' })
    newer.version(3).stores({ cvs: 'id, updatedAt, name, language', meta: 'key' })
    const blocked = vi.fn()
    newer.on('blocked', blocked)
    await newer.open()

    expect(events).toEqual(['versionchange'])
    expect(current.isOpen()).toBe(false)
    expect(blocked).not.toHaveBeenCalled()
    expect(newer.verno).toBe(3)
    // Eski bağlantı kendiliğinden yeniden açılıp eski şemayla yazmaz: kayıt hata verir.
    await expect(current.cvs.count()).rejects.toThrow()

    newer.close()
    await Dexie.delete(name)
  })
})
