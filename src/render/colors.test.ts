import { describe, expect, it, vi } from 'vitest'
import { colorVariables, contrast, ensureContrast, isDark, luminance, mix, MIN_TEXT_CONTRAST, onColor, onTones, toHex } from './colors'
import { activeColorSet, TEMPLATE_LIST, type TemplateDef, type TemplateId } from './templates'

// Renk küpü taramaları tek başına ~1 sn sürüyor; paralel testlerin yükü altında 5 sn'lik
// varsayılanı aşabiliyor. Taramalar deterministik, süre sınırı yalnız yük için gevşetildi.
vi.setConfig({ testTimeout: 30_000 })

/**
 * Şablonların gerçekten kullandığı metin/zemin çiftleri (styles/<id>.css). Bir renk ya
 * değişken adıdır ya da CSS'teki `color-mix(in srgb, a p%, b)` karışımıdır. Yeni şablonda
 * ya da CSS'te yeni bir metin rengi/zemini eklenince buraya da eklenmeli.
 *
 * Eşik: bütün çiftler gövde metni eşiğiyle (4.5:1) denetlenir; büyük başlık indirimi (3:1)
 * kullanılmıyor. Kapsam dışı: süs ayırıcılar (" ·", virgül), önizlemeye özgü yer tutucu
 * ve öneri renkleri (PDF'e girmez), fotoğraf.
 */
type Color = `--${string}` | { mix: [Color, number, Color] }
type Pair = [fg: Color, bg: Color, label: string]


const COMMON: Pair[] = [
  ['--ink', '--paper', 'metin'],
  ['--muted', '--paper', 'soluk metin'],
  ['--accent-ink', '--paper', 'vurgu metni'],
]

const PAIRS: Record<TemplateId, Pair[]> = {
  yalin: [],
  zarif: [],
  ikili: [],
  panel: [
    ['--on-base', '--base', 'yan sütun başlığı ve kayıt adı'],
    ['--on-base-dim', '--base', 'yan sütun metni'],
    ['--on-base-muted', '--base', 'yan sütun tarih/alt satır'],
  ],
  teknik: [],
  cizgi: [],
  bant: [
    ['--on-accent', '--accent', 'bantta ad'],
    ['--on-accent-dim', '--accent', 'bantta unvan'],
    ['--on-accent-muted', '--accent', 'bantta iletişim'],
  ],
  cizelge: [['--ink', '--accent-soft', 'şeritte bölüm başlığı']],
  isvicre: [],
  yonetici: [],
  portre: [],
  denge: [],
  dergi: [],
  blok: [
    ['--ink', '--accent-mark', 'renk bloğunda ad, unvan, iletişim'],
    ['--paper', '--ink', 'siyah etiket kutusunda bölüm başlığı'],
  ],
}
function resolve(color: Color, vars: Record<string, string>): string {
  if (typeof color === 'string') {
    const value = vars[color]
    if (!value) throw new Error(`değişken yok: ${color}`)
    return value
  }
  const [a, percent, b] = color.mix
  // color-mix(in srgb, a p%, b) = a·p + b·(1−p); mix(x, y, t) x'ten y'ye t kadar gider.
  return toHex(mix(resolve(a, vars), resolve(b, vars), 1 - percent / 100))
}

function varsFor(template: TemplateDef, accent: string, base: string | null, setVars?: Record<string, string>): Record<string, string> {
  return {
    ...colorVariables({
      accent,
      base: base ?? template.colorSets[0].base ?? accent,
      paper: template.paper,
      ink: template.ink,
      muted: template.muted,
      rule: template.rule,
    }),
    ...setVars,
  }
}

function failures(template: TemplateDef, vars: Record<string, string>, label: string) {
  const out: string[] = []
  for (const [fg, bg, what] of [...COMMON, ...PAIRS[template.id]]) {
    const ratio = contrast(resolve(fg, vars), resolve(bg, vars))
    if (ratio < MIN_TEXT_CONTRAST) out.push(`${template.id} ${what} (${label}): ${JSON.stringify(fg)} / ${JSON.stringify(bg)} = ${ratio.toFixed(2)}`)
  }
  return out
}

/** Tekrarlanabilir sözde rastgele renkler (LCG) */
function randomColors(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31
    return `#${Math.floor((s / 2 ** 31) * 0xffffff)
      .toString(16)
      .padStart(6, '0')}`
  }
}

