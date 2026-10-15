// CV şablonlarında kullanılan yazı tiplerini @fontsource-variable paketlerinden
// public/fonts altına kopyalar ve @font-face kurallarını üretir.
// Yalnız latin + latin-ext alt kümeleri alınır (Türkçe karakterler latin-ext'te).
// Çalıştırma: node scripts/copy-fonts.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'fonts')
mkdirSync(outDir, { recursive: true })

// id → paket ve CSS'te kullanılacak aile adı
const FONTS = [
  { id: 'inter', pkg: 'inter', family: 'CV Inter' },
  { id: 'ibm-plex-sans', pkg: 'ibm-plex-sans', family: 'CV IBM Plex Sans' },
  { id: 'source-sans-3', pkg: 'source-sans-3', family: 'CV Source Sans 3' },
  { id: 'source-serif-4', pkg: 'source-serif-4', family: 'CV Source Serif 4' },
  { id: 'literata', pkg: 'literata', family: 'CV Literata' },
]

const faceRe = /\/\* ([^*]+?) \*\/\s*@font-face \{([^}]+)\}/g
let css = ''
const licenses = new Set()

for (const font of FONTS) {
  const pkgDir = join(root, 'node_modules', '@fontsource-variable', font.pkg)
  for (const file of ['wght.css', 'wght-italic.css']) {
    const source = readFileSync(join(pkgDir, file), 'utf8')
    for (const match of source.matchAll(faceRe)) {
      const [, name, body] = match
      if (!/-latin(-ext)?-/.test(name)) continue
      const woff = body.match(/url\(\.\/files\/([^)]+)\)/)[1]
      copyFileSync(join(pkgDir, 'files', woff), join(outDir, woff))
      const style = body.match(/font-style: (\w+)/)[1]
      const weight = body.match(/font-weight: ([\d ]+);/)[1]
      const range = body.match(/unicode-range: ([^;]+);/)[1]
      css += `@font-face{font-family:'${font.family}';font-style:${style};font-display:block;font-weight:${weight};src:url(__FONT_BASE__${woff}) format('woff2-variations');unicode-range:${range};}\n`
    }
  }
  licenses.add(`${font.family.replace('CV ', '')}: SIL Open Font License 1.1 (@fontsource-variable/${font.pkg})`)
  copyFileSync(join(pkgDir, 'LICENSE'), join(outDir, `LICENSE-${font.id}.txt`))
}

const ts = `// Bu dosya scripts/copy-fonts.mjs tarafından üretilir; elle düzenleme.
// __FONT_BASE__ çalışma anında yazı tiplerinin sunulduğu adresle değiştirilir.
export const FONT_FACE_CSS = ${JSON.stringify(css)}
`
writeFileSync(join(root, 'src', 'render', 'fontFaces.generated.ts'), ts)
writeFileSync(join(outDir, 'README.txt'), [...licenses].join('\n') + '\n')
console.log(`${FONTS.length} yazı tipi kopyalandı → public/fonts`)
