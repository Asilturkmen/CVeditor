import { describe, expect, it, vi } from 'vitest'
import { enqueueToast, isStickyToast, MAX_TOASTS, toastDuration, type Toast } from '@/components/ui/toast'
import { todayStamp } from './download'
import { isBenignRejection, watchUnhandledRejections } from './errors'
import { foldForSearch, matchesSearch } from './search'
import { daysSince, formatDateTime, isValidDate, nextTimestamp, relativeTime } from './time'

describe('tarih biçimleme', () => {
  it('geçersiz tarihte asla hata fırlatmaz (liste ekranı çökmez)', () => {
    for (const bad of ['', 'dün', 'not-a-date', '2024-13-45', undefined, null, 5, {}] as unknown[]) {
      expect(() => formatDateTime(bad as string), String(bad)).not.toThrow()
      expect(formatDateTime(bad as string)).toBe('')
      expect(() => relativeTime(bad as string)).not.toThrow()
      expect(relativeTime(bad as string)).toBe('')
      expect(daysSince(bad as string)).toBeNull()
      expect(isValidDate(bad)).toBe(false)
    }
    expect(formatDateTime('2024-03-05T10:00:00.000Z')).not.toBe('')
    expect(daysSince('2024-03-05T10:00:00.000Z', Date.parse('2024-03-08T10:00:00.000Z'))).toBe(3)
  })

  it('yedek dosyasının tarihi yerel güne göredir (UTC değil)', () => {
    // Yerel saatle 5 Mart 00:30: UTC+3'te UTC hâlâ 4 Mart'tır; dosya adı 5 Mart olmalı.
    expect(todayStamp(new Date(2024, 2, 5, 0, 30))).toBe('2024-03-05')
    expect(todayStamp(new Date(2024, 11, 31, 23, 59))).toBe('2024-12-31')
    expect(todayStamp(new Date(2025, 0, 1, 0, 0))).toBe('2025-01-01')
  })

  it('sürüm zamanı hep ilerler; bozuk ya da çok ilerideki öncekine takılmaz', () => {
    const now = Date.parse('2024-03-05T10:00:00.000Z')
    expect(nextTimestamp(undefined, now)).toBe('2024-03-05T10:00:00.000Z')
    expect(nextTimestamp('2024-03-05T09:00:00.000Z', now)).toBe('2024-03-05T10:00:00.000Z')
    // Aynı milisaniyede ikinci değişiklik
    expect(nextTimestamp('2024-03-05T10:00:00.000Z', now)).toBe('2024-03-05T10:00:00.001Z')
    expect(nextTimestamp('2024-03-05T10:00:00.007Z', now)).toBe('2024-03-05T10:00:00.008Z')
    for (const bad of ['bozuk', '', '9999-12-31T23:59:59.999Z', '+275760-09-13T00:00:00.000Z']) {
      expect(() => nextTimestamp(bad, now), bad).not.toThrow()
      expect(nextTimestamp(bad, now)).toBe('2024-03-05T10:00:00.000Z')
    }
  })
})

describe('arama', () => {
  it('I/İ/ı/i tek harftir: Türkçe ve İngilizce adlar birlikte bulunur', () => {
    expect(matchesSearch('IT Manager', 'it')).toBe(true)
    expect(matchesSearch('IT Manager', 'ıt')).toBe(true)
    expect(matchesSearch('IT Manager', 'İT')).toBe(true)
    expect(matchesSearch('İstanbul Ofisi', 'istanbul')).toBe(true)
    expect(matchesSearch('İstanbul Ofisi', 'ISTANBUL')).toBe(true)
    expect(matchesSearch('Işık Yılmaz', 'işik yilmaz')).toBe(true)
    expect(matchesSearch('Işık Yılmaz', 'IŞIK')).toBe(true)
    expect(matchesSearch('Ayşe Yılmaz', 'YILMAZ')).toBe(true)
    expect(matchesSearch('Ayşe Yılmaz', 'ayse')).toBe(false)
    expect(matchesSearch('Product Designer', 'DESIGN')).toBe(true)
    expect(matchesSearch('Genel TR', '  genel  ')).toBe(true)
    expect(matchesSearch('Genel TR', '')).toBe(true)
    expect(matchesSearch('Genel TR', 'özel')).toBe(false)
    // Diğer harfler katlanmaz: "o" ile "ö" ayrı kalır.
    expect(matchesSearch('Özgeçmiş', 'ozgecmis')).toBe(false)
    expect(foldForSearch('Iİıi')).toBe('iiii')
  })
})

