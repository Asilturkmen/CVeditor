import { describe, expect, it } from 'vitest'
import { diffHtml } from './diff'
import { sanitizeDiffHtml, sanitizeRichText } from './richtext'

function parse(html: string) {
  const doc = document.implementation.createHTMLDocument('t')
  doc.body.innerHTML = html
  return doc.body
}

const hrefOf = (html: string) => parse(sanitizeRichText(html)).querySelector('a')?.getAttribute('href') ?? null

describe('zengin metin süzgeci: öznitelikler', () => {
  it('data-* ve aria-* geçmez (sayfalama ve editör kancaları kullanıcı metninden gelmez)', () => {
    const clean = sanitizeRichText(
      '<p data-block="" data-item-id="x" aria-hidden="true" aria-label="gizli">Metin <strong data-sg-id="1">kalın</strong></p><ul data-flow="main"><li aria-current="page">madde</li></ul>',
    )
    expect(clean).toBe('<p>Metin <strong>kalın</strong></p><ul><li>madde</li></ul>')
  })

  it('yalnız href kalır; class, style, id, target, olay öznitelikleri atılır', () => {
    const clean = sanitizeRichText('<p class="cv-name" id="cv-pages" style="position:fixed"><a href="https://ornek.com" target="_blank" onclick="x()" class="ph">a</a></p>')
    expect(clean).toBe('<p><a href="https://ornek.com">a</a></p>')
  })
})

describe('zengin metin süzgeci: bağlantı adresleri', () => {
  it('http(s), mailto, tel ve şemasız alan adı geçer', () => {
    expect(hrefOf('<p><a href="https://ornek.com/yol?a=1#b">a</a></p>')).toBe('https://ornek.com/yol?a=1#b')
    expect(hrefOf('<p><a href="http://ornek.com">a</a></p>')).toBe('http://ornek.com')
    expect(hrefOf('<p><a href="mailto:ad@ornek.com">a</a></p>')).toBe('mailto:ad@ornek.com')
    expect(hrefOf('<p><a href="tel:+905550000000">a</a></p>')).toBe('tel:+905550000000')
  })

  it('şemasız alan adı mutlak adres olur (PDF\'te göreli bağlantı kalmaz)', () => {
    expect(hrefOf('<p><a href="site.com/yol">a</a></p>')).toBe('https://site.com/yol')
    expect(hrefOf('<p><a href="www.ornek.com.tr">a</a></p>')).toBe('https://www.ornek.com.tr')
    expect(hrefOf('<p><a href="site.com:8080/x">a</a></p>')).toBe('https://site.com:8080/x')
    expect(hrefOf('<p><a href="örnek.com">a</a></p>')).toBe('https://örnek.com')
    // "file.txt" alan adından ayırt edilemez; göreli kalmaz, mutlak adres olur.
    expect(hrefOf('<p><a href="file.txt">a</a></p>')).toBe('https://file.txt')
  })

  it.each([
    'ms-msdt.id:foo',
    'ms-msdt:/id PCWDiagnostic',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:x',
    'file:///C:/Windows/win.ini',
    'ftp://ornek.com/x',
    'blob:https://ornek.com/1',
    'https:ornek.com',
    '//ornek.com/x',
    '/etc/passwd',
    '../gizli.html',
    './a.html',
    'klasor/dosya',
    '#bolum',
    '?q=1',
    'ornek.com:foo',
    'ornek.com@kotu',
    'x.y:javascript:alert(1)',
  ])('geçmez: %s', (href) => {
    const body = parse(sanitizeRichText(`<p><a href="${href}">metin</a></p>`))
    expect(body.querySelector('a')?.hasAttribute('href') ?? false).toBe(false)
    // Bağlantı gider, metin kalır.
    expect(body.textContent).toBe('metin')
  })
})

