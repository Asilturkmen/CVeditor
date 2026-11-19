/**
 * Şablonların veri kaydı: kimlik, sıra, desteklenen sütunlar, renk takımları,
 * yazı tipleri, etiketler, motor kancaları ve ölçek. Görünüm (CSS) templates.ts'te bağlanır.
 * Şartname: docs/sablonlar/SET-14.md (§3 her şablonun kaydı, §3.0 kancalar K1-K7).
 *
 * Bu dosya bilerek hiçbir şey içe aktarmaz: uçtan uca testler (e2e/ats.spec.ts)
 * onu Node'da doğrudan okur ve ATS matrisini buradan kurar. Bu yüzden yalnız düz
 * veri ve tür yazılır; Vite'a özgü içe aktarma (`?raw`) ya da `@/` yolu yok.
 */

/** Hex renk, `#rrggbb` */
export type Hex = `#${string}`

/** Bir şablonun uyumlu renk takımı. İlki şablonun varsayılanıdır. */
export interface ColorSet {
  /** Ad mesaj anahtarı: `color_<id>` (messages/*.json) */
  id: string
  /** Vurgu rengi (TemplateSettings.accentColor) */
  accent: Hex
  /** Zemin rengi (TemplateSettings.baseColor): renk bloğu ayrı bir renk taşıyan şablonlarda (Panel'in yan sütunu). */
  base?: Hex
  /**
   * Takım seçiliyken türetilen değişkenlerin yerine geçen elle seçilmiş tonlar (ör. Zarif'in fildişi
   * takımında `--paper`). Metin renklerinin kontrastı colors.test.ts'te bu değerlerle denetlenir.
   */
  vars?: Record<`--${string}`, Hex>
}

/** Kart etiketleri; ad mesaj anahtarı `tag_<id>` */
export type TemplateTag =
  | 'plain'
  | 'serif'
  | 'side_right'
  | 'dark_side'
  | 'dense'
  | 'accent_line'
  | 'band'
  | 'date_column'
  | 'label_column'
  | 'executive'
  | 'photo_large'
  | 'divider'
  | 'editorial'
  | 'bold'

/**
 * Yazı tipi kimlikleri. Gövde aileleri src/cv/schema.ts FONT_IDS'tedir (Görünüm'de
 * seçilir); başlık aileleri yalnız şablonların ad ve başlıklarında kullanılır
 * (src/render/fonts.ts DISPLAY_FONTS). İkisi de scripts/copy-fonts.mjs ile sunulur.
 */
export type BodyFontKey =
  | 'inter'
  | 'ibm-plex-sans'
  | 'source-sans-3'
  | 'source-serif-4'
  | 'literata'
  | 'eb-garamond'
  | 'archivo'
  | 'manrope'
  | 'space-grotesk'
  | 'libre-franklin'
export type DisplayFontKey = 'poppins' | 'dm-serif-display' | 'playfair-display' | 'ibm-plex-mono' | 'fraunces'
export type FontKey = BodyFontKey | DisplayFontKey

/**
 * K4: şablonun ölçek çarpanları. `cvVariables` Görünüm'deki boy/aralık ayarının değerini bunlarla
 * çarpıp yazar (CSS'te `--pad-x: calc(var(--pad-x) * .8)` döngü olurdu). Hepsi "orta boy, normal
 * aralık"a göre: --fs 9.75pt, --lh 1.4, --block-gap 3mm, --section-gap 5.6mm, --pad-x 16mm, --pad-y 14mm.
 */
export interface TemplateScale {
  /** Gövde yazı boyu (`--fs`) */
  fs?: number
  /** Satır aralığı (`--lh`) */
  lh?: number
  /** Kayıtlar arası (`--block-gap`) */
  blockGap?: number
  /** Bölümler arası (`--section-gap`) */
  sectionGap?: number
  /** Yan kenar boşluğu (`--pad-x`) */
  padX?: number
  /** Üst/alt kenar boşluğu (`--pad-y`) */
  padY?: number
}