describe('şablon renkleri: her metin/zemin çifti ≥ 4.5:1', () => {
  it('her şablonun çift listesi var', () => {
    expect(Object.keys(PAIRS).sort()).toEqual(TEMPLATE_LIST.map((t) => t.id).sort())
  })

  it('hazır renk takımlarında (elle seçilmiş tonlar dahil)', () => {
    const problems = TEMPLATE_LIST.flatMap((t) =>
      t.colorSets.flatMap((set) => {
        const settings = { accentColor: set.accent, baseColor: set.base ?? null }
        expect(activeColorSet(t, settings)?.id).toBe(set.id)
        return failures(t, varsFor(t, set.accent, set.base ?? null, set.vars), `takım ${set.id}`)
      }),
    )
    expect(problems).toEqual([])
  })

  it('rastgele özel vurgu (ve zemin) renklerinde', () => {
    const next = randomColors(20261018)
    const problems: string[] = []
    for (const t of TEMPLATE_LIST) {
      const usesBase = t.colorSets.some((s) => s.base)
      for (let i = 0; i < 1500; i++) {
        const accent = next()
        const base = usesBase ? next() : null
        problems.push(...failures(t, varsFor(t, accent, base), `vurgu ${accent}${base ? ` zemin ${base}` : ''}`))
      }
      // Uç değerler: siyah, beyaz, orta gri, saf renkler.
      for (const accent of ['#000000', '#ffffff', '#777777', '#ff0000', '#00ff00', '#0000ff', '#ffff00']) {
        for (const base of usesBase ? ['#000000', '#ffffff', '#767676', '#42904b', '#ff0b13'] : [null]) {
          problems.push(...failures(t, varsFor(t, accent, base), `uç ${accent} ${base ?? ''}`))
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([])
  })

  it('kontrast koruması yuvarlanmış hex üzerinden denetler (4.49 çıkmaz)', () => {
    const next = randomColors(7)
    for (let i = 0; i < 3000; i++) {
      const fg = next()
      const bg = next()
      const out = ensureContrast(fg, bg)
      expect(out).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrast(out, bg), `${fg} / ${bg} → ${out}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  it('aynı zeminde bütün on-* renkleri aynı kutupta (beyaz ad + siyah unvan olmaz)', () => {
    // Zeminden açık mı koyu mu: ≥ 4.5:1 okunan metin ikisinden biridir.
    const pole = (text: string, bg: string) => (luminance(text) > luminance(bg) ? 'açık' : 'koyu')
    const mixed = (color: string) => {
      const v = colorVariables({ accent: color, base: color, paper: '#ffffff' })
      const accent = [v['--on-accent'], v['--on-accent-dim'], v['--on-accent-muted']].map((c) => pole(c, color))
      const base = [v['--on-base'], v['--on-base-dim'], v['--on-base-muted']].map((c) => pole(c, color))
      return new Set(accent).size > 1 || new Set(base).size > 1 ? `${color}: ${accent.join('/')} · ${base.join('/')}` : null
    }
    // İnceleme örnekleri: onColor'ın beyazı seçtiği ama eski eşiğin (L < 0.18) "açık" saydığı bant.
    for (const color of ['#e03131', '#d63384', '#c94f00', '#008577', '#767676']) {
      const v = colorVariables({ accent: color, base: color, paper: '#ffffff' })
      expect(mixed(color), color).toBeNull()
      for (const name of ['--on-accent', '--on-accent-dim', '--on-accent-muted', '--on-base', '--on-base-dim', '--on-base-muted'] as const) {
        expect(contrast(v[name], color), `${name} / ${color}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      }
    }
    // RGB taraması, colorVariables'ın kullandığı aynı fonksiyon ve oranlarla: bütün küp 15'er adımla
    // (18³ renk), kutbun değiştiği parlaklık bandı (beyaz/koyu sınırı ≈ 0.18) 5'er adımla (52³ içinden
    // bandda kalanlar). Bandın dışında üç ton da aynı uca (beyaz ya da koyu) uzaktır.
    const lum = Array.from({ length: 256 }, (_, v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    const candidates: [number, number, number][] = []
    for (let r = 0; r <= 255; r += 5) {
      for (let g = 0; g <= 255; g += 5) {
        for (let b = 0; b <= 255; b += 5) {
          const l = 0.2126 * lum[r] + 0.7152 * lum[g] + 0.0722 * lum[b]
          if ((r % 15 === 0 && g % 15 === 0 && b % 15 === 0) || (l > 0.15 && l < 0.22)) candidates.push([r, g, b])
        }
      }
    }
    expect(candidates.length).toBeGreaterThan(10_000)
    const problems: string[] = []
    for (const rgb of candidates) {
      const bg = toHex(rgb)
      for (const [dim, muted] of [
        [0.12, 0.22],
        [0.1, 0.32],
      ]) {
        const tones = Object.values(onTones(bg, dim, muted))
        if (new Set(tones.map((c) => pole(c, bg))).size > 1) problems.push(`${bg}: ${tones.join(' ')}`)
        if (tones.some((c) => contrast(c, bg) < MIN_TEXT_CONTRAST)) problems.push(`${bg} okunmuyor: ${tones.join(' ')}`)
      }
    }
    expect(problems.slice(0, 20)).toEqual([])
  })

  it('kontrast yönü onColor ile aynı: koyu sayılan zeminde beyaza, açıkta siyaha', () => {
    for (const bg of ['#e03131', '#d63384', '#c94f00', '#008577', '#767676']) {
      expect(onColor(bg)).toBe('#ffffff')
      expect(isDark(bg)).toBe(true)
      // Zeminin kendisi metin olarak okunmaz; düzeltme beyaza doğru gider.
      expect(luminance(ensureContrast(bg, bg))).toBeGreaterThan(luminance(bg))
    }
    expect(isDark('#787878')).toBe(false)
    expect(luminance(ensureContrast('#787878', '#787878'))).toBeLessThan(luminance('#787878'))
  })

  it('inceleme örnekleri: zemin renkli kâğıtta (#42904b, #ff0b13) metin okunur', () => {
    for (const base of ['#42904b', '#ff0b13']) {
      const v = colorVariables({ accent: '#d4a85a', base, paper: 'base' })
      expect(contrast(v['--ink'], v['--paper'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(v['--muted'], v['--paper'])).toBeGreaterThanOrEqual(4.5)
    }
  })
})
