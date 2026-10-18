/**
 * CV renkleri: kullanıcının vurgu (ve varsa zemin) renginden şablonların okuduğu
 * değişkenleri türetir. Kurallar WCAG 2 kontrast oranına göredir:
 * - `--on-*`: renkli zeminin üstündeki metin; beyaz ya da koyudan hangisi daha okunursa.
 * - `--*-ink`: rengin metin olarak kullanılan hâli; zeminine karşı en az 4.5:1 olana
 *   kadar koyulaştırılır (açık zeminde) ya da açılır (koyu zeminde). Kullanıcı açık
 *   sarı seçse de başlık okunur kalır.
 * - `--accent-mark`: koyu metnin altına konan vurgu zemini (Afiş'in fosforlu kalemi);
 *   metin en az 4.5:1 okunana kadar açılır.
 */

export type Rgb = [number, number, number]

export const MIN_TEXT_CONTRAST = 4.5
const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]
const DARK_TEXT: Rgb = [22, 22, 22]

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
}

/** WCAG göreli parlaklık (0 siyah … 1 beyaz) */
export function luminance(color: Rgb | string): number {
  const [r, g, b] = (typeof color === 'string' ? parseHex(color) : color).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: Rgb | string, b: Rgb | string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `a`'dan `b`'ye doğru `t` (0-1) oranında karışım (sRGB) */
export function mix(a: Rgb | string, b: Rgb | string, t: number): Rgb {
  const x = typeof a === 'string' ? parseHex(a) : a
  const y = typeof b === 'string' ? parseHex(b) : b
  return [0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb
}

export const isDark = (color: Rgb | string) => luminance(color) < 0.18

/** Renkli zeminin üstündeki metin rengi: beyaz ya da koyu, hangisi daha okunursa (her zaman ≥ 4.5:1). */
export function onColor(bg: Rgb | string): string {
  const white = contrast(WHITE, bg)
  const dark = contrast(DARK_TEXT, bg)
  if (Math.max(white, dark) >= MIN_TEXT_CONTRAST) return white >= dark ? '#ffffff' : toHex(DARK_TEXT)
  // Orta tonlarda #161616 bile yetmeyebilir; saf siyah her rengi en az ~4.58:1 okutur.
  return white >= contrast(BLACK, bg) ? '#ffffff' : '#000000'
}

/**
 * `fg` metni `bg` üstünde en az `min` kontrastla okunana kadar zeminin tersine
 * (açık zeminde siyaha, koyu zeminde beyaza) doğru kaydırır. Zaten okunuyorsa aynen döner.
 */
export function ensureContrast(fg: Rgb | string, bg: Rgb | string, min = MIN_TEXT_CONTRAST): string {
  const start = typeof fg === 'string' ? parseHex(fg) : fg
  // Karşılaştırma yuvarlanmış hex üzerinden: CSS'e giden değer odur (yoksa 4.49 çıkabilir).
  const ok = (c: Rgb) => contrast(toHex(c), bg) >= min
  if (ok(start)) return toHex(start)
  const target = isDark(bg) ? WHITE : BLACK
  for (let t = 0.04; t < 1; t += 0.04) {
    const candidate = mix(start, target, t)
    if (ok(candidate)) return toHex(candidate)
  }
  return toHex(target)
}

/** `bg` zemini, üstündeki `text` en az `min` kontrastla okunana kadar metnin tersine kaydırılır. */
export function ensureBackground(bg: Rgb | string, text: Rgb | string, min = MIN_TEXT_CONTRAST): string {
  const start = typeof bg === 'string' ? parseHex(bg) : bg
  const ok = (c: Rgb) => contrast(toHex(c), text) >= min
  if (ok(start)) return toHex(start)
  // Yön: zemin metinden açıksa beyaza, koyuysa siyaha (metnin kendi açık/koyu eşiğine göre değil:
  // 4.5:1'lik vurgu metni tam o eşikte durur, zemin yanlış yöne kaçardı).
  // O uç bile yetmiyorsa (siyah metnin altında siyah zemin) öbür uca.
  let target = luminance(start) >= luminance(text) ? WHITE : BLACK
  if (!ok(target)) target = target === WHITE ? BLACK : WHITE
  for (let t = 0.04; t < 1; t += 0.04) {
    const candidate = mix(start, target, t)
    if (ok(candidate)) return toHex(candidate)
  }
  return toHex(target)
}

/** `bg` zemini, `texts` metinlerinin her biri en az `min` okunana kadar metinlerin tersine kaydırılır. */
export function ensureBackgroundFor(bg: Rgb | string, texts: (Rgb | string)[], min = MIN_TEXT_CONTRAST): string {
  let color = typeof bg === 'string' ? bg : toHex(bg)
  for (let round = 0; round < 3; round++) {
    for (const text of texts) color = ensureBackground(color, text, min)
    if (texts.every((text) => contrast(text, color) >= min)) break
  }
  return color
}

export interface ColorInput {
  accent: string
  /** Zemin rengi; şablon zemin kullanmıyorsa vurgu */
  base: string
  /** Metnin durduğu kâğıt; `'base'` ise zemin */
  paper: string | 'base'
  ink?: string
  muted?: string
  rule?: string
}

/** Şablon CSS'lerinin okuduğu renk değişkenleri (hepsi hex). */
export function colorVariables(input: ColorInput): Record<`--${string}`, string> {
  const accent = parseHex(input.accent)
  const base = parseHex(input.base)
  const onBase = onColor(base)
  const paper = input.paper === 'base' ? base : parseHex(input.paper)
  const darkPaper = isDark(paper)

  // Kâğıt zemin rengindeyse (Gece, Çift Ton) metin renkleri zeminden türer. Her metin rengi
  // durduğu zemine karşı denetlenir (zemin kullanıcının rengi olabilir).
  const ink = ensureContrast(input.paper === 'base' || !input.ink ? mix(onBase, base, 0.06) : input.ink, paper)
  const muted = ensureContrast(input.paper === 'base' || !input.muted ? mix(onBase, base, 0.38) : input.muted, paper)
  const rule = input.paper === 'base' || !input.rule ? toHex(mix(paper, onBase, 0.24)) : input.rule
  const accentInk = ensureContrast(accent, paper)
  const onAccent = onColor(accent)

  // Vurgunun açık tonu metin zemini olabilir (Bant'ın yan kartı): üstündeki metin, soluk metin ve
  // vurgu metni okunur kalana kadar kâğıda doğru açılır (metin renkleri değişmez).
  const accentSoft = ensureBackgroundFor(mix(paper, accent, darkPaper ? 0.16 : 0.09), [ink, muted, accentInk])

  // Yuvarlanmış: CSS'e giden değerle denetlensin
  const baseSoft = parseHex(toHex(mix(base, WHITE, 0.86)))
  const baseInk = ensureContrast(base, baseSoft)

  return {
    '--paper': toHex(paper),
    '--ink': ink,
    '--muted': muted,
    '--rule': rule,
    '--accent': toHex(accent),
    '--on-accent': onAccent,
    '--on-accent-dim': ensureContrast(mix(onAccent, accent, 0.12), accent),
    '--on-accent-muted': ensureContrast(mix(onAccent, accent, 0.22), accent),
    '--accent-ink': accentInk,
    '--accent-mark': ensureBackground(accent, ink),
    '--accent-soft': accentSoft,
    '--accent-light': toHex(mix(paper, accent, darkPaper ? 0.32 : 0.24)),
    '--accent-dark': toHex(mix(accent, BLACK, 0.3)),
    '--base': toHex(base),
    '--on-base': onBase,
    '--on-base-dim': ensureContrast(mix(onBase, base, 0.1), base),
    '--on-base-muted': ensureContrast(mix(onBase, base, 0.32), base),
    '--base-soft': toHex(baseSoft),
    '--base-ink': baseInk,
    '--base-ink-muted': ensureContrast(mix(baseInk, baseSoft, 0.3), baseSoft),
    '--accent-on-base': ensureContrast(accent, base),
  }
}
