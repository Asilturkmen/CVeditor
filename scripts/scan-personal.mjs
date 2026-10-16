#!/usr/bin/env node
/**
 * Kişisel bilgi ve sır taraması (public repo güvenliği).
 *
 * Git'in izlediği dosyalarla git dışı bırakılmamış yeni dosyaları tarar
 * (`git ls-files -co --exclude-standard`, yalnız okur) ve şunları arar:
 *   - izin listesinde olmayan e-posta adresleri
 *   - yer tutucu olmayan telefon numaraları (TR ve uluslararası)
 *   - TC kimlik numarası gibi duran 11 haneli sayılar (sağlama haneleri tutanlar)
 *   - IBAN (TR + 24 hane)
 *   - API anahtarı / gizli değer gibi duran dizgiler, özel anahtar blokları
 *   - gerçek CV dışa aktarımı gibi duran dosyalar (CVeditör yedekleri, JSON Resume,
 *     e2e/fixtures dışındaki PDF'ler, fotoğraflar)
 *
 * Bulgu varsa dosya:satır listesiyle Türkçe rapor yazar ve 1 ile çıkar.
 * Yanlış alarmı kontrolü gevşeterek değil, aşağıdaki izin listeleriyle çöz.
 * Bilerek uydurma veri içeren tek bir satırı geçirmek için satıra
 * `scan-personal: izin` yorumu eklenebilir.
 *
 * Kullanım: npm run scan                       (bağımlılık yok; Node 18+)
 *          node scripts/scan-personal.mjs a b   (yalnız verilen dosyaları tarar)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'

// ---------------------------------------------------------------- izin listeleri

/** Bu alan adlarındaki (ve alt alan adlarındaki) adresler uydurmadır. */
const ALLOWED_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net', 'example.edu', 'ornek.com', 'ornek.com.tr', 'ornek.org', 'test', 'localhost', 'invalid']
/** Tek tek izinli adresler. */
const ALLOWED_EMAILS = [
  'noreply@anthropic.com',
  'git@github.com',
  'noreply@github.com',
  // Arayüz yer tutucuları (messages/*.json)
  'ad@alanadi.com',
  'name@domain.com',
  // Testlerdeki kısa uydurma adresler
  'a@b.com',
  'a@b.co',
  'c@d.com',
]

/**
 * Testlerde kullanılan uydurma TR numaraları (ülke kodu olmadan 10 hane).
 * Yeni bir test numarası gerekiyorsa tercihen abone kısmı 000 00 00 ya da
 * 123 45 67 olanı kullan; o biçimler zaten yer tutucu sayılır.
 */
const ALLOWED_TR_PHONES = ['5320001234', '5330001122', '5551112233']

/** Uydurma örnek kişi (src/cv/sample.ts): bu satırlardaki kişisel veri bulguları geçer. */
const SAMPLE_PERSON = /Deniz Aksoy|deniz[.\-_]?aksoy/i

/** Satır içi izin işareti. */
const INLINE_ALLOW = /scan-personal:\s*izin/i

/** Kişisel veri kurallarından muaf yollar (test fikstürleri). Sır kuralları burada da çalışır. */
const PERSONAL_DATA_ALLOWED_PATHS = [/^e2e\/fixtures\//]

/** PDF'e izin verilen yollar. */
const PDF_ALLOWED_PATHS = [/^e2e\/fixtures\//]

/** Görsellere izin verilen yollar (uygulama varlıkları; kişi fotoğrafı değil). */
const IMAGE_ALLOWED_PATHS = [/^public\/(?!.*\.(jpe?g|heic|heif)$)/i]

/** Taranmayacak ikili dosya uzantıları (içerik değil, ad kuralları uygulanır). */
const BINARY_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.heic', '.heif', '.pdf', '.zip', '.gz', '.tgz', '.br', '.wasm', '.mp4', '.webm', '.mp3'])

// ---------------------------------------------------------------- kurallar

const FILE_EXT_TLDS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'json', 'html', 'md', 'woff', 'woff2', 'ttf', 'map'])

const EMAIL = /(?<![\w.%+-])[A-Za-z0-9][A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.([A-Za-z]{2,}))(?![\w-])/g

// TR cep: (+90|0)? 5xx xxx xx xx ; TR sabit hat yalnız +90/0 önekiyle: 2xx-4xx.
const TR_MOBILE = /(?<![\w+])(?:\+?90[\s.-]?|0)?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?![\w])/g
const TR_LANDLINE = /(?<![\w+])(?:\+90[\s.-]?|0)\(?[2-4]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?![\w])/g
// Uluslararası: + ile başlar, 9-15 hane.
const INTL_PHONE = /(?<![\w+])\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}(?![\w])/g

const ELEVEN_DIGITS = /(?<![\w.])[1-9]\d{10}(?![\w.])/g
const IBAN_TR = /(?<![A-Za-z0-9])TR\d{2}(?:\s?\d{4}){5}\s?\d{2}(?!\d)/g

