import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Oturum çerezinin adı ve yolu (yalnız /api/ai isteklerinde gider). */
export const SESSION_COOKIE = 'cv_ai'
export const SESSION_PATH = '/api/ai'

/**
 * Sabit zamanlı parola karşılaştırması: iki değer önce aynı uzunlukta özetlere çevrilir
 * (uzunluk farkı da sızmasın).
 */
export function passwordMatches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/** Çerez değeri: `<bitiş ms>.<rastgele kimlik>.<HMAC>`; kimlik istek sınırının anahtarıdır. */
export function createSession(secret: string, ttlMs: number, now = Date.now()): { value: string; id: string; expires: Date } {
  const id = randomBytes(18).toString('base64url')
  const exp = now + ttlMs
  const payload = `${exp}.${id}`
  return { value: `${payload}.${sign(payload, secret)}`, id, expires: new Date(exp) }
}

/** Geçerli imzalı ve süresi dolmamış oturumun kimliği; değilse null. */
export function verifySession(value: string | undefined, secret: string, now = Date.now()): string | null {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [exp, id, mac] = parts
  const expected = Buffer.from(sign(`${exp}.${id}`, secret))
  const given = Buffer.from(mac)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const expires = Number(exp)
  if (!Number.isFinite(expires) || expires <= now) return null
  return id
}
