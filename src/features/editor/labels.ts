import { stripHtml } from '@/cv/factory'
import type { AnyItem, SectionType } from '@/cv/schema'

/** Kaydın tek satırlık adı (kart başlığı, uyarılar, kapsam seçimi için). */
export function itemLabel(type: SectionType, item: AnyItem): string {
  const it = item as Record<string, unknown>
  const s = (key: string) => (typeof it[key] === 'string' ? (it[key] as string).trim() : '')
  const join = (...parts: string[]) => parts.filter(Boolean).join(' — ')
  switch (type) {
    case 'summary':
      return truncate(stripHtml(s('content')).replace(/\s+/g, ' ').trim(), 60)
    case 'experience':
      return join(s('position'), s('company'))
    case 'education':
      return join(s('school'), s('field') || s('degree'))
    case 'projects':
      return s('name')
    case 'skills':
      return s('name') || truncate(s('keywords'), 40)
    case 'languages':
      return join(s('name'), s('level'))
    case 'certificates':
      return s('name')
    case 'awards':
      return s('title')
    case 'volunteer':
      return join(s('role'), s('organization'))
    case 'references':
      return s('name')
    case 'custom':
      return s('title')
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
