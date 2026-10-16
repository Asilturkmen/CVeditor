import { m } from '@/paraglide/messages'
import type { TemplateId } from '@/render/templates'

/** Şablonların arayüzdeki adı, açıklaması ve varsayılan düzen etiketi. */
export const TEMPLATE_TEXT: Record<TemplateId, { name: () => string; description: () => string; layout: () => string }> = {
  klasik: { name: () => m.template_klasik_name(), description: () => m.template_klasik_desc(), layout: () => m.ux_layout_default_one() },
  modern: { name: () => m.template_modern_name(), description: () => m.template_modern_desc(), layout: () => m.ux_layout_default_two() },
}
