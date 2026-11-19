import { createHash } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'

/**
 * `index.html`'deki satır içi betiklerin (tema ve vurgu rengini ilk boyamadan önce uygulayan
 * küçük betik) CSP özetleri. Betik değişince yeniden derlenen dosyadan yeniden hesaplanır;
 * `'unsafe-inline'` gerekmez.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(match[1] ?? '')) continue
    hashes.push(`'sha256-${createHash('sha256').update(match[2], 'utf8').digest('base64')}'`)
  }
  return hashes
}

/**
 * İçerik güvenliği ilkesi. Notlar:
 * - style-src 'unsafe-inline': CV önizlemesi betiksiz (sandbox) bir srcdoc iframe'idir; stiller
 *   orada <style> öğesiyle yazılır ve iframe üst belgenin ilkesini devralır.
 * - img-src data: blob:: CV fotoğrafı data: adresidir; içe aktarılan PDF'in önizlemesi blob: olabilir.
 * - worker-src 'self' blob:: pdf.js işçisi (içe aktarma ve İnceleme) kendi kökümüzden yüklenir.
 */
export function contentSecurityPolicy(scriptHashes: string[] = []): string {
  return [
    "default-src 'self'",
    `script-src 'self'${scriptHashes.map((h) => ` ${h}`).join('')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Bütün yanıtlara güvenlik başlıkları (HSTS ters vekilde: deploy/Caddyfile). */
export function securityHeaders(getCsp: () => string): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const h = c.res.headers
    h.set('Content-Security-Policy', getCsp())
    h.set('X-Content-Type-Options', 'nosniff')
    h.set('Referrer-Policy', 'no-referrer')
    h.set('X-Frame-Options', 'SAMEORIGIN')
    h.set('Cross-Origin-Opener-Policy', 'same-origin')
    h.set('Cross-Origin-Resource-Policy', 'same-origin')
    h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    if (c.req.path.startsWith('/api/')) h.set('Cache-Control', h.get('Cache-Control') ?? 'no-store')
  }
}

/**
 * İsteğin Origin'i sitenin kendisi mi? `PUBLIC_ORIGIN` verildiyse onunla, yoksa isteğin Host'u
 * ile karşılaştırılır (şema dikkate alınmaz: TLS ters vekilde biter).
 */
export function sameOrigin(c: Context, publicOrigin: string | null): boolean | null {
  const origin = c.req.header('origin')
  if (!origin) return null
  if (origin === 'null') return false
  if (publicOrigin) return origin === publicOrigin
  try {
    return new URL(origin).host === c.req.header('host')
  } catch {
    return false
  }
}

/**
 * Başka sitelerden gelen istekleri keser. `required`: Origin başlığı hiç yoksa da reddedilir
 * (tarayıcılar POST fetch'inde Origin'i her zaman gönderir; yapay zekâ uçları için).
 */
export function originGuard(publicOrigin: string | null, required: boolean): MiddlewareHandler {
  return async (c, next) => {
    const same = sameOrigin(c, publicOrigin)
    if (same === false || (same === null && required)) return c.json({ error: 'forbidden_origin' }, 403)
    await next()
  }
}
