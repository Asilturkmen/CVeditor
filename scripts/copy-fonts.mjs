// CV şablonlarında kullanılan yazı tiplerini @fontsource paketlerinden
// public/fonts altına kopyalar ve @font-face kurallarını üretir.
//
// Değişken (variable) değil, ağırlık başına STATİK dosyalar kullanılır: Chromium
// değişken yazı tiplerini PDF'e Type3 (glif başına çizim) olarak basıyor; statik
// dosyalar gerçek TrueType/CFF programı (/FontFile2, /FontFile3) olarak gömülür.
// Bu yüzden yalnız `@fontsource/<ad>` (değişken OLMAYAN) paketleri kullanılır.
// Her ailenin yalnız şablonların kullandığı yüzleri alınır (faces); CSS'te başka bir
// ağırlık (ör. 650) yazılırsa tarayıcı en yakınını seçer ya da kalınlığı taklit eder,
// bu yüzden şablon CSS'inde yalnız buradaki ağırlıkları kullan.
// Yalnız latin + latin-ext alt kümeleri alınır (Türkçe karakterler latin-ext'te).
// Çalıştırma: node scripts/copy-fonts.mjs (npm run fonts)
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'fonts')
mkdirSync(outDir, { recursive: true })

// Gövde yazı tipi olarak seçilebilen ailelerin ortak yüzleri. İtalik 700: zengin metinde <strong><em>.
const BODY = ['400', '500', '600', '700', '400i', '700i']

// id → paket, CSS'te kullanılacak aile adı ve alınacak yüzler ("700i" = 700 italik).
// Gövde aileleri src/cv/schema.ts FONT_IDS, başlık aileleri src/render/fonts.ts DISPLAY_FONTS ile aynı.
const FONTS = [
  // Gövde (Görünüm sekmesinde seçilebilir)
  { id: 'inter', pkg: 'inter', family: 'CV Inter', faces: BODY },
  { id: 'ibm-plex-sans', pkg: 'ibm-plex-sans', family: 'CV IBM Plex Sans', faces: ['300', ...BODY] }, // İsviçre adı 300
  { id: 'source-sans-3', pkg: 'source-sans-3', family: 'CV Source Sans 3', faces: BODY },
  { id: 'source-serif-4', pkg: 'source-serif-4', family: 'CV Source Serif 4', faces: BODY },
  { id: 'literata', pkg: 'literata', family: 'CV Literata', faces: BODY },
  { id: 'eb-garamond', pkg: 'eb-garamond', family: 'CV EB Garamond', faces: BODY },
  { id: 'archivo', pkg: 'archivo', family: 'CV Archivo', faces: [...BODY, '800', '900'] }, // Afiş adı 900, etiketler 800
  { id: 'manrope', pkg: 'manrope', family: 'CV Manrope', faces: ['400', '500', '600', '700', '800'] }, // italiği yok
  { id: 'space-grotesk', pkg: 'space-grotesk', family: 'CV Space Grotesk', faces: ['400', '500', '600', '700'] }, // italiği yok
  // Yalnız şablonun başlık/ad ailesi (Görünüm'de seçilmez)
  { id: 'poppins', pkg: 'poppins', family: 'CV Poppins', faces: ['500', '600', '700'] },
  { id: 'dm-serif-display', pkg: 'dm-serif-display', family: 'CV DM Serif Display', faces: ['400', '400i'] },
  { id: 'playfair-display', pkg: 'playfair-display', family: 'CV Playfair Display', faces: ['400', '700', '400i'] },
  { id: 'ibm-plex-mono', pkg: 'ibm-plex-mono', family: 'CV IBM Plex Mono', faces: ['400', '500'] },
  { id: 'fraunces', pkg: 'fraunces', family: 'CV Fraunces', faces: ['600', '600i'] },
]

// Eski dosyalar (ör. önceki değişken yazı tipleri) kalmasın; lisanslar yeniden kopyalanır.
for (const file of readdirSync(outDir)) {
  if (/\.(woff2?|ttf|otf)$/.test(file) || /^LICENSE-.*\.txt$/.test(file)) rmSync(join(outDir, file))
}

const faceRe = /\/\* ([^*]+?) \*\/\s*@font-face \{([^}]+)\}/g
let css = ''
const licenses = []
/** Aile → yüklenecek yüzler (CSS font kısaltması biçiminde: "700", "italic 400") */
const faces = {}
let copied = 0

for (const font of FONTS) {
  const pkgDir = join(root, 'node_modules', '@fontsource', font.pkg)
  faces[font.family] = []
  for (const face of font.faces) {
    const italic = face.endsWith('i')
    const weight = italic ? face.slice(0, -1) : face
    const style = italic ? 'italic' : 'normal'
    const file = italic ? `${weight}-italic.css` : `${weight}.css`
    const source = readFileSync(join(pkgDir, file), 'utf8')
    let found = 0
    for (const match of source.matchAll(faceRe)) {
      const [, name, body] = match
      if (!/-latin(-ext)?-\d+-/.test(name)) continue
      const woff = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1]
      if (/variable|wght/i.test(woff)) throw new Error(`${woff}: değişken yazı tipi dosyası (PDF'e Type3 basılır)`)
      copyFileSync(join(pkgDir, 'files', woff), join(outDir, woff))
      copied++
      found++
      const range = body.match(/unicode-range: ([^;]+);/)[1]
      css += `@font-face{font-family:'${font.family}';font-style:${style};font-display:block;font-weight:${weight};src:url(__FONT_BASE__${woff}) format('woff2');unicode-range:${range};}\n`
    }
    if (found !== 2) throw new Error(`${font.pkg} ${weight} ${style}: latin + latin-ext bekleniyordu, ${found} bulundu`)
    faces[font.family].push(italic ? `italic ${weight}` : weight)
  }
  licenses.push(`${font.family.replace('CV ', '')}: SIL Open Font License 1.1 (@fontsource/${font.pkg}) — LICENSE-${font.id}.txt`)
  copyFileSync(join(pkgDir, 'LICENSE'), join(outDir, `LICENSE-${font.id}.txt`))
}

const ts = `// Bu dosya scripts/copy-fonts.mjs tarafından üretilir; elle düzenleme.
// __FONT_BASE__ çalışma anında yazı tiplerinin sunulduğu adresle değiştirilir.
export const FONT_FACE_CSS = ${JSON.stringify(css)}

/** Aile → sunulan yüzler (ölçümden önce yüklenir; bkz. CvFrame) */
export const FONT_FACES: Record<string, readonly string[]> = ${JSON.stringify(faces, null, 2)}
`
writeFileSync(join(root, 'src', 'render', 'fontFaces.generated.ts'), ts)
writeFileSync(join(outDir, 'README.txt'), licenses.join('\n') + '\n')
console.log(`${FONTS.length} yazı tipi, ${copied} statik woff2 kopyalandı → public/fonts`)