export interface TemplateMeta {
  id: string
  /** Desteklenen sütun sayıları; ilki varsayılan. Tek değer varsa Görünüm'de sütun seçeneği gizlenir. */
  columns: readonly (1 | 2)[]
  tags: readonly TemplateTag[]
  colorSets: readonly ColorSet[]
  fonts: {
    /** Varsayılan gövde ailesi (TemplateSettings.font); kullanıcı Görünüm'de değiştirebilir */
    body: BodyFontKey
    /** Ad, unvan ve bölüm başlıkları için şablonun sabit ailesi: `--font-display` */
    display: FontKey
    /** Tarih/iletişim gibi eş aralıklı yerler (yoksa gövde): `--font-mono` */
    mono?: FontKey
  }
  /**
   * Metnin üstünde durduğu kâğıt rengi. `'base'`: sayfanın tamamı zemin renginde; metin renkleri
   * zeminden türetilir (bu sette kullanan yok; colors.ts destekler). Kontrast koruması buna göre hesaplanır.
   */
  paper: Hex | 'base'
  /** Açık kâğıtta metin, soluk metin ve çizgi renkleri (`paper: 'base'` ise türetilir) */
  ink?: Hex
  muted?: Hex
  rule?: Hex
  /** Sayfa renkle kaplı: Görünüm'de yazıcı mürekkebi notu */
  inkHeavy?: boolean
  headerAlign: 'left' | 'center'
  /** K1: tarih DOM'da kayıt başlığından önce (`.entry-head.date-first > .entry-date + .entry-title`) */
  datePosition?: 'start'
  /** K2: iki sütunda yan sütun sağda ve DOM'da ana sütundan sonra (kök `side-end`) */
  sidePosition?: 'end'
  /** K4: ölçek çarpanları */
  scale?: TemplateScale
}

