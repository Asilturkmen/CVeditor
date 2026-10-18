import { describe, expect, it } from 'vitest'
import { colorVariables, contrast, ensureContrast, mix, MIN_TEXT_CONTRAST, toHex } from './colors'
import { activeColorSet, TEMPLATE_LIST, type TemplateDef, type TemplateId } from './templates'

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

const cm = (a: Color, percent: number, b: Color): Color => ({ mix: [a, percent, b] })

const COMMON: Pair[] = [
  ['--ink', '--paper', 'metin'],
  ['--muted', '--paper', 'soluk metin'],
  ['--accent-ink', '--paper', 'vurgu metni'],
]

const PAIRS: Record<TemplateId, Pair[]> = {
  zarif: [[cm('--ink', 82, '--muted'), '--paper', 'özet']],
  panel: [
    ['--on-base', '--base', 'yan sütun başlığı ve kayıt adı'],
    ['--on-base-dim', '--base', 'yan sütun metni'],
    ['--on-base-muted', '--base', 'yan sütun tarih/alt satır'],
  ],
  bant: [
    ['--on-accent', '--accent', 'bantta ad'],
    ['--on-accent-dim', '--accent', 'bantta unvan'],
    ['--on-accent-muted', '--accent', 'bantta iletişim'],
    ['--ink', '--accent-soft', 'yan kart metni'],
    ['--muted', '--accent-soft', 'yan kart tarihi'],
    ['--accent-ink', '--accent-soft', 'yan kart başlığı ve alt satırı'],
  ],
  manset: [[cm('--ink', 82, '--paper'), '--paper', 'iletişim']],
  gece: [['--on-base', '--paper', 'kayıt adı']],
  isvicre: [[cm('--ink', 84, '--paper'), '--paper', 'iletişim']],
  cizelge: [[cm('--accent-ink', 82, '--ink'), cm('--accent', 13, '--paper'), 'tarih hapı']],
  cift: [
    ['--on-base', '--paper', 'koyu yarıda ad ve kayıt adı'],
    ['--base-ink', '--base-soft', 'açık yarı metni ve başlığı'],
    ['--base-ink-muted', '--base-soft', 'açık yarı tarihi'],
  ],
  afis: [
    ['--ink', '--accent-mark', 'fosforlu kalem altında ad ve unvan'],
    ['--paper', '--ink', 'siyah etiket kutusunda bölüm başlığı'],
  ],
  cerceve: [],
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

  it('inceleme örnekleri: Çift Ton #42904b ve Gece #ff0b13 zemininde metin okunur', () => {
    const cift = TEMPLATE_LIST.find((t) => t.id === 'cift')!
    const gece = TEMPLATE_LIST.find((t) => t.id === 'gece')!
    const a = varsFor(cift, '#ffcf70', '#42904b')
    expect(contrast(a['--ink'], a['--paper'])).toBeGreaterThanOrEqual(4.5)
    const b = varsFor(gece, '#d4a85a', '#ff0b13')
    expect(contrast(b['--ink'], b['--paper'])).toBeGreaterThanOrEqual(4.5)
  })
})
