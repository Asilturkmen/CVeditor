import createDOMPurify, { type Config, type DOMPurify, type UponSanitizeElementHookEvent, type WindowLike } from 'dompurify'

const ALLOWED_TAGS = ['p', 'ul', 'li', 'strong', 'em', 'a', 'br']

/**
 * Bağlantı adresi: yalnız `http(s)://`, `mailto:`, `tel:` ya da şemasız alan adı (`site.com/yol`,
 * `site.com:8080`). İki uçtan çapalı: `ms-msdt.id:foo` gibi "alan adına benzeyen şema"lar, göreli
 * yollar (`/etc/x`, `../x`, `#a`) ve `//host` geçmez. Şemasız alan adı `toHref` ile `https://` alır.
 */
const SAFE_URI = /^(?:https?:\/\/|mailto:|tel:|(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,}(?::\d{1,5})?(?:[/?#]|$))/iu
/** `toHref`'ten çıkan adres mutlak mı (çizime yalnız bunlar girer) */
const ABSOLUTE_HREF = /^(?:https?:\/\/|mailto:|tel:)/i

const BASE_CONFIG = {
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: SAFE_URI,
  // DOMPurify bunları ALLOWED_ATTR'dan bağımsız geçirir; CV'de işleri yok (data-block, data-item-id
  // sayfalamanın ve editörün kancalarıdır, kullanıcı metninden gelmemeli).
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
} satisfies Config

/** Süzgecin attığı blok etiketler: içlerindeki metin ayrı satır (paragraf) sayılır. */
const BLOCK_TAGS = new Set(
  'address article aside blockquote caption dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main nav ol pre section table tbody td tfoot th thead tr'.split(
    ' ',
  ),
)

const DIFF_CLASSES = new Set(['sg-del', 'sg-ins', 'sg-old', 'sg-new'])

const ELEMENT_NODE = 1
const TEXT_NODE = 3

/** `configureSanitizer`'a verilebilecek pencere (tarayıcının `window`'u ya da jsdom penceresi). */
export type SanitizerWindow = WindowLike

let sanitizerWindow: SanitizerWindow | null = null
let purify: DOMPurify | null = null

/**
 * Süzgecin kullanacağı pencere. Tarayıcıda çağırmaya gerek yok (kendiliğinden `window`). DOMPurify
 * DOM ister; düz Node'da (sunucu) zengin metin çizilmeden önce bir kez
 * `configureSanitizer(new JSDOM('').window)` çağrılmalı. `null` varsayılana döndürür.
 */
export function configureSanitizer(win: SanitizerWindow | null): void {
  sanitizerWindow = win
  purify = null
}

/** Süzgeç ilk kullanımda kurulur: modül Node'da içe aktarılabilir (üst düzeyde `window` yok). */
function sanitizer(): DOMPurify {
  if (purify) return purify
  const win = sanitizerWindow ?? (typeof window === 'undefined' ? null : window)
  const instance = win ? createDOMPurify(win) : null
  if (!instance?.isSupported) {
    throw new Error("Zengin metin süzgeci için DOM yok: sunucuda önce configureSanitizer(new JSDOM('').window) çağır")
  }
  instance.addHook('uponSanitizeElement', markBlockBoundary)
  purify = instance
  return instance
}

/** Süzülmüş içerik, DOMPurify'ın kendi (etkisiz) belgesindeki `<body>` olarak: üstünde düzenleme yapılır. */
function sanitizeToBody(html: string, config: Config): HTMLElement {
  return sanitizer().sanitize(html, { ...BASE_CONFIG, ...config, RETURN_DOM: true }) as HTMLElement
}

/**
 * Atılacak blok etiketin (div, h1, td…) iki yanına satır sonu koyar: içeriği yerinde kalır ama
 * komşu metne yapışmaz ("<div>a</div><div>b</div>" → "ab" değil, iki satır). `wrapLooseContent`
 * üst düzeydeki satırları ayrı paragraf yapar; iç içe yerde satır sonu yalnız boşluktur.
 */
function markBlockBoundary(node: Node, event: UponSanitizeElementHookEvent): void {
  if (!BLOCK_TAGS.has(event.tagName) || event.allowedTags[event.tagName] || !node.parentNode) return
  const doc = node.ownerDocument!
  node.parentNode.insertBefore(doc.createTextNode('\n'), node)
  node.parentNode.insertBefore(doc.createTextNode('\n'), node.nextSibling)
}

/**
 * Üst düzeyde yalnız `<p>` ve `<ul>` kalır. Çıplak metin ve satır içi etiketler `<p>`'ye sarılır,
 * satır sonu (ve üst düzey `<br>`) yeni paragraf başlatır, sahipsiz `<li>`'ler `<ul>`'e girer.
 * Sayfalama gövdeyi paragraf/madde arasından böler; çıplak metinli gövde bölünemeyen tek parça
 * sayılır ve sayfa dibinde kesilirdi.
 */
function wrapLooseContent(body: HTMLElement): void {
  const doc = body.ownerDocument
  const out: Node[] = []
  let para: HTMLElement | null = null
  let list: HTMLElement | null = null
  const closePara = () => {
    const last = para?.lastChild
    if (last?.nodeType === TEXT_NODE) {
      const text = (last.textContent ?? '').trimEnd()
      if (text) last.textContent = text
      else last.remove()
    }
    para = null
  }
  const inline = (node: Node) => {
    list = null
    if (!para) {
      para = doc.createElement('p')
      out.push(para)
    }
    para.appendChild(node)
  }
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === TEXT_NODE) {
      ;(node.textContent ?? '').split(/\r\n?|\n/).forEach((line, index) => {
        if (index > 0) closePara()
        // Paragraf boşlukla başlamaz; bloklar arasındaki boşluk paragraf açmaz.
        const text = para ? line : line.trimStart()
        if (text) inline(doc.createTextNode(text))
      })
      continue
    }
    if (node.nodeType !== ELEMENT_NODE) continue
    const tag = (node as Element).tagName
    if (tag === 'P' || tag === 'UL') {
      closePara()
      list = null
      out.push(node)
    } else if (tag === 'LI') {
      closePara()
      if (!list) {
        list = doc.createElement('ul')
        out.push(list)
      }
      list.appendChild(node)
    } else if (tag === 'BR') {
      closePara()
    } else {
      inline(node)
    }
  }
  closePara()
  body.replaceChildren(...out)
}

/** Bağlantılar mutlak adres olur ("site.com" → "https://site.com"): PDF'te göreli, kırık bağlantı kalmaz. */
function absolutizeLinks(body: HTMLElement): void {
  for (const a of Array.from(body.querySelectorAll('a[href]'))) {
    const href = toHref(a.getAttribute('href') ?? '')
    if (ABSOLUTE_HREF.test(href)) a.setAttribute('href', href)
    else a.removeAttribute('href')
  }
}

/**
 * Açıklama alanları kısıtlı HTML tutar. Kayıtta da çizimde de aynı süzgeç:
 * yalnız paragraf, madde, kalın, italik, bağlantı. Renk/boyut şablondan gelir.
 * Çıktı kararlıdır: süzülmüş metni yeniden süzmek onu değiştirmez.
 */
export function sanitizeRichText(html: string): string {
  if (!html) return ''
  const body = sanitizeToBody(html, { ALLOWED_TAGS })
  wrapLooseContent(body)
  absolutizeLinks(body)
  return body.innerHTML.replace(/<p><\/p>/g, '')
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

/**
 * Öneri farkı çıktısı için süzgeç: zengin metin etiketlerine ek olarak fark işaretleri
 * (del, ins, sg-old/sg-new kutuları). `class` yalnız bu işaretlerin sınıflarını taşır;
 * adres ve öznitelik kuralları `sanitizeRichText` ile aynıdır.
 */
export function sanitizeDiffHtml(html: string): string {
  if (!html) return ''
  const body = sanitizeToBody(html, { ALLOWED_TAGS: [...ALLOWED_TAGS, 'del', 'ins', 'div'], ALLOWED_ATTR: ['href', 'class'] })
  for (const el of Array.from(body.querySelectorAll('[class]'))) {
    const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter((name) => DIFF_CLASSES.has(name))
    if (classes.length) el.setAttribute('class', classes.join(' '))
    else el.removeAttribute('class')
  }
  absolutizeLinks(body)
  return body.innerHTML
}

export function isRichTextEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}