describe('işlenmemiş hata yakalayıcısı', () => {
  const error = (name: string, message: string) => Object.assign(new Error(message), { name })

  it('iptal ve gizli sekmedeki görünüm geçişi reddi zararsızdır', () => {
    expect(isBenignRejection(error('AbortError', 'The user aborted a request.'))).toBe(true)
    expect(isBenignRejection(error('InvalidStateError', 'Transition was aborted because of invalid state'))).toBe(true)
    expect(isBenignRejection(error('InvalidStateError', 'View transition was skipped because document visibility state is hidden.'))).toBe(true)
    expect(isBenignRejection(error('InvalidStateError', 'The database connection is closing.'))).toBe(false)
    expect(isBenignRejection(error('QuotaExceededError', 'full'))).toBe(false)
    expect(isBenignRejection(new Error('x'))).toBe(false)
    expect(isBenignRejection('dizgi')).toBe(false)
    expect(isBenignRejection(undefined)).toBe(false)
  })

  it('gerçek hatada kullanıcıya haber verir; zararsız reddi yutar; art arda hatada bildirim yağdırmaz', () => {
    const listeners: ((event: PromiseRejectionEvent) => void)[] = []
    const target = { addEventListener: (_: string, fn: (event: PromiseRejectionEvent) => void) => listeners.push(fn) }
    const notify = vi.fn()
    watchUnhandledRejections(notify, target as unknown as Window)
    const fire = (reason: unknown) => {
      const event = { reason, preventDefault: vi.fn() }
      listeners[0](event as unknown as PromiseRejectionEvent)
      return event
    }
    const benign = fire(error('InvalidStateError', 'Transition was aborted because of invalid state'))
    expect(benign.preventDefault).toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()

    const real = fire(new Error('veritabanı kapalı'))
    expect(real.preventDefault).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
    fire(new Error('bir daha'))
    fire(new Error('bir daha'))
    expect(notify).toHaveBeenCalledTimes(1)
  })
})

describe('bildirim kuyruğu', () => {
  const plain = (id: number): Toast => ({ id, message: `düz ${id}` })
  const undo = (id: number): Toast => ({ id, message: `silindi ${id}`, action: { label: 'Geri al', run: () => {} } })
  const forever = (id: number): Toast => ({ id, message: 'yenile', duration: Infinity })
  const push = (list: Toast[]) => list.reduce<Toast[]>((queue, next) => enqueueToast(queue, next), [])

  it('taşınca en eski düz bildirim düşer', () => {
    expect(push([plain(1), plain(2), plain(3), plain(4)]).map((t) => t.id)).toEqual([2, 3, 4])
    expect(push([plain(1), plain(2), plain(3), plain(4), plain(5)])).toHaveLength(MAX_TOASTS)
  })

  it('eylemli ("Geri al") ve süresiz bildirim kuyruk taşsa da düşmez', () => {
    const ids = push([undo(1), forever(2), plain(3), plain(4), plain(5), plain(6)]).map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining([1, 2, 6]))
    expect(ids).not.toContain(3)
    // Yalnız düşürülemeyenler varsa sınır aşılır ama hiçbiri kaybolmaz.
    const many = push([undo(1), undo(2), undo(3), undo(4), undo(5)])
    expect(many.map((t) => t.id)).toEqual([1, 2, 3, 4, 5])
    // Yeni gelen bildirim kendisi düşürülmez.
    expect(push([undo(1), undo(2), undo(3), plain(4)]).map((t) => t.id)).toEqual([1, 2, 3, 4])
  })

  it('eylemli bildirim daha uzun kalır; süresiz olan kapanmaz', () => {
    expect(isStickyToast(plain(1))).toBe(false)
    expect(isStickyToast(undo(1))).toBe(true)
    expect(isStickyToast(forever(1))).toBe(true)
    expect(toastDuration(undo(1))).toBeGreaterThan(toastDuration(plain(1)))
    expect(toastDuration(forever(1))).toBe(Infinity)
    expect(toastDuration({ duration: 1200 })).toBe(1200)
  })
})
