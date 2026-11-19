import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { EditPayload } from '@/ai/types'
import { createApp } from './app'
import { DailyBudget } from './ai/budget'
import type { AiOutcome } from './ai/provider'
import { createSession, passwordMatches, verifySession } from './ai/session'
import { SharedBrowser } from './pdf/browser'
import { asciiFileName, contentDisposition, pdfFileName } from './pdf/filename'
import { BusyError, JobQueue, JobTimeoutError } from './pdf/queue'
import { allowedRenderPath, RENDER_ORIGIN } from './pdf/render'
import { RateLimiter } from './rateLimit'
import { inlineScriptHashes } from './security'
import { fakeDist, jsonPost, testConfig } from './testUtils'

/** Chromium'u açmayan testler: tarayıcı istenirse test düşer. */
const noBrowser = () => new SharedBrowser(() => Promise.reject(new Error('bu testte tarayıcı açılmamalı')))

describe('statik dosyalar ve güvenlik başlıkları', () => {
  const dist = fakeDist()
  const { app } = createApp({ config: testConfig({ SERVE_STATIC: '1', STATIC_DIR: dist }), browser: noBrowser() })

  it('GET /api/health', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, pdf: true, browser: null })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('SPA geri dönüşü: uzantısız yol index.html döner, önbelleksiz', async () => {
    for (const path of ['/', '/cvler/abc', '/inceleme']) {
      const res = await app.request(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(res.headers.get('cache-control')).toBe('no-cache')
      expect(await res.text()).toContain('<script>var t=1</script>')
    }
  })

  it('özetli varlık bir yıl önbellekte; .mjs (pdf.js işçisi) JavaScript olarak', async () => {
    const js = await app.request('/assets/index-abc.js')
    expect(js.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(js.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await js.text()).toBe('console.log(1)')
    const worker = await app.request('/assets/pdf.worker.min-xyz.mjs')
    expect(worker.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    const font = await app.request('/fonts/a.woff2')
    expect(font.headers.get('content-type')).toBe('font/woff2')
    expect(font.headers.get('cache-control')).toBe('public, max-age=2592000')
    const etag = js.headers.get('etag')!
    const again = await app.request('/assets/index-abc.js', { headers: { 'If-None-Match': etag } })
    expect(again.status).toBe(304)
  })

  it('olmayan dosya 404 (index.html değil); kök dışına çıkılamaz', async () => {
    expect((await app.request('/assets/yok.js')).status).toBe(404)
    expect((await app.request('/api/yok')).status).toBe(404)
    for (const path of ['/..%2f..%2fpackage.json', '/%2e%2e/package.json', '/assets/..%5c..%5cpackage.json']) {
      const res = await app.request(path)
      expect(await res.text()).not.toContain('"name": "cveditor"')
    }
  })

  it('güvenlik başlıkları; CSP satır içi betiği özetiyle izinler, unsafe-inline betik yok', async () => {
    const res = await app.request('/')
    const csp = res.headers.get('content-security-policy')!
    const hash = createHash('sha256').update('var t=1').digest('base64')
    expect(csp).toContain(`script-src 'self' 'sha256-${hash}'`)
    for (const part of ["img-src 'self' data: blob:", "worker-src 'self' blob:", "connect-src 'self'", "frame-src 'self'", "frame-ancestors 'self'", "object-src 'none'"]) {
      expect(csp).toContain(part)
    }
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('satır içi betik özetleri: src taşıyanlar atlanır', () => {
    expect(inlineScriptHashes('<script src="/a.js"></script><script>x</script><script type="module">y</script>')).toHaveLength(2)
  })
})

describe('/api/pdf (tarayıcısız durumlar)', () => {
  const make = (env: Record<string, string> = {}) => createApp({ config: testConfig(env), browser: noBrowser() }).app

  it('bozuk JSON 400, geçersiz CV 400, güvensiz fotoğraf 400', async () => {
    const app = make()
    expect((await app.request('/api/pdf', jsonPost('{yarım'))).status).toBe(400)
    const invalid = await app.request('/api/pdf', jsonPost({ id: 1, sections: 'yok' }))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'invalid_cv' })
    const photo = await app.request('/api/pdf', jsonPost({ personal: { photo: 'https://example.com/a.png' } }))
    expect(await photo.json()).toEqual({ error: 'invalid_photo' })
  })

  it('büyük gövde 413', async () => {
    const app = make({ PDF_MAX_BODY_BYTES: '2048' })
    const res = await app.request('/api/pdf', jsonPost({ pad: 'x'.repeat(5000) }))
    expect(res.status).toBe(413)
  })

  it('başka kökenden 403', async () => {
    const res = await make().request('/api/pdf', jsonPost({}, { Origin: 'https://example.com' }))
    expect(res.status).toBe(403)
  })

  it('IP başına hız sınırı: 429 + Retry-After; başka IP etkilenmez', async () => {
    const app = make({ PDF_RATE_LIMIT_PER_MINUTE: '2' })
    expect((await app.request('/api/pdf', jsonPost('{'))).status).toBe(400)
    expect((await app.request('/api/pdf', jsonPost('{'))).status).toBe(400)
    const limited = await app.request('/api/pdf', jsonPost('{'))
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await app.request('/api/pdf', jsonPost('{', { 'X-Forwarded-For': '198.51.100.1' }))).status).toBe(400)
  })
})

