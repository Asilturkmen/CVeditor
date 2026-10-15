import { diffArrays } from 'diff'

const TOKEN_RE = /(<[^>]+>|\s+|[^\s<]+)/g

function tokenize(html: string): string[] {
  return html.match(TOKEN_RE) ?? []
}

const isTag = (token: string) => token.startsWith('<')

/**
 * İki HTML parçası arasındaki kelime farkını işaretli HTML olarak döndürür.
 * Sonucun etiket yapısı "sonraki" metninkidir; silinen kelimeler <del>,
 * eklenenler <ins> içinde durur. Silinen etiketler atılır, böylece çıktı
 * her zaman geçerli HTML'dir.
 */
export function diffHtml(before: string, after: string): string {
  const parts = diffArrays(tokenize(before), tokenize(after))
  let out = ''
  for (const part of parts) {
    if (part.removed) {
      const text = part.value.filter((t) => !isTag(t)).join('')
      if (text.trim()) out += `<del class="sg-del">${text}</del>`
      continue
    }
    if (part.added) {
      let run = ''
      for (const token of part.value) {
        if (isTag(token)) {
          if (run) out += `<ins class="sg-ins">${run}</ins>`
          run = ''
          out += token
        } else {
          run += token
        }
      }
      if (run.trim()) out += `<ins class="sg-ins">${run}</ins>`
      else out += run
      continue
    }
    out += part.value.join('')
  }
  return out
}

/** Düz metin alanları için aynı fark, HTML kaçışlı. */
export function diffText(before: string, after: string): string {
  return diffHtml(escapeHtml(before), escapeHtml(after))
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
