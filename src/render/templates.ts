import { DEFAULT_SIDE_TYPES } from '@/cv/sample'
import type { Cv, FontId, Section, TemplateSettings } from '@/cv/schema'
import bantCss from './styles/bant.css?raw'
import blokCss from './styles/blok.css?raw'
import cizelgeCss from './styles/cizelge.css?raw'
import cizgiCss from './styles/cizgi.css?raw'
import dengeCss from './styles/denge.css?raw'
import dergiCss from './styles/dergi.css?raw'
import ikiliCss from './styles/ikili.css?raw'
import isvicreCss from './styles/isvicre.css?raw'
import panelCss from './styles/panel.css?raw'
import portreCss from './styles/portre.css?raw'
import teknikCss from './styles/teknik.css?raw'
import yalinCss from './styles/yalin.css?raw'
import yoneticiCss from './styles/yonetici.css?raw'
import zarifCss from './styles/zarif.css?raw'
import { DEFAULT_TEMPLATE_ID, TEMPLATE_META, type BodyFontKey, type ColorSet, type TemplateId, type TemplateMeta } from './templateMeta'

export type { ColorSet, TemplateId, TemplateTag } from './templateMeta'

/**
 * Şablon = ortak çizim motorunun üstünde ayar + küçük stil.
 * Yeni şablon eklemek ayrı bir kod yığını değil, bir CSS dosyası ve
 * templateMeta.ts'te bir kayıttır. Bütün şablonlar aynı HTML'i (renderCv) kullanır.
 */
export interface TemplateDef extends Omit<TemplateMeta, 'id'> {
  id: TemplateId
  /** Ad ve açıklama mesaj anahtarları (messages/*.json) */
  nameKey: `template_${TemplateId}_name`
  descKey: `template_${TemplateId}_desc`
  css: string
  defaults: Omit<TemplateSettings, 'sideSections'>
}

// Kayıttaki gövde aileleri şemadaki FONT_IDS ile aynı küme olmalı (iki yönlü denetim).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const fontKeysMatch: Same<BodyFontKey, FontId> = true
void fontKeysMatch

const CSS: Record<TemplateId, string> = {
  yalin: yalinCss,
  zarif: zarifCss,
  ikili: ikiliCss,
  panel: panelCss,
  teknik: teknikCss,
  cizgi: cizgiCss,
  bant: bantCss,
  cizelge: cizelgeCss,
  isvicre: isvicreCss,
  yonetici: yoneticiCss,
  portre: portreCss,
  denge: dengeCss,
  dergi: dergiCss,
  blok: blokCss,
}

function define(meta: TemplateMeta & { id: TemplateId }): TemplateDef {
  return {
    ...meta,
    id: meta.id,
    nameKey: `template_${meta.id}_name`,
    descKey: `template_${meta.id}_desc`,
    css: CSS[meta.id],
    defaults: {
      accentColor: meta.colorSets[0].accent,
      baseColor: null,
      font: meta.fonts.body,
      fontSize: 'md',
      spacing: 'normal',
      columns: meta.columns[0],
      // Fotoğraf önce: yeni CV'de açık; fotoğraf yüklenmemişse düzen fotoğrafsız çizilir.
      showPhoto: true,
      headerAlign: meta.headerAlign,
    },
  }
}

/** Galerideki ve Görünüm'deki sıra */
export const TEMPLATE_LIST: TemplateDef[] = TEMPLATE_META.map((meta) => define(meta))

export const TEMPLATES = Object.fromEntries(TEMPLATE_LIST.map((t) => [t.id, t])) as Record<TemplateId, TemplateDef>

export function isTemplateId(id: string): id is TemplateId {
  return Object.hasOwn(TEMPLATES, id)
}

/** Bilinmeyen kimlik (eski ya da bozuk kayıt) varsayılan şablona (Yalın) düşer. */
export function getTemplate(id: string): TemplateDef {
  return isTemplateId(id) ? TEMPLATES[id] : TEMPLATES[DEFAULT_TEMPLATE_ID]
}

