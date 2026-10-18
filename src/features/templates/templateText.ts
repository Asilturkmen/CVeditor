import { m } from '@/paraglide/messages'
import { TEMPLATE_LIST, type TemplateDef, type TemplateId, type TemplateTag } from '@/render/templates'

const TAG_TEXT: Record<TemplateTag, () => string> = {
  serif: () => m.tag_serif(),
  dark_side: () => m.tag_dark_side(),
  band: () => m.tag_band(),
  big_name: () => m.tag_big_name(),
  dark: () => m.tag_dark(),
  label_column: () => m.tag_label_column(),
  timeline: () => m.tag_timeline(),
  highlight: () => m.tag_highlight(),
  frame: () => m.tag_frame(),
}

/** Şablonun sütun düzeni etiketi: "Tek sütun", "İki sütun" ya da "Tek ya da iki sütun". */
function layoutText(template: TemplateDef): string {
  if (template.columns.length > 1) return m.tag_columns_both()
  return template.columns[0] === 2 ? m.layout_two_columns() : m.layout_one_column()
}

export interface TemplateText {
  name: () => string
  description: () => string
  /** Sütun düzeni etiketi */
  layout: () => string
  /** Kart etiketleri: sütun düzeni + şablonu ayırt eden özellikler */
  tags: () => string[]
}

/** Şablonların arayüzdeki adı, açıklaması ve etiketleri (mesaj anahtarları TemplateDef'te). */
export const TEMPLATE_TEXT = Object.fromEntries(
  TEMPLATE_LIST.map((template) => [
    template.id,
    {
      name: () => m[template.nameKey](),
      description: () => m[template.descKey](),
      layout: () => layoutText(template),
      tags: () => [layoutText(template), ...template.tags.map((tag) => TAG_TEXT[tag]())],
    },
  ]),
) as unknown as Record<TemplateId, TemplateText>

/** Renk takımının adı (`color_<id>`) */
export function colorSetName(id: string): string {
  const key = `color_${id}` as keyof typeof m
  const fn = m[key] as unknown
  return typeof fn === 'function' ? (fn as () => string)() : id
}