const PRIVATE_KEY = new RegExp('-----BEGIN [A-Z ]*' + 'PRIVATE KEY-----')
const KNOWN_KEYS = [
  ['API anahtarı (sk-…)', /(?<![\w-])sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g],
  ['AWS erişim anahtarı', /(?<![A-Z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])/g],
  ['GitHub belirteci', /(?<![\w])(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/g],
  ['Google API anahtarı', /(?<![\w])AIza[0-9A-Za-z_-]{35}/g],
  ['Slack belirteci', /(?<![\w])xox[abposr]-[A-Za-z0-9-]{10,}/g],
  ['Stripe anahtarı', /(?<![\w])(?:sk|rk)_live_[A-Za-z0-9]{20,}/g],
]
// Ad "anahtar/sır" gibi duran bir atamaya verilmiş uzun base64/hex değer.
const SECRET_ASSIGNMENT =
  /\b([A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|passw(?:or)?d|pwd|private[_-]?key|access[_-]?key|auth|credential)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*["'`]?([A-Za-z0-9+/_\-=]{32,})/gi

// ---------------------------------------------------------------- yardımcılar

const digits = (s) => s.replace(/\D/g, '')

/**
 * Telefon yer tutucusu mu: abone kısmı tek rakam tekrarı, sıralı ya da 'x'li;
 * kurgu için ayrılmış aralıklar (ABD 555-0100…0199, İngiltere Ofcom 7946 0xxx / 496 0xxx);
 * ya da izinli test numarası.
 */
function isPlaceholderPhone(raw, line) {
  const d = digits(raw)
  if (ALLOWED_TR_PHONES.includes(d.slice(-10)) && /^(90|0)?5/.test(d)) return true
  if (/^1\d{3}55501\d{2}$/.test(d)) return true
  if (/^44(?:2079460|\d{3}4960)\d{3}$/.test(d)) return true
  const subscriber = d.slice(-7)
  if (/^(\d)\1{6}$/.test(subscriber)) return true
  if (['1234567', '0123456', '7654321'].includes(subscriber)) return true
  if (/^0+$/.test(d.slice(-4))) return true
  // "+90 5xx ..." biçiminde yazılmış şablon
  if (/5xx|x{2,}/i.test(line)) return true
  return false
}

function isValidTc(n) {
  const d = n.split('').map(Number)
  if (d[0] === 0) return false
  const odd = d[0] + d[2] + d[4] + d[6] + d[8]
  const even = d[1] + d[3] + d[5] + d[7]
  const d10 = (((odd * 7 - even) % 10) + 10) % 10
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10
  return d[9] === d10 && d[10] === d11
}

function emailAllowed(email, domain) {
  const lower = email.toLowerCase()
  if (ALLOWED_EMAILS.includes(lower)) return true
  const dom = domain.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.some((a) => dom === a || dom.endsWith(`.${a}`))
}

function mask(value) {
  const v = value.trim()
  if (v.length <= 8) return v.slice(0, 2) + '…'
  return `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} karakter)`
}

/** Base64/hex dizgisi rastgele mi (yer tutucu, tekrar ya da sözcük değil)? */
function looksRandom(value) {
  if (/^(.)\1+$/.test(value)) return false
  if (/^(x+|0+|your|example|ornek|changeme|placeholder)/i.test(value)) return false
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(value)).length
  return classes >= 2 && new Set(value).size >= 12
}

// ---------------------------------------------------------------- tarama

function listFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    return [...new Set(out.split('\0').filter(Boolean))]
  } catch (err) {
    console.error('Tarama başlatılamadı: git dosya listesi alınamadı. Repo kökünde çalıştır.')
    console.error(String(err?.message ?? err))
    process.exit(2)
  }
}

const findings = []
const add = (file, line, kind, detail) => findings.push({ file, line, kind, detail })

function scanName(file) {
  const name = basename(file).toLowerCase()
  const ext = extname(name)
  if (name.endsWith('.cveditor.json')) add(file, 0, 'CV dışa aktarımı', 'CVeditör CV dosyası (*.cveditor.json) gerçek veri içerebilir')
  if (name.endsWith('.resume.json')) add(file, 0, 'CV dışa aktarımı', 'JSON Resume dosyası (*.resume.json) gerçek veri içerebilir')
  if (/^cveditor-yedek-.*\.json$/.test(name)) add(file, 0, 'CV yedeği', 'CVeditör toplu yedeği (cveditor-yedek-*.json)')
  if (ext === '.pdf' && !PDF_ALLOWED_PATHS.some((r) => r.test(file))) add(file, 0, 'PDF', 'e2e/fixtures dışında PDF: dışa aktarılmış gerçek CV olabilir')
  if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif'].includes(ext) && !IMAGE_ALLOWED_PATHS.some((r) => r.test(file)))
    add(file, 0, 'Görsel', 'kişi fotoğrafı olabilir; uygulama varlığıysa izin listesine ekle')
  if (/^\.env($|\.)/.test(name) && name !== '.env.example') add(file, 0, 'Ortam dosyası', '.env dosyası git dışında kalmalı')
  if (/\.(pem|key|p12|pfx)$/.test(name) || /^id_(rsa|ed25519|ecdsa)/.test(name)) add(file, 0, 'Anahtar dosyası', 'özel anahtar/sertifika dosyası')
}

