import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/**
 * Sunucu paketi (Hono + /api/pdf): `vite build -c vite.server.config.ts` → dist-server/index.js.
 * Vite ile derlenir çünkü sunucu, istemciyle aynı çizim paketini (`src/render`) kullanır: `@/`
 * takma adı ve `*.css?raw` içe aktarmaları burada çözülür. node_modules paketleri dışarıda kalır
 * (üretimde `npm ci --omit=dev` ile kurulur).
 *
 * Paraglide eklentisi yok: `src/paraglide` istemci derlemesinde (`npm run build`'in ilk adımı)
 * üretilir; burada yalnız okunur.
 *
 * Hedef node24, küçültme ve `keepNames` kapalı: `pageDrawScript()` drawDocument ve paginate'i
 * `toString()` ile tarayıcı sayfasına enjekte eder; gövdelere yardımcı çağrı (`__name`) girmemeli.
 */
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  publicDir: false,
  build: {
    ssr: 'server/index.ts',
    outDir: process.env.SERVER_OUT_DIR || 'dist-server',
    emptyOutDir: true,
    target: 'node24',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'index.js', keepNames: false },
    },
  },
})
