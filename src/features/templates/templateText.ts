import { m } from '@/paraglide/messages'
import { TEMPLATE_LIST, type TemplateDef, type TemplateId, type TemplateTag } from '@/render/templates'

/** Ada göre mesaj (`<prefix><id>`); anahtar yoksa kimliğin kendisi (yeni şablon/etiket metni eklenmeden de çökmez). */
function messageFor(prefix: string, id: string): string {
  const fn = m[`${prefix}${id}` as keyof typeof m] as unknown
  return typeof fn === 'function' ? (fn as () => string)() : id
}

/** Kart etiketinin adı (`tag_<id>`); etiket kümesi templateMeta.ts'teki `TemplateTag`. */
export const tagText = (tag: TemplateTag): string => messageFor('tag_', tag)

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
  /** Etiketlerin tek satır düz yazısı: "İki sütun · Koyu yan sütun" (galeri kartı, şablon sayfası) */
  features: () => string
}

const tagsOf = (template: TemplateDef) => [layoutText(template), ...template.tags.map(tagText)]

/** Şablonların arayüzdeki adı, açıklaması ve etiketleri (mesaj anahtarları TemplateDef'te). */
export const TEMPLATE_TEXT = Object.fromEntries(
  TEMPLATE_LIST.map((template) => [
    template.id,
    {
      name: () => messageFor('', template.nameKey),
      description: () => messageFor('', template.descKey),
      layout: () => layoutText(template),
      tags: () => tagsOf(template),
      features: () => tagsOf(template).join(' · '),
    },
  ]),
) as unknown as Record<TemplateId, TemplateText>

/** Renk takımının adı (`color_<id>`) */
export function colorSetName(id: string): string {
  return messageFor('color_', id)
}
