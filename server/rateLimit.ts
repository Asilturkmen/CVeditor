import type { Context } from 'hono'

/**
 * Bellekte, sabit pencereli sayaç (tek süreç için yeterli; sunucu yeniden başlayınca sıfırlanır).
 * `hit` izin verildiyse null, sınır aşıldıysa kaç saniye sonra yeniden denenebileceğini döner.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>()
  private lastSweep = 0

  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }

  hit(key: string): number | null {
    const now = this.now()
    this.sweep(now)
    const current = this.windows.get(key)
    if (!current || now - current.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 })
      return null
    }
    if (current.count >= this.limit) return Math.max(1, Math.ceil((current.start + this.windowMs - now) / 1000))
    current.count++
    return null
  }

  /** Başarılı girişten sonra deneme sayacını sıfırlamak için */
  reset(key: string): void {
    this.windows.delete(key)
  }

  private sweep(now: number) {
    if (now - this.lastSweep < this.windowMs) return
    this.lastSweep = now
    for (const [key, value] of this.windows) if (now - value.start >= this.windowMs) this.windows.delete(key)
  }
}

interface NodeBindings {
  incoming?: { socket?: { remoteAddress?: string } }
}

/**
 * İstemcinin adresi. Ters vekil arkasında (TRUST_PROXY=1) vekilin eklediği son X-Forwarded-For
 * öğesi; değilse soketin adresi. Başlık güvenilmeyen istemciden geliyorsa ilk öğeler uydurulabilir,
 * son öğeyi vekilin kendisi ekler.
 */
export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')
    const last = forwarded?.split(',').at(-1)?.trim()
    if (last) return last
  }
  const env = c.env as NodeBindings | undefined
  return env?.incoming?.socket?.remoteAddress ?? 'unknown'
}

/** 429 yanıtı (Retry-After saniye) */
export function tooMany(c: Context, retryAfter: number) {
  c.header('Retry-After', String(retryAfter))
  return c.json({ error: 'rate_limited' }, 429)
}