export const TEMPLATE_META = [
  {
    id: 'yalin',
    columns: [1],
    tags: ['plain'],
    colorSets: [
      { id: 'celik', accent: '#2f4a66' },
      { id: 'siyah', accent: '#1f1f1f' },
      { id: 'petrol', accent: '#0f5c6e' },
      { id: 'bordo', accent: '#7a2e2e' },
      { id: 'orman', accent: '#2f5d50' },
    ],
    fonts: { body: 'inter', display: 'inter' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5b6675',
    rule: '#d9dee5',
    headerAlign: 'left',
    scale: { fs: 0.9, lh: 1, blockGap: 0.9, sectionGap: 1.071, padX: 1.125, padY: 1 },
  },
  {
    id: 'zarif',
    columns: [1],
    tags: ['serif'],
    colorSets: [
      { id: 'bordo', accent: '#7a2e2e' },
      { id: 'lacivert', accent: '#1f3a5f' },
      { id: 'orman', accent: '#2f5d50' },
      { id: 'siyah', accent: '#26221d' },
      { id: 'fildisi', accent: '#6b3a2a', vars: { '--paper': '#fbf8f1', '--rule': '#d8cdb9' } },
    ],
    fonts: { body: 'eb-garamond', display: 'eb-garamond' },
    paper: '#ffffff',
    ink: '#26221d',
    muted: '#6b6359',
    rule: '#d9d2c5',
    headerAlign: 'center',
    scale: { fs: 1.046, lh: 0.914, blockGap: 0.767, sectionGap: 0.786, padX: 1.25, padY: 0.929 },
  },
  {
    id: 'ikili',
    columns: [2],
    sidePosition: 'end',
    tags: ['side_right'],
    colorSets: [
      { id: 'mavi', accent: '#1f5fbf' },
      { id: 'siyah', accent: '#1c1c1c' },
      { id: 'zumrut', accent: '#0b6e4f' },
      { id: 'bordo', accent: '#8c2f39' },
      { id: 'turuncu', accent: '#b4532a' },
    ],
    fonts: { body: 'libre-franklin', display: 'libre-franklin' },
    paper: '#ffffff',
    ink: '#161616',
    muted: '#5f5f5f',
    rule: '#d4d4d4',
    headerAlign: 'left',
    scale: { fs: 0.944, lh: 1.014, blockGap: 1, sectionGap: 1.25, padX: 0.9375, padY: 1 },
  },
  {
    id: 'panel',
    columns: [2],
    tags: ['dark_side'],
    colorSets: [
      { id: 'lacivert', accent: '#1f4e79', base: '#1c2b3f' },
      { id: 'orman', accent: '#256b52', base: '#1d3a30' },
      { id: 'komur', accent: '#3d4651', base: '#25282d' },
      { id: 'bordo', accent: '#7d2a3c', base: '#4a1f2a' },
      { id: 'sis', accent: '#1f3a5f', base: '#e8ecf1' },
    ],
    fonts: { body: 'source-sans-3', display: 'source-serif-4' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5b6675',
    rule: '#d9dee5',
    headerAlign: 'left',
    scale: { fs: 1, lh: 1, blockGap: 1, sectionGap: 1.143, padX: 0.8125, padY: 1 },
  },
  {
    id: 'teknik',
    columns: [1],
    tags: ['dense'],
    colorSets: [
      { id: 'siyah', accent: '#111111' },
      { id: 'lacivert', accent: '#1f3a5f' },
      { id: 'bordo', accent: '#6e1f2b' },
    ],
    fonts: { body: 'source-serif-4', display: 'source-serif-4' },
    paper: '#ffffff',
    ink: '#111111',
    muted: '#4d4d4d',
    rule: '#111111',
    headerAlign: 'left',
    scale: { fs: 0.975, lh: 0.95, blockGap: 0.733, sectionGap: 0.786, padX: 0.8125, padY: 0.857 },
  },
  {
    id: 'cizgi',
    columns: [1],
    tags: ['accent_line'],
    colorSets: [
      { id: 'mavi', accent: '#1d4e89' },
      { id: 'camgobegi', accent: '#0f766e' },
      { id: 'kirmizi', accent: '#b3261e' },
      { id: 'grafit', accent: '#374151' },
      { id: 'murdum', accent: '#5b2a4e' },
    ],
    fonts: { body: 'source-sans-3', display: 'source-sans-3' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5b6675',
    rule: '#d9dee5',
    headerAlign: 'left',
    scale: { fs: 1, lh: 0.943, blockGap: 0.867, sectionGap: 0.929, padX: 1.0625, padY: 1.071 },
  },
  {
    id: 'bant',
    columns: [1, 2],
    tags: ['band'],
    colorSets: [
      { id: 'lacivert', accent: '#14365a' },
      { id: 'zumrut', accent: '#0b5d4b' },
      { id: 'murdum', accent: '#5b2a4e' },
      { id: 'grafit', accent: '#2b2f36' },
      { id: 'petrol', accent: '#0d5463' },
    ],
    fonts: { body: 'inter', display: 'literata' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5b6675',
    rule: '#d9dee5',
    headerAlign: 'left',
    scale: { fs: 0.92, lh: 0.957, blockGap: 0.767, sectionGap: 0.875, padX: 1.0625, padY: 1 },
  },
  {
    id: 'cizelge',
    columns: [1],
    datePosition: 'start',
    tags: ['date_column'],
    colorSets: [
      { id: 'celik', accent: '#3b5b7a' },
      { id: 'grafit', accent: '#4a4f57' },
      { id: 'orman', accent: '#2f5d50' },
      { id: 'bordo', accent: '#7a2e2e' },
    ],
    fonts: { body: 'archivo', display: 'archivo' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5b6675',
    rule: '#d9dee5',
    headerAlign: 'left',
    scale: { fs: 0.92, lh: 0.979, blockGap: 0.867, sectionGap: 0.893, padX: 1, padY: 1 },
  },
  {
    id: 'isvicre',
    columns: [1],
    tags: ['label_column'],
    colorSets: [
      { id: 'kirmizi', accent: '#c62828' },
      { id: 'kobalt', accent: '#1f4fd1' },
      { id: 'siyah', accent: '#161616' },
      { id: 'orman', accent: '#1f6b4f' },
    ],
    fonts: { body: 'ibm-plex-sans', display: 'ibm-plex-sans' },
    paper: '#ffffff',
    ink: '#161616',
    muted: '#5f5f5f',
    rule: '#cfcfcf',
    headerAlign: 'left',
    scale: { fs: 0.944, lh: 1.036, blockGap: 0.933, sectionGap: 1, padX: 1, padY: 1.071 },
  },
  {
    id: 'yonetici',
    columns: [1],
    tags: ['executive'],
    colorSets: [
      { id: 'siyah', accent: '#1a1a1a' },
      { id: 'lacivert', accent: '#1b2f4b' },
      { id: 'bordo', accent: '#6e1f2b' },
      { id: 'orman', accent: '#234a3d' },
    ],
    fonts: { body: 'literata', display: 'literata' },
    paper: '#ffffff',
    ink: '#1a1a1a',
    muted: '#5f5f5f',
    rule: '#1a1a1a',
    headerAlign: 'left',
    scale: { fs: 0.94, lh: 0.957, blockGap: 0.867, sectionGap: 0.929, padX: 1.1875, padY: 1 },
  },
  {
    id: 'portre',
    columns: [1, 2],
    tags: ['photo_large'],
    colorSets: [
      { id: 'mavi', accent: '#1f5fa8' },
      { id: 'petrol', accent: '#0f5c6e' },
      { id: 'grafit', accent: '#374151' },
      { id: 'bordo', accent: '#8c2f39' },
      { id: 'zumrut', accent: '#0b6e4f' },
    ],
    fonts: { body: 'inter', display: 'manrope' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5b6675',
    rule: '#d9dee5',
    headerAlign: 'left',
    scale: { fs: 0.92, lh: 0.971, blockGap: 0.8, sectionGap: 0.964, padX: 1.0625, padY: 1 },
  },
  {
    id: 'denge',
    columns: [2, 1],
    tags: ['divider'],
    colorSets: [
      { id: 'grafit', accent: '#2f343b' },
      { id: 'lacivert', accent: '#1f3a5f' },
      { id: 'adacayi', accent: '#4c6a57' },
      { id: 'toprak', accent: '#8a5a3c' },
      { id: 'murdum', accent: '#5b2a4e' },
    ],
    fonts: { body: 'source-sans-3', display: 'poppins' },
    paper: '#ffffff',
    ink: '#1f2328',
    muted: '#5f666e',
    rule: '#cfd3d8',
    headerAlign: 'center',
    scale: { fs: 1, lh: 1, blockGap: 0.933, sectionGap: 1.071, padX: 0.9375, padY: 1.071 },
  },
  {
    id: 'dergi',
    columns: [2, 1],
    tags: ['editorial'],
    colorSets: [
      { id: 'kiremit', accent: '#a63d1e' },
      { id: 'lacivert', accent: '#1f3a5f' },
      { id: 'orman', accent: '#2f5d50' },
      { id: 'siyah', accent: '#161616' },
      { id: 'bordo', accent: '#8c2f39' },
    ],
    fonts: { body: 'source-serif-4', display: 'fraunces' },
    paper: '#ffffff',
    ink: '#161616',
    muted: '#5f5f5f',
    rule: '#d4d4d4',
    headerAlign: 'left',
    scale: { fs: 0.97, lh: 0.986, blockGap: 0.8, sectionGap: 0.964, padX: 1.125, padY: 1 },
  },
  {
    id: 'blok',
    columns: [1, 2],
    tags: ['bold'],
    colorSets: [
      { id: 'sari', accent: '#ffd84d' },
      { id: 'kum', accent: '#e9dfcf' },
      { id: 'buz', accent: '#d3e4f0' },
      { id: 'nane', accent: '#d3e9da' },
      { id: 'siyahbeyaz', accent: '#ffffff' },
    ],
    fonts: { body: 'archivo', display: 'archivo' },
    paper: '#ffffff',
    ink: '#111111',
    muted: '#595959',
    rule: '#d4d4d4',
    headerAlign: 'left',
    scale: { fs: 0.92, lh: 0.986, blockGap: 0.833, sectionGap: 1, padX: 1.25, padY: 1 },
  },
] as const satisfies readonly TemplateMeta[]

export type TemplateId = (typeof TEMPLATE_META)[number]['id']

/** Varsayılan şablon; bilinmeyen kimlik buna düşer. */
export const DEFAULT_TEMPLATE_ID: TemplateId = 'yalin'