describe('zengin metin süzgeci: üst düzey çıplak metin', () => {
  it('düz metin <p> olur; her satır ayrı paragraf', () => {
    expect(sanitizeRichText('Tek satır')).toBe('<p>Tek satır</p>')
    expect(sanitizeRichText('Birinci satır\nİkinci satır\r\n\r\n  Üçüncü satır  ')).toBe(
      '<p>Birinci satır</p><p>İkinci satır</p><p>Üçüncü satır</p>',
    )
  })

  it('atılan blok etiketlerin (div, h1, tablo) içinden kalan metin ayrı paragraflar olur', () => {
    expect(sanitizeRichText('<div>Birinci</div><div>İkinci</div>')).toBe('<p>Birinci</p><p>İkinci</p>')
    expect(sanitizeRichText('<h1>Başlık</h1>gövde <strong>kalın</strong> devam<h2>Alt</h2>')).toBe(
      '<p>Başlık</p><p>gövde <strong>kalın</strong> devam</p><p>Alt</p>',
    )
    expect(sanitizeRichText('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('<p>a</p><p>b</p>')
    expect(sanitizeRichText('<div><div>iç</div>dış</div>')).toBe('<p>iç</p><p>dış</p>')
  })

  it('üst düzey satır içi etiketler ve <br> paragraflara dağılır', () => {
    expect(sanitizeRichText('<strong>kalın</strong> ve <em>italik</em><br>yeni satır')).toBe(
      '<p><strong>kalın</strong> ve <em>italik</em></p><p>yeni satır</p>',
    )
    expect(sanitizeRichText('<a href="ornek.com">bağlantı</a>')).toBe('<p><a href="https://ornek.com">bağlantı</a></p>')
  })

  it('sahipsiz maddeler (ol içinden kalanlar dahil) <ul> olur', () => {
    expect(sanitizeRichText('<ol><li>bir</li><li>iki</li></ol>')).toBe('<ul><li>bir</li><li>iki</li></ul>')
    expect(sanitizeRichText('giriş<li>bir</li>\n<li>iki</li>son')).toBe('<p>giriş</p><ul><li>bir</li><li>iki</li></ul><p>son</p>')
  })

  it('paragraf ve liste arasına karışan çıplak metin de sarılır; sıra korunur', () => {
    expect(sanitizeRichText('<p>bir</p>iki<ul><li>üç</li></ul>dört')).toBe('<p>bir</p><p>iki</p><ul><li>üç</li></ul><p>dört</p>')
  })

  it('zaten düzgün metin değişmez; bloklar arası boşluk paragraf açmaz; paragraf içi <br> kalır', () => {
    const html = '<p>Bir <strong>kalın</strong><br>alt satır</p><ul><li>madde <em>bir</em></li><li>madde iki</li></ul>'
    expect(sanitizeRichText(html)).toBe(html)
    expect(sanitizeRichText('<p>a</p>\n  <p>b</p>\n<ul>\n<li>c</li>\n</ul>\n')).toBe('<p>a</p><p>b</p><ul>\n<li>c</li>\n</ul>')
    expect(sanitizeRichText('<p></p>   \n ')).toBe('')
  })

  it('çıktıda üst düzeyde yalnız <p> ve <ul> kalır (sayfalama aralarından bölebilsin)', () => {
    const samples = [
      'düz metin\nikinci',
      '<div>a<p>b</p>c</div>',
      '<h3>x</h3><ul><li>y</li></ul>z<br><br>w',
      '<span>a</span><b>b</b><i>c</i><script>alert(1)</script>d',
      '<blockquote>alıntı <em>italik</em></blockquote><pre>kod\nsatır</pre>',
    ]
    for (const sample of samples) {
      const body = parse(sanitizeRichText(sample))
      expect(Array.from(body.childNodes).map((n) => n.nodeName), sample).toSatisfy((names: string[]) => names.every((n) => n === 'P' || n === 'UL'))
      expect(body.textContent).not.toContain('alert')
    }
  })

  it('kararlı: süzülmüş metni yeniden süzmek değiştirmez', () => {
    const samples = [
      'düz metin\nikinci satır',
      '<div>Birinci</div><div>İkinci</div>',
      '<p>a <a href="site.com/yol">b</a></p>iki<li>üç</li>',
      '<strong>x</strong> y <br> z',
      '<p>5 &lt; 6 &amp; "tırnak"</p>',
    ]
    for (const sample of samples) {
      const once = sanitizeRichText(sample)
      expect(sanitizeRichText(once), sample).toBe(once)
    }
  })

  it('düz metindeki HTML özel karakterleri kaçışlı kalır', () => {
    expect(sanitizeRichText('5 < 6 & 7 > 3')).toBe('<p>5 &lt; 6 &amp; 7 &gt; 3</p>')
  })
})

describe('öneri farkı süzgeci', () => {
  it('fark işaretlerini (del, ins, sg-old/sg-new) korur', () => {
    const inline = diffHtml('<p>Paneli React ile yazdım ve hızlandırdım</p>', '<p>Paneli React 19 ile yazdım ve %38 hızlandırdım</p>')
    expect(sanitizeDiffHtml(inline)).toBe(inline)
    expect(inline).toContain('<ins class="sg-ins">19</ins>')
    const block = diffHtml('<p>Tamamen eski bir metin burada duruyor</p>', '<ul><li>Bambaşka yeni cümleler yazıldı şimdi</li></ul>')
    expect(sanitizeDiffHtml(block)).toBe(block)
    expect(block).toContain('<div class="sg-old">')
    expect(block).toContain('<div class="sg-new">')
  })

  it('yalnız fark sınıfları kalır; data-*, aria-*, başka sınıf ve öznitelik atılır', () => {
    const clean = sanitizeDiffHtml(
      '<div class="sg-new page cv-header" data-block="" aria-hidden="true" style="x"><p class="ph">a <ins class="sg-ins is-focused" id="i">b</ins> <del class="kotu">c</del></p></div>',
    )
    expect(clean).toBe('<div class="sg-new"><p>a <ins class="sg-ins">b</ins> <del>c</del></p></div>')
  })

  it('adres kuralı zengin metinle aynı: şema listesi, mutlak adres', () => {
    const body = parse(
      sanitizeDiffHtml(
        '<p><a href="ms-msdt.id:foo">a</a><a href="javascript:alert(1)">b</a><a href="/goreli">c</a><ins class="sg-ins"><a href="site.com/yol">d</a></ins></p>',
      ),
    )
    expect(Array.from(body.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual([null, null, null, 'https://site.com/yol'])
  })

  it('izinli olmayan etiketler farkta da atılır', () => {
    const clean = sanitizeDiffHtml('<div class="sg-old"><img src="x" onerror="alert(1)"><script>alert(1)</script><span>metin</span></div>')
    expect(clean).toBe('<div class="sg-old">metin</div>')
  })
})
