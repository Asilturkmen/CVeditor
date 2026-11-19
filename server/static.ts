import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import type { MiddlewareHandler } from 'hono'

/** Sunulan dosya türleri (bilinmeyen uzantı application/octet-stream). */
export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
}

/**
 * Önbellek: `assets/` adları içerik özeti taşır (bir yıl, değişmez); yazı tiplerinin adı sabit
 * (bir ay); index.html her açılışta yeniden doğrulanır (yeni sürüm hemen görünsün).
 */
export function cacheControl(path: string): string {
  if (path.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  if (path.startsWith('/fonts/')) return 'public, max-age=2592000'
  if (path.endsWith('.html') || path === '/') return 'no-cache'
  return 'public, max-age=3600'
}

/**
 * `dist/` statik dosyaları + SPA geri dönüşü: uzantısız bir yol (ör. /cvler/abc) bulunamazsa
 * index.html döner (istemci yönlendiricisi açar). Uzantılı ama olmayan dosya 404 olur.
 */
export function serveStatic(root: string): MiddlewareHandler {
  const indexPath = join(root, 'index.html')
  const index = existsSync(indexPath) ? readFileSync(indexPath) : null

  const sendIndex = (method: string) =>
    new Response(method === 'HEAD' ? null : new Uint8Array(index!), {
      headers: { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache', 'Content-Length': String(index!.length) },
    })

  return async (c, next) => {
    const method = c.req.method
    if ((method !== 'GET' && method !== 'HEAD') || c.req.path.startsWith('/api/')) return next()
    let path: string
    try {
      path = decodeURIComponent(c.req.path)
    } catch {
      return c.text('Bad Request', 400)
    }
    if (path.includes('\0')) return c.text('Bad Request', 400)
    const file = normalize(join(root, path))
    if (file !== root && !file.startsWith(root.endsWith(sep) ? root : root + sep)) return c.text('Not Found', 404)

    if (path !== '/' && path !== '/index.html') {
      const info = await stat(file).catch(() => null)
      if (info?.isFile()) {
        const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`
        const headers = new Headers({
          'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': cacheControl(path),
          'Last-Modified': info.mtime.toUTCString(),
          ETag: etag,
        })
        if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers })
        headers.set('Content-Length', String(info.size))
        if (method === 'HEAD') return new Response(null, { headers })
        return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers })
      }
      if (extname(path)) return next()
    }
    if (!index) return next()
    return sendIndex(method)
  }
}