/** Şablonun desteklemediği sütun sayısı desteklenen en yakın değere çekilir. */
export function supportedColumns(template: TemplateDef, columns: number): 1 | 2 {
  if ((template.columns as readonly number[]).includes(columns)) return columns as 1 | 2
  return template.columns[0]
}

/** Zemin rengi: kullanıcınınki, yoksa şablonun varsayılan takımınınki, o da yoksa vurgu. */
export function resolvedBaseColor(template: TemplateDef, settings: Pick<TemplateSettings, 'accentColor' | 'baseColor'>): string {
  return settings.baseColor ?? template.colorSets[0].base ?? settings.accentColor
}

/** Ayarlar şablonun hazır takımlarından biriyle aynıysa o takım. */
export function activeColorSet(template: TemplateDef, settings: Pick<TemplateSettings, 'accentColor' | 'baseColor'>): ColorSet | null {
  const accent = settings.accentColor.toLowerCase()
  const base = resolvedBaseColor(template, settings).toLowerCase()
  return (
    template.colorSets.find((set) => set.accent.toLowerCase() === accent && (!set.base || set.base.toLowerCase() === base)) ?? null
  )
}

/**
 * Vurgu rengi şablon değişince: eski şablonun hazır takımlarından biri (ya da varsayılanı)
 * seçiliyse yeni şablonun varsayılanı; kullanıcının özel rengiyse aynen kalır.
 */
export function carriedAccent(from: TemplateDef, to: TemplateDef, settings: Pick<TemplateSettings, 'accentColor' | 'baseColor'>): string {
  const preset = activeColorSet(from, settings) !== null || settings.accentColor.toLowerCase() === from.defaults.accentColor.toLowerCase()
  return preset ? to.defaults.accentColor : settings.accentColor
}

/**
 * Şablon değiştirince görünüm ayarları. İçerik değişmez. Kullanıcının değiştirmediği
 * (eski şablonun varsayılanında duran) ayar yeni şablonunkine geçer; kendi seçtiği kalır:
 * - Renk: eski şablonun hazır takımlarından biri seçiliyse yeni şablonun varsayılan takımı;
 *   özel renkse vurgu kalır. Zemin (takıma özgü) her zaman yeni şablonun varsayılanına döner.
 * - Yazı tipi ve başlık hizası: eski varsayılandaysa yeni varsayılan.
 * - Sütun: eski varsayılandaysa yeni varsayılan; değilse desteklenen en yakın değer.
 */
export function settingsForTemplate(from: TemplateDef, to: TemplateDef, settings: TemplateSettings, sections: Section[]): TemplateSettings {
  const next = { ...settings }
  if (from.id === to.id) return next
  next.accentColor = carriedAccent(from, to, settings)
  next.baseColor = null
  if (settings.font === from.defaults.font) next.font = to.defaults.font
  if (settings.headerAlign === from.defaults.headerAlign) next.headerAlign = to.defaults.headerAlign
  next.columns = settings.columns === from.defaults.columns ? to.defaults.columns : supportedColumns(to, settings.columns)
  if (next.columns === 2 && next.sideSections.length === 0) next.sideSections = defaultSideSections(sections)
  return next
}

/**
 * Başka bir CV'den kopyalayarak yeni CV: görünüm yeni şablonun varsayılanları, yalnız vurgu
 * rengi şablon değiştirme kuralıyla (carriedAccent) kaynaktan gelir.
 */
export function templateSettingsForCopy(source: Pick<Cv, 'templateId' | 'template'>, to: TemplateId, sections: Section[]): TemplateSettings {
  return { ...templateSettingsFor(to, sections), accentColor: carriedAccent(getTemplate(source.templateId), TEMPLATES[to], source.template) }
}

export function defaultSideSections(sections: Section[]): string[] {
  return sections
    .filter((s) => (DEFAULT_SIDE_TYPES as readonly string[]).includes(s.type))
    .map((s) => s.id)
}

export function templateSettingsFor(id: TemplateId, sections: Section[]): TemplateSettings {
  return { ...TEMPLATES[id].defaults, sideSections: defaultSideSections(sections) }
}
