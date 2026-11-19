import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'

/**
 * Üretim girişi: `npm run build` → `npm start` (node dist-server/index.js).
 * Statik site (dist/) + /api/health + /api/pdf + /api/ai/*. Ayarlar ortam değişkenlerinden (.env.example).
 */
const config = loadConfig()
const { app, browser } = createApp({ config })

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.info(`[server] http://${config.host}:${info.port} (statik: ${config.staticDir ?? 'kapalı'}, yazı tipleri: ${config.fontsDir})`)
})

let closing = false
async function shutdown(signal: string) {
  if (closing) return
  closing = true
  console.info(`[server] ${signal}: kapanıyor`)
  server.close()
  await browser.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