function scanContent(file, text) {
  const personalAllowed = PERSONAL_DATA_ALLOWED_PATHS.some((r) => r.test(file))
  const isEnvLike = /(^|\/)\.env/.test(file)
  const isLock = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)
  const lines = text.split(/\r?\n/)

  if (PRIVATE_KEY.test(text)) {
    const i = lines.findIndex((l) => PRIVATE_KEY.test(l))
    add(file, i + 1, 'Özel anahtar', 'PRIVATE KEY bloğu')
  }

  lines.forEach((line, i) => {
    const n = i + 1
    if (INLINE_ALLOW.test(line)) return
    // Kilit dosyalarında paket bütünlük özetleri ve adresleri doğal olarak uzundur.
    if (isLock && /"(integrity|resolved)"\s*:/.test(line)) return

    for (const [kind, re] of KNOWN_KEYS) {
      for (const m of line.matchAll(re)) add(file, n, kind, mask(m[0]))
    }
    for (const m of line.matchAll(SECRET_ASSIGNMENT)) {
      if (looksRandom(m[2])) add(file, n, 'Gizli değer', `${m[1]} = ${mask(m[2])}`)
    }
    if (isEnvLike && /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S/.test(line)) add(file, n, 'Ortam değeri', 'ortam dosyasında değer yazılı; örnek dosyada yalnız ad ve açıklama olmalı')

    if (personalAllowed || SAMPLE_PERSON.test(line)) return

    for (const m of line.matchAll(EMAIL)) {
      if (FILE_EXT_TLDS.has(m[2].toLowerCase())) continue
      if (!emailAllowed(m[0], m[1])) add(file, n, 'E-posta', m[0])
    }
    const phoneSpans = []
    for (const re of [TR_MOBILE, TR_LANDLINE, INTL_PHONE]) {
      for (const m of line.matchAll(re)) {
        const d = digits(m[0])
        if (d.length < 10 || d.length > 15) continue
        if (re === INTL_PHONE && !/[\s.()-]/.test(m[0].slice(1)) && d.length < 11) continue
        const start = m.index
        if (phoneSpans.some(([a, b]) => start < b && start + m[0].length > a)) continue
        phoneSpans.push([start, start + m[0].length])
        if (!isPlaceholderPhone(m[0], line)) add(file, n, 'Telefon', m[0].trim())
      }
    }
    for (const m of line.matchAll(ELEVEN_DIGITS)) {
      if (isValidTc(m[0])) add(file, n, 'TC kimlik no gibi', mask(m[0]))
    }
    for (const m of line.matchAll(IBAN_TR)) {
      const body = digits(m[0]).slice(2)
      if (!/^(\d)\1+$/.test(body)) add(file, n, 'IBAN', mask(m[0]))
    }
  })
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const files = args.length > 0 ? args.map((f) => f.replaceAll('\\', '/')) : listFiles()
let scanned = 0
for (const file of files) {
  if (!existsSync(file)) continue // izlenen ama çalışma ağacında silinmiş
  const st = statSync(file)
  if (!st.isFile()) continue
  scanName(file)
  if (BINARY_EXT.has(extname(file).toLowerCase())) continue
  if (st.size > 5 * 1024 * 1024) continue
  const buf = readFileSync(file)
  if (buf.subarray(0, 8000).includes(0)) continue
  scanned++
  scanContent(file, buf.toString('utf8'))
}

// ---------------------------------------------------------------- rapor

if (findings.length === 0) {
  console.log(`Kişisel bilgi taraması: temiz. ${scanned} dosya tarandı, bulgu yok.`)
  process.exit(0)
}

console.log(`Kişisel bilgi taraması: ${findings.length} bulgu (${scanned} dosya tarandı).\n`)
const byFile = new Map()
for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
for (const [file, list] of byFile) {
  for (const f of list) {
    const where = f.line ? `${file}:${f.line}` : file
    console.log(`  ${where}  [${f.kind}]  ${f.detail}`)
  }
}
console.log(
  '\nNe yapmalı: gerçek kişisel veri ya da sır ise dosyadan çıkar (gerekirse geçmişten de temizle).' +
    '\nYanlış alarm ise scripts/scan-personal.mjs içindeki izin listesine ekle ya da satıra' +
    ' "scan-personal: izin" yorumu yaz. Push etmeden önce tarama temiz olmalı.',
)
process.exit(1)
