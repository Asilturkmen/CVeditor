// Geliştirme: `npm run dev:server`
//  1. Sunucuyu (server/) Vite ile izleme kipinde derler; her derlemeden sonra yeniden başlatır (port 8787, yalnız API).
//  2. İstemciyi Vite geliştirme sunucusunda açar (port 5173) ve /api isteklerini sunucuya yönlendirir (vite.config.ts).
// Yalnız istemci için `npm run dev` yeter: sunucu yoksa "PDF al" yazdır penceresine düşer.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = 'node_modules/.tmp/dev-server'
const port = process.env.PORT || '8787'
const nodeBin = process.execPath

/** @type {import('node:child_process').ChildProcess | null} */
let api = null

function startApi() {
  if (api) api.kill()
  api = spawn(nodeBin, ['--env-file-if-exists=.env', '--enable-source-maps', `${outDir}/index.js`], {
    cwd: root,
    stdio: 'inherit',
    // Paket node_modules/.tmp altında: yazı tiplerinin yeri açıkça verilir.
    env: { ...process.env, PORT: port, HOST: '127.0.0.1', SERVE_STATIC: '0', FONTS_DIR: `${root}/public/fonts` },
  })
}

process.env.SERVER_OUT_DIR = outDir
const watcher = await build({
  root,
  configFile: 'vite.server.config.ts',
  mode: 'development',
  logLevel: 'warn',
  build: { watch: {} },
})
if ('on' in watcher) {
  watcher.on('event', (event) => {
    if (event.code === 'END') {
      console.info('[dev:server] sunucu derlendi, yeniden başlatılıyor')
      startApi()
    } else if (event.code === 'ERROR') {
      console.error('[dev:server] derleme hatası:', event.error?.message ?? event.error)
    }
    if ('result' in event && event.result) event.result.close()
  })
}

const vite = spawn(nodeBin, ['node_modules/vite/bin/vite.js'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CV_API_PROXY: `http://127.0.0.1:${port}` },
})

const stop = () => {
  api?.kill()
  vite.kill()
  if ('close' in watcher) void watcher.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
vite.on('exit', stop)