describe('PDF yardımcıları', () => {
  it('dosya adı: CV adı, UTF-8 + ASCII yedek', () => {
    expect(pdfFileName('Yazılım / Öğrenci: TR')).toBe('Yazılım Öğrenci TR.pdf')
    expect(pdfFileName('  ')).toBe('CV.pdf')
    expect(asciiFileName('Yazılım Öğrenci TR.pdf')).toBe('Yazilim Ogrenci TR.pdf')
    expect(contentDisposition('Çağrı (EN).pdf')).toBe(`attachment; filename="Cagri (EN).pdf"; filename*=UTF-8''%C3%87a%C4%9Fr%C4%B1%20%28EN%29.pdf`)
  })

  it('çizim sayfasında yalnız iç kökün belgesi, betiği ve yazı tipleri karşılanır', () => {
    expect(allowedRenderPath(`${RENDER_ORIGIN}/`)).toBe('document')
    expect(allowedRenderPath(`${RENDER_ORIGIN}/draw.js`)).toBe('script')
    expect(allowedRenderPath(`${RENDER_ORIGIN}/fonts/inter-latin-400-normal.woff2`)).toEqual({ font: 'inter-latin-400-normal.woff2' })
    for (const url of [`${RENDER_ORIGIN}/fonts/../x.woff2`, `${RENDER_ORIGIN}/fonts/a.woff2?x=1`, 'https://example.com/fonts/a.woff2', `${RENDER_ORIGIN}/other`, 'data:text/html,x']) {
      expect(allowedRenderPath(url)).toBeNull()
    }
  })

  it('sıra: eşzamanlılık sınırı, dolu sıra BusyError, süre aşımı JobTimeoutError ve sinyal', async () => {
    const queue = new JobQueue(1, 1)
    let release!: () => void
    const first = queue.run(() => new Promise<string>((r) => (release = () => r('a'))), 5000)
    const second = queue.run(async () => 'b', 5000)
    await expect(queue.run(async () => 'c', 5000)).rejects.toBeInstanceOf(BusyError)
    expect(queue.stats).toEqual({ running: 1, waiting: 1 })
    release()
    expect(await first).toBe('a')
    expect(await second).toBe('b')
    let aborted = false
    await expect(
      queue.run((signal) => new Promise(() => signal.addEventListener('abort', () => (aborted = true))), 20),
    ).rejects.toBeInstanceOf(JobTimeoutError)
    expect(aborted).toBe(true)
    expect(queue.stats).toEqual({ running: 0, waiting: 0 })
  })

  it('hız sınırlayıcı pencere dolunca yeniden açılır', () => {
    let now = 0
    const limiter = new RateLimiter(2, 1000, () => now)
    expect(limiter.hit('a')).toBeNull()
    expect(limiter.hit('a')).toBeNull()
    expect(limiter.hit('a')).toBe(1)
    now = 1000
    expect(limiter.hit('a')).toBeNull()
  })
})

// ---------------------------------------------------------------- Yapay zekâ uçları

const AI_ENV = {
  AI_ENDPOINT_PASSWORD: 'deneme-parolasi',
  AI_SESSION_SECRET: 'x'.repeat(48),
  AI_DAILY_COST_CAP_USD: '1',
  AI_RATE_LIMIT_PER_MINUTE: '3',
}

const EDIT: EditPayload = {
  language: 'tr',
  prompt: 'Özeti kısalt',
  scope: { kind: 'all' },
  personal: {},
  sections: [{ id: 's1', type: 'summary', title: 'Özet', fields: [{ key: 'content', rich: true }], items: [{ id: 'i1', content: '<p>Uzun bir özet.</p>' }] }],
  placeholders: [],
}

function aiApp(env: Record<string, string> = {}, run?: () => Promise<AiOutcome>, now?: () => number) {
  return createApp({ config: testConfig({ ...AI_ENV, ...env }), browser: noBrowser(), runAi: run, now }).app
}

async function login(app: ReturnType<typeof aiApp>, ip = '203.0.113.7'): Promise<string> {
  const res = await app.request('/api/ai/auth', jsonPost({ password: AI_ENV.AI_ENDPOINT_PASSWORD }, { 'X-Forwarded-For': ip }))
  expect(res.status).toBe(204)
  return res.headers.get('set-cookie')!.split(';')[0]
}

