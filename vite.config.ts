/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

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
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
