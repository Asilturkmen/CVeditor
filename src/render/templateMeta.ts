/**
 * Şablonların veri kaydı: kimlik, sıra, desteklenen sütunlar, renk takımları,
 * yazı tipleri, etiketler. Görünüm (CSS) templates.ts'te bağlanır.
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
  /**
   * Zemin rengi (TemplateSettings.baseColor): renk bloğu ayrı bir renk taşıyan
   * şablonlarda (Panel'in yan sütunu, Gece'nin sayfası, Çift Ton'un koyu yarısı).
   */
  base?: Hex
  /** Takım seçiliyken türetilen değişkenlerin yerine geçen elle seçilmiş tonlar (ör. `--base-soft`) */
  vars?: Record<`--${string}`, Hex>
}

/** Kart etiketleri; ad mesaj anahtarı `tag_<id>` */
export type TemplateTag = 'serif' | 'dark_side' | 'band' | 'big_name' | 'dark' | 'label_column' | 'timeline' | 'highlight' | 'frame'

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
export type DisplayFontKey = 'poppins' | 'dm-serif-display' | 'playfair-display' | 'ibm-plex-mono' | 'fraunces'
export type FontKey = BodyFontKey | DisplayFontKey

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
   * Metnin üstünde durduğu kâğıt rengi. `'base'`: sayfanın tamamı zemin renginde
   * (Gece, Çift Ton); metin renkleri zeminden türetilir. Kontrast koruması buna göre hesaplanır.
   */
  paper: Hex | 'base'
  /** Açık kâğıtta metin, soluk metin ve çizgi renkleri (`paper: 'base'` ise türetilir) */
  ink?: Hex
  muted?: Hex
  rule?: Hex
  /** Sayfa renkle kaplı: Görünüm'de yazıcı mürekkebi notu */
  inkHeavy?: boolean
  headerAlign: 'left' | 'center'
}

