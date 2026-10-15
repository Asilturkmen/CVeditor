import { diffArrays } from 'diff'

/** Etiket ya da "kelime + ardındaki boşluk" */
const TOKEN_RE = /<[^>]+>|[^\s<]+\s*|\s+/g

function tokenize(html: string): string[] {
  return html.match(TOKEN_RE) ?? []
}

const isTag = (token: string) => token.startsWith('<')
const words = (tokens: string[]) => tokens.filter((t) => !isTag(t) && t.trim()).length

type Segment = { kind: 'same' | 'del' | 'ins'; tokens: string[] }

/** Değişiklikler arasında kalan çok kısa ortak parçaları değişikliğe katar (okunur fark). */
function coalesce(segments: Segment[]): Segment[] {
  const out: Segment[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const between = seg.kind === 'same' && i > 0 && i < segments.length - 1
    if (between && words(seg.tokens) <= 1 && !seg.tokens.some(isTag)) {
      out.push({ kind: 'del', tokens: seg.tokens }, { kind: 'ins', tokens: seg.tokens })
      continue
    }
    out.push(seg)
  }
  // Ardışık del/ins gruplarını "önce hepsi silinen, sonra hepsi eklenen" biçiminde birleştir.
  const merged: Segment[] = []
  let del: string[] = []
  let ins: string[] = []
  const flush = () => {
    if (del.length) merged.push({ kind: 'del', tokens: del })
    if (ins.length) merged.push({ kind: 'ins', tokens: ins })
    del = []
    ins = []
  }
  for (const seg of out) {
    if (seg.kind === 'del') del.push(...seg.tokens)
    else if (seg.kind === 'ins') ins.push(...seg.tokens)
    else {
      flush()
      merged.push(seg)
    }
  }
  flush()
  return merged
}

/**
 * İki HTML parçası arasındaki farkı işaretli HTML olarak döndürür.
 *
 * - Küçük değişiklik: sonraki metnin yapısı korunur; silinen kelimeler
 *   <del>, eklenenler <ins> içinde, her değişiklik bölgesinde önce eski sonra yeni.
 * - Büyük değişiklik (metnin çoğu yeniden yazılmış): kelime kelime fark
 *   okunmaz; eski metin üstü çizili blok, altında yeni metin blok olarak gösterilir.
 *
 * Silinen etiketler atılır; çıktı her zaman geçerli HTML'dir.
 */
export function diffHtml(before: string, after: string, options: { inline?: boolean } = {}): string {
  const a = tokenize(before)
  const b = tokenize(after)
  const raw: Segment[] = diffArrays(a, b).map((p) => ({
    kind: p.added ? 'ins' : p.removed ? 'del' : 'same',
    tokens: p.value,
  }))
  const sameWords = raw.filter((s) => s.kind === 'same').reduce((n, s) => n + words(s.tokens), 0)
  const total = Math.max(words(a), words(b), 1)
  if (sameWords / total < 0.5) {
    if (!words(a)) return options.inline ? `<ins class="sg-ins">${after}</ins>` : `<div class="sg-new">${after}</div>`
    return options.inline
      ? `<del class="sg-del">${before}</del> <ins class="sg-ins">${after}</ins>`
      : `<div class="sg-old">${before}</div><div class="sg-new">${after}</div>`
  }

  let out = ''
  for (const seg of coalesce(raw)) {
    if (seg.kind === 'same') {
      out += seg.tokens.join('')
    } else if (seg.kind === 'del') {
      const text = seg.tokens.filter((t) => !isTag(t)).join('')
      if (text.trim()) out += `<del class="sg-del">${text.trimEnd()}</del> `
    } else {
      // Eklenen etiketler yapıyı kurar; aralarındaki metin <ins> içinde.
      let run = ''
      for (const token of seg.tokens) {
        if (isTag(token)) {
          if (run.trim()) out += `<ins class="sg-ins">${run.trimEnd()}</ins>${run.slice(run.trimEnd().length)}`
          else out += run
          run = ''
          out += token
        } else {
          run += token
        }
      }
      if (run.trim()) out += `<ins class="sg-ins">${run.trimEnd()}</ins>${run.slice(run.trimEnd().length)}`
      else out += run
    }
  }
  return out
}

/** Düz metin alanları için aynı fark, HTML kaçışlı. */
export function diffText(before: string, after: string): string {
  return diffHtml(escapeHtml(before), escapeHtml(after), { inline: true })
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
