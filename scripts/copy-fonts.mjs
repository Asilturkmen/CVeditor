// CV şablonlarında kullanılan yazı tiplerini @fontsource paketlerinden
// public/fonts altına kopyalar ve @font-face kurallarını üretir.
//
// Değişken (variable) değil, ağırlık başına STATİK dosyalar kullanılır: Chromium
// değişken yazı tiplerini PDF'e Type3 (glif başına çizim) olarak basıyor; statik
// dosyalar gerçek TrueType/CFF programı (/FontFile2, /FontFile3) olarak gömülür.
// Yalnız şablon CSS'inin kullandığı ağırlıklar alınır (WEIGHTS); CSS'te başka bir
// ağırlık (ör. 650) yazılırsa tarayıcı en yakınını seçer, bu yüzden CSS'te yalnız
// buradaki ağırlıkları kullan.
// Yalnız latin + latin-ext alt kümeleri alınır (Türkçe karakterler latin-ext'te).
// Çalıştırma: node scripts/copy-fonts.mjs
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

// Şablonların kullandığı yüzler (src/render/styles/*.css). İtalik 700: zengin metinde <strong><em>.
const FACES = [
  ['400', 'normal'],
  ['500', 'normal'],
  ['600', 'normal'],
  ['700', 'normal'],
  ['400', 'italic'],
  ['700', 'italic'],
]

// Eski dosyalar (ör. önceki değişken yazı tipleri) kalmasın; lisanslar yeniden kopyalanır.
for (const file of readdirSync(outDir)) {
  if (/\.(woff2?|ttf|otf)$/.test(file)) rmSync(join(outDir, file))
}

const faceRe = /\/\* ([^*]+?) \*\/\s*@font-face \{([^}]+)\}/g
let css = ''
const licenses = new Set()
let copied = 0

for (const font of FONTS) {
  const pkgDir = join(root, 'node_modules', '@fontsource', font.pkg)
  for (const [weight, style] of FACES) {
    const file = style === 'italic' ? `${weight}-italic.css` : `${weight}.css`
    const source = readFileSync(join(pkgDir, file), 'utf8')
    let found = 0
    for (const match of source.matchAll(faceRe)) {
      const [, name, body] = match
      if (!/-latin(-ext)?-\d+-/.test(name)) continue
      const woff = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1]
      copyFileSync(join(pkgDir, 'files', woff), join(outDir, woff))
      copied++
      found++
      const range = body.match(/unicode-range: ([^;]+);/)[1]
      css += `@font-face{font-family:'${font.family}';font-style:${style};font-display:block;font-weight:${weight};src:url(__FONT_BASE__${woff}) format('woff2');unicode-range:${range};}\n`
    }
    if (found !== 2) throw new Error(`${font.pkg} ${weight} ${style}: latin + latin-ext bekleniyordu, ${found} bulundu`)
  }
  licenses.add(`${font.family.replace('CV ', '')}: SIL Open Font License 1.1 (@fontsource/${font.pkg})`)
  copyFileSync(join(pkgDir, 'LICENSE'), join(outDir, `LICENSE-${font.id}.txt`))
}

const ts = `// Bu dosya scripts/copy-fonts.mjs tarafından üretilir; elle düzenleme.
// __FONT_BASE__ çalışma anında yazı tiplerinin sunulduğu adresle değiştirilir.
export const FONT_FACE_CSS = ${JSON.stringify(css)}
`
writeFileSync(join(root, 'src', 'render', 'fontFaces.generated.ts'), ts)
writeFileSync(join(outDir, 'README.txt'), [...licenses].join('\n') + '\n')
console.log(`${FONTS.length} yazı tipi, ${copied} statik woff2 kopyalandı → public/fonts`)