export const TEMPLATE_META = [
  {
    id: 'zarif',
    columns: [1],
    tags: ['serif'],
    colorSets: [
      { id: 'bordo', accent: '#7a2e2e' },
      { id: 'lacivert', accent: '#1f3a5f' },
      { id: 'orman', accent: '#2f5d50' },
    ],
    fonts: { body: 'eb-garamond', display: 'eb-garamond' },
    paper: '#fbf8f1',
    ink: '#2b2621',
    muted: '#756c60',
    rule: '#d8cdb9',
    headerAlign: 'center',
  },
  {
    id: 'panel',
    columns: [2],
    tags: ['dark_side'],
    colorSets: [
      { id: 'lacivert', accent: '#2f8f7f', base: '#1f2a37' },
      { id: 'orman', accent: '#c9a45c', base: '#1e3a2f' },
      { id: 'bordo', accent: '#e0a96d', base: '#4a1f2a' },
      { id: 'komur', accent: '#5aa9e6', base: '#22252a' },
    ],
    fonts: { body: 'inter', display: 'inter' },
    paper: '#ffffff',
    ink: '#1c2430',
    muted: '#5d6b7c',
    rule: '#dde2e8',
    headerAlign: 'left',
  },
  {
    id: 'bant',
    columns: [2, 1],
    tags: ['band'],
    colorSets: [
      { id: 'mavi', accent: '#0f4c75', vars: { '--accent-soft': '#eef5f9' } },
      { id: 'zumrut', accent: '#0b5d4b' },
      { id: 'murdum', accent: '#5b2a4e' },
      { id: 'grafit', accent: '#2b2f36' },
    ],
    fonts: { body: 'source-sans-3', display: 'poppins' },
    paper: '#ffffff',
    ink: '#1d2939',
    muted: '#667085',
    rule: '#e4e7ec',
    headerAlign: 'left',
  },
  {
    id: 'manset',
    columns: [2, 1],
    tags: ['big_name'],
    colorSets: [
      { id: 'turuncu', accent: '#c2410c' },
      { id: 'kirmizi', accent: '#b91c1c' },
      { id: 'mavi', accent: '#1d4ed8' },
    ],
    fonts: { body: 'archivo', display: 'dm-serif-display' },
    paper: '#ffffff',
    ink: '#111111',
    muted: '#666666',
    rule: '#d4d4d4',
    headerAlign: 'left',
  },
  {
    id: 'gece',
    columns: [1],
    tags: ['dark'],
    colorSets: [
      { id: 'gece', accent: '#d4a85a', base: '#14171f', vars: { '--ink': '#ece6d9', '--muted': '#a39b8b' } },
      { id: 'orman', accent: '#e2b866', base: '#0f2a24' },
      { id: 'murdum', accent: '#e8b4a0', base: '#2a1420' },
      { id: 'kobalt', accent: '#f6e36b', base: '#2340c9' },
    ],
    fonts: { body: 'inter', display: 'playfair-display' },
    paper: 'base',
    inkHeavy: true,
    headerAlign: 'left',
  },
  {
    id: 'isvicre',
    columns: [1],
    tags: ['label_column'],
    colorSets: [
      { id: 'kirmizi', accent: '#d62828' },
      { id: 'kobalt', accent: '#1f4fd1' },
      { id: 'siyah', accent: '#161616' },
    ],
    fonts: { body: 'ibm-plex-sans', display: 'ibm-plex-sans', mono: 'ibm-plex-mono' },
    paper: '#ffffff',
    ink: '#161616',
    muted: '#6e6e6e',
    rule: '#d6d6d6',
    headerAlign: 'left',
  },
  {
    id: 'cizelge',
    columns: [1],
    tags: ['timeline'],
    colorSets: [
      { id: 'turuncu', accent: '#e0663a', vars: { '--accent-ink': '#9a3412' } },
      { id: 'camgobegi', accent: '#0f766e', vars: { '--accent-ink': '#115e59' } },
      { id: 'indigo', accent: '#4f46e5', vars: { '--accent-ink': '#3730a3' } },
    ],
    fonts: { body: 'manrope', display: 'manrope' },
    paper: '#ffffff',
    ink: '#1d2433',
    muted: '#667085',
    rule: '#d0d5dd',
    headerAlign: 'left',
  },
  {
    id: 'cift',
    columns: [2],
    tags: ['dark'],
    colorSets: [
      { id: 'indigo', accent: '#ffcf70', base: '#3d3a7a', vars: { '--base-soft': '#e7e3f7', '--base-ink': '#25224a', '--base-ink-muted': '#5d5893' } },
      { id: 'adacayi', accent: '#f2c46d', base: '#2f4a3a', vars: { '--base-soft': '#e3ece4' } },
      { id: 'kum', accent: '#ffd9a8', base: '#7a3b2e', vars: { '--base-soft': '#f1e7da' } },
    ],
    fonts: { body: 'space-grotesk', display: 'space-grotesk' },
    paper: 'base',
    inkHeavy: true,
    headerAlign: 'left',
  },
  {
    id: 'afis',
    columns: [2, 1],
    tags: ['highlight'],
    colorSets: [
      { id: 'sari', accent: '#ffd400' },
      { id: 'neon', accent: '#b6f36b' },
      { id: 'mercan', accent: '#ff8a7a' },
      { id: 'siyahbeyaz', accent: '#ffffff' },
    ],
    fonts: { body: 'archivo', display: 'archivo' },
    paper: '#ffffff',
    ink: '#0b0b0b',
    muted: '#555555',
    rule: '#d4d4d4',
    headerAlign: 'left',
  },
  {
    id: 'cerceve',
    columns: [2, 1],
    tags: ['frame'],
    colorSets: [
      { id: 'bordo', accent: '#8c2f39' },
      { id: 'orman', accent: '#2f5d50' },
      { id: 'lacivert', accent: '#1f3a5f' },
      { id: 'hardal', accent: '#b7791f' },
    ],
    fonts: { body: 'source-sans-3', display: 'fraunces' },
    paper: '#fffdf8',
    ink: '#23262b',
    muted: '#6b6f76',
    rule: '#e4d9cf',
    headerAlign: 'left',
  },
] as const satisfies readonly TemplateMeta[]

export type TemplateId = (typeof TEMPLATE_META)[number]['id']

/** Varsayılan şablon; bilinmeyen kimlik buna düşer. */
export const DEFAULT_TEMPLATE_ID: TemplateId = 'zarif'
