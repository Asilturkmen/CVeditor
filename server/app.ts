import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { JSDOM } from 'jsdom'
import { configureSanitizer, type SanitizerWindow } from '@/render/richtext'
import { aiRoutes, type AiRouteDeps } from './ai/routes'
import type { ServerConfig } from './config'
import { SharedBrowser } from './pdf/browser'
import { pdfRoutes, type PdfRouteDeps } from './pdf/route'
import { contentSecurityPolicy, inlineScriptHashes, securityHeaders } from './security'
import { serveStatic } from './static'

export interface AppDeps {
  config: ServerConfig
  browser?: SharedBrowser
  /** Testler için */
  onRenderRequest?: PdfRouteDeps['onRequest']
  runAi?: AiRouteDeps['run']
  now?: () => number
}

let sanitizerReady = false

/** Zengin metin süzgeci Node'da jsdom penceresiyle çalışır (src/render/richtext.ts). */
export function ensureSanitizer() {
  if (sanitizerReady) return
  configureSanitizer(new JSDOM('').window as unknown as SanitizerWindow)
  sanitizerReady = true
}

export function createApp({ config, browser = new SharedBrowser(), onRenderRequest, runAi, now }: AppDeps) {
  ensureSanitizer()
  const indexPath = config.staticDir ? join(config.staticDir, 'index.html') : null
  const csp = contentSecurityPolicy(indexPath && existsSync(indexPath) ? inlineScriptHashes(readFileSync(indexPath, 'utf8')) : [])

  const app = new Hono()
  app.use('*', securityHeaders(() => csp))

  app.get('/api/health', async (c) => c.json({ ok: true, pdf: true, browser: await browser.connected() }))
  app.route('/api/pdf', pdfRoutes({ config, browser, onRequest: onRenderRequest }))
  app.route('/api/ai', aiRoutes({ config, run: runAi, now }))
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404))

  if (config.staticDir) app.use('*', serveStatic(config.staticDir))
  app.notFound((c) => c.text('Not Found', 404))
  app.onError((error, c) => {
    console.error('[server] beklenmeyen hata:', error instanceof Error ? error.message : error)
    return c.json({ error: 'internal' }, 500)
  })

  return { app, browser }
}
