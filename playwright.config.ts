import { defineConfig, devices } from '@playwright/test'

/**
 * Uçtan uca testler gerçek Chromium'da çalışır (önizleme = PDF garantisi
 * Chromium'a göre). Ayrı port: testlerin tarayıcı verisi geliştirme
 * sunucusundaki gerçek CV'lere karışmaz; her test zaten temiz bağlamla başlar.
 */
const PORT = 5174

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'tr-TR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
