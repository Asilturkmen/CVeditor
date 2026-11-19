/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/**
 * `/api` → yerel sunucu (Hono). Yalnız `npm run dev:server` açar (CV_API_PROXY ortam değişkeniyle);
 * düz `npm run dev` ve e2e testlerinin sunucusu (5174) sunucusuz çalışır: "PDF al" yazdır penceresine düşer.
 */
const apiProxy = process.env.CV_API_PROXY
const proxy = apiProxy
  ? {
      '/api': {
        target: apiProxy,
        // Sunucu henüz açılmadıysa (derleniyor) ya da kapandıysa istemci hızlıca "yok" yanıtı alır.
        configure: (server: { on: (event: 'error', listener: (error: Error, req: unknown, res: unknown) => void) => void }) =>
          server.on('error', (_error, _req, res) => {
            const out = res as { headersSent?: boolean; writeHead?: (status: number, headers: Record<string, string>) => void; end: (body?: string) => void }
            if (out.writeHead && !out.headersSent) out.writeHead(503, { 'Content-Type': 'application/json' })
            out.end('{"error":"server_offline"}')
          }),
      },
    }
  : undefined

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['localStorage', 'baseLocale'],
      emitTsDeclarations: true,
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Tarayıcı verisi adrese (port dahil) bağlıdır; port değişirse CV'ler "kaybolmuş" görünür.
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        // Sunucu (server/): düz Node; /api/pdf testleri gerçek Chromium açar.
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 60_000,
          // Şablon CSS'leri (?raw) gerçek içerikleriyle yüklensin: PDF şablonla basılır.
          css: { include: [/.+/] },
        },
      },
    ],
  },
})
