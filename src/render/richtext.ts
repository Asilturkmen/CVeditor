import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['p', 'ul', 'li', 'strong', 'em', 'a', 'br']

/**
 * Açıklama alanları kısıtlı HTML tutar. Kayıtta da çizimde de aynı süzgeç:
 * yalnız madde, kalın, italik, bağlantı. Renk/boyut şablondan gelir.
 */
export function sanitizeRichText(html: string): string {
  if (!html) return ''
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|[a-z0-9.-]+\.[a-z]{2,})/i,
  })
  return clean.replace(/<p><\/p>/g, '')
}

/** Bağlantı adresini tıklanabilir mutlak adrese çevirir ("site.com" → "https://site.com"). */
export function toHref(value: string): string {
  const v = value.trim()
  if (!v) return ''
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return `mailto:${v}`
  return `https://${v}`
}

/** Görünen bağlantı metni: protokol ve sondaki / atılır. */
export function displayUrl(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
}

export function isRichTextEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}