describe('/api/ai iskeleti', () => {
  it('parola, sır ya da günlük tavan yoksa uçlar kapalı: 503 not_configured', async () => {
    const app = createApp({ config: testConfig(), browser: noBrowser() }).app
    for (const path of ['/api/ai/auth', '/api/ai/edit']) {
      const res = await app.request(path, jsonPost({ password: 'x' }))
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'not_configured' })
    }
  })

  it('auth: Origin şart; yanlış parola 401; doğru parola 204 + HttpOnly Secure SameSite=Strict Path=/api/ai çerez', async () => {
    const app = aiApp()
    const noOrigin = jsonPost({ password: 'x' })
    delete (noOrigin.headers as Record<string, string>).Origin
    expect((await app.request('/api/ai/auth', noOrigin)).status).toBe(403)
    expect((await app.request('/api/ai/auth', jsonPost({ password: 'yanlış' }))).status).toBe(401)
    expect((await app.request('/api/ai/auth', jsonPost({}))).status).toBe(400)
    const res = await app.request('/api/ai/auth', jsonPost({ password: AI_ENV.AI_ENDPOINT_PASSWORD }))
    expect(res.status).toBe(204)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toMatch(/^cv_ai=[^;]+;/)
    for (const attr of ['Path=/api/ai', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Expires=']) expect(cookie).toContain(attr)
  })

  it('parola deneme sınırı: 5 denemeden sonra 429', async () => {
    const app = aiApp()
    for (let i = 0; i < 5; i++) expect((await app.request('/api/ai/auth', jsonPost({ password: 'yanlış' }))).status).toBe(401)
    const res = await app.request('/api/ai/auth', jsonPost({ password: AI_ENV.AI_ENDPOINT_PASSWORD }))
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('çerezsiz ya da bozuk çerezle 401; geçerli çerezle şema denetimi (400) ve sağlayıcı (503 not_configured)', async () => {
    const app = aiApp()
    expect((await app.request('/api/ai/edit', jsonPost(EDIT))).status).toBe(401)
    const cookie = await login(app)
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: `${cookie}x` }))).status).toBe(401)
    const bad = await app.request('/api/ai/edit', jsonPost({ ...EDIT, prompt: '' }, { Cookie: cookie }))
    expect(bad.status).toBe(400)
    const res = await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'not_configured' })
  })

  it('sağlayıcı yanıtı yanıt şemasından geçer; uymayan yanıt 502', async () => {
    let result: unknown = { operations: [{ op: 'set', target: 'i1', field: 'content', value: '<p>Kısa.</p>' }], message: 'Kısalttım.' }
    const app = aiApp({}, async () => ({ ok: true, result, costUsd: 0.01 }))
    const cookie = await login(app)
    const ok = await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual(result)
    result = { operations: 'yok' }
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))).status).toBe(502)
  })

  it('istek sınırı 429 + Retry-After; günlük tavan dolunca 503 + Retry-After', async () => {
    const app = aiApp({}, async () => ({ ok: true, result: { operations: [] }, costUsd: 0.6 }))
    const cookie = await login(app)
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))).status).toBe(200)
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))).status).toBe(200)
    // 1.2 USD ≥ 1 USD tavan
    const capped = await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))
    expect(capped.status).toBe(503)
    expect(await capped.json()).toEqual({ error: 'daily_limit' })
    expect(Number(capped.headers.get('retry-after'))).toBeGreaterThan(0)
    const limited = await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))
    expect(limited.status).toBe(429)
  })

  it('başka kökenden gelen istek çerez olsa da 403; gövde sınırı 413', async () => {
    const app = aiApp({ AI_MAX_BODY_BYTES: '2048' })
    const cookie = await login(app)
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie, Origin: 'https://example.com' }))).status).toBe(403)
    const big = { ...EDIT, prompt: 'x'.repeat(4000) }
    expect((await app.request('/api/ai/edit', jsonPost(big, { Cookie: cookie }))).status).toBe(413)
  })

  it('süresi dolan oturum 401', async () => {
    let now = Date.parse('2026-11-19T10:00:00Z')
    const app = aiApp({ AI_SESSION_TTL_HOURS: '1' }, async () => ({ ok: true, result: { operations: [] }, costUsd: 0 }), () => now)
    const cookie = await login(app)
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))).status).toBe(200)
    now += 3_600_001
    expect((await app.request('/api/ai/edit', jsonPost(EDIT, { Cookie: cookie }))).status).toBe(401)
  })

  it('oturum imzası ve parola karşılaştırması', () => {
    const secret = 's'.repeat(40)
    const session = createSession(secret, 1000, 0)
    expect(verifySession(session.value, secret, 500)).toBe(session.id)
    expect(verifySession(session.value, secret, 1000)).toBeNull()
    expect(verifySession(session.value, 't'.repeat(40), 500)).toBeNull()
    expect(verifySession(session.value.replace(/^\d+/, '99999'), secret, 500)).toBeNull()
    expect(passwordMatches('abc', 'abc')).toBe(true)
    expect(passwordMatches('abc', 'abcd')).toBe(false)
  })

  it('günlük sayaç UTC gününde sıfırlanır', () => {
    let now = Date.parse('2026-11-19T23:59:00Z')
    const budget = new DailyBudget(1, () => now)
    budget.record(2)
    expect(budget.exhausted()).toBe(60)
    now = Date.parse('2026-11-20T00:00:01Z')
    expect(budget.exhausted()).toBeNull()
    expect(budget.stats.requests).toBe(0)
  })
})

