import type { FontId } from '@/cv/schema'
import { FONTS, fontFaceCss } from './fonts'

/**
 * Tarayıcının kendi "Yazdır" menüsü için CV aynası.
 *
 * Menüden yazdırınca tarayıcı iframe'i değil üst belgeyi basar; iframe baskıda
 * tek parça (bölünmez) kutu olduğundan çok sayfalı CV kesilirdi. Bunun yerine
 * `beforeprint` anında önizlemenin zaten sayfalanmış #cv-pages'i, kendi CSS'iyle
 * bir gölge köke (shadow DOM) kopyalanır; @media print'te uygulama gizlenir ve
 * yalnız bu kopya A4, kenar boşluğu sıfır basılır. Satır kırılımı, sayfa bölünmesi
 * ve yazı tipleri önizlemeyle aynıdır (aynı DOM, aynı CSS); site stili gölge köke
 * sızmaz. Yazı tipleri yalnız @font-face belge düzeyinde çalıştığı için üst belgeye
 * de tanımlanır ve baskıdan önce yüklenmiş olsun diye editör açılınca ısıtılır.
 */

export const PRINT_MIRROR_ID = 'cv-print-mirror'
const FONT_STYLE_ID = 'cv-print-fonts'

/** CV yazı tiplerini üst belgeye tanımlar ve seçili yazı tipinin ağırlıklarını önceden yükler. */
export function warmMirrorFonts(font: FontId) {
  if (!document.getElementById(FONT_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = FONT_STYLE_ID
    style.textContent = fontFaceCss()
    document.head.append(style)
  }
  const family = FONTS[font].stack.split(',')[0]
  const sample = 'Aa ğüşıöçĞÜŞİÖÇ'
  for (const w of ['400', '500', '600', '700', 'italic 400']) void document.fonts.load(`${w} 12px ${family}`, sample).catch(() => [])
}

/**
 * CV belgesinin stilleriyle sayfaların gölge kökte kopyası. Şablon geçişindeki
 * solma kopyası da bunu kullanır. :root değişkenleri ve body yazı ayarları
 * gölge kökte :host üzerinden okunur.
 */
export function shadowCopyOfPages(doc: Document, host: HTMLElement, extraCss = ''): boolean {
  const pages = doc.getElementById('cv-pages')
  if (!pages || !pages.firstElementChild) return false
  const css = (doc.getElementById('cv-styles')?.textContent ?? '') + (doc.getElementById('cv-host')?.textContent ?? '')
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = `${css.replace(/:root/g, ':host')}
:host{display:block;color:var(--ink);font-family:var(--font);font-size:var(--fs);line-height:var(--lh);-webkit-font-smoothing:antialiased;font-kerning:normal;overflow-wrap:break-word;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.page-enter{animation:none}${extraCss}`
  root.replaceChildren(style, pages.cloneNode(true))
  return true
}

/**
 * Baskı aynası: üst belgeye eklenecek kök. Vurgu/parlama sınıfları kopyada
 * temizlenir. Dil CV belgesinden gelir: üst belgenin dili arayüz dilidir ve
 * bölüm başlıklarındaki büyük harf dönüşümü dile göre yapılır (Türkçe
 * arayüzde İngilizce CV "EXPERİENCE" basılmasın). Fotoğraf gibi görseller
 * kopyada yeniden çözülür; ayna baskıdan önce hazırlandığında (CvFrame her
 * çizimden sonra hazırlar) baskı anında hazır olurlar.
 */
export function buildPrintMirror(doc: Document): HTMLElement | null {
  const host = document.createElement('div')
  host.id = PRINT_MIRROR_ID
  if (!shadowCopyOfPages(doc, host, '#cv-pages{display:block;padding:0;gap:0}.page{box-shadow:none}')) return null
  const lang = doc.documentElement.lang
  if (lang) host.lang = lang
  const root = host.shadowRoot!
  root.querySelectorAll('.is-focused, .sg-flash').forEach((el) => el.classList.remove('is-focused', 'sg-flash'))
  root.querySelectorAll('img').forEach((img) => {
    img.loading = 'eager'
    img.decode?.().catch(() => {})
  })
  return host
}

/** Basılmaması gereken durumda (onay bekleyen uzun kayıt, bekleyen öneri) CV yerine basılan kısa not. */
export function buildPrintNotice(text: string): HTMLElement {
  const host = document.createElement('div')
  host.id = PRINT_MIRROR_ID
  host.dataset.notice = ''
  const p = document.createElement('p')
  p.textContent = text
  host.append(p)
  return host
}
