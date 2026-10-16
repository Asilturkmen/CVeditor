#!/usr/bin/env node
/**
 * Push öncesi kişisel bilgi taraması için git `pre-push` kancası kurar.
 * Kendiliğinden çalışmaz; repo sahibi bir kez elle çalıştırır:
 *
 *   node scripts/install-hooks.mjs          # kurar (başka bir pre-push varsa dokunmaz)
 *   node scripts/install-hooks.mjs --force  # var olan pre-push'un üzerine yazar
 *   node scripts/install-hooks.mjs --remove # bu betiğin kurduğu kancayı kaldırır
 *
 * Kanca `node scripts/scan-personal.mjs` çalıştırır; bulgu varsa push durur.
 * Acil durumda tek seferlik atlamak için: git push --no-verify (önerilmez).
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const MARKER = '# cveditor: scan-personal pre-push'
const HOOK = `#!/bin/sh
${MARKER}
# scripts/install-hooks.mjs tarafından kuruldu. Kaldırmak için: node scripts/install-hooks.mjs --remove
cd "$(git rev-parse --show-toplevel)" || exit 1
node scripts/scan-personal.mjs
status=$?
if [ $status -ne 0 ]; then
  echo ""
  echo "Push durduruldu: kişisel bilgi taraması temiz değil (npm run scan)."
  exit $status
fi
`

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

let hooksDir
try {
  const top = git('rev-parse', '--show-toplevel')
  // core.hooksPath ayarlıysa --git-path onu döndürür.
  hooksDir = resolve(top, git('rev-parse', '--git-path', 'hooks'))
} catch {
  console.error('Git deposu bulunamadı; repo içinde çalıştır.')
  process.exit(2)
}

const hookPath = join(hooksDir, 'pre-push')
const exists = existsSync(hookPath)
const ours = exists && readFileSync(hookPath, 'utf8').includes(MARKER)
const flags = new Set(process.argv.slice(2))

if (flags.has('--remove')) {
  if (!ours) {
    console.log(exists ? 'pre-push bu betiğe ait değil; dokunulmadı.' : 'Kurulu pre-push kancası yok.')
    process.exit(0)
  }
  rmSync(hookPath)
  console.log(`Kaldırıldı: ${hookPath}`)
  process.exit(0)
}

if (exists && !ours && !flags.has('--force')) {
  console.error(`Zaten bir pre-push kancası var: ${hookPath}`)
  console.error('Üzerine yazmak için --force ver ya da o kancaya "node scripts/scan-personal.mjs" satırını elle ekle.')
  process.exit(1)
}

mkdirSync(hooksDir, { recursive: true })
writeFileSync(hookPath, HOOK, { encoding: 'utf8' })
try {
  chmodSync(hookPath, 0o755)
} catch {
  // Windows'ta izin biti gerekmez; Git for Windows sh ile çalıştırır.
}
console.log(`Kuruldu: ${hookPath}`)
console.log('Artık her git push öncesi kişisel bilgi taraması çalışacak.')
