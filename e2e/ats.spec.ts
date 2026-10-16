import { expect, test, type Page } from '@playwright/test'
import { createCv, patchCv, preview } from './helpers.ts'
import {
  flowText,
  fontReport,
  orderProblem,
  pdfText,
  renderPreviewPdf,
  settledPageCount,
  squash,
  ySortedText,
  type PdfItem,
  type PdfPage,
} from './pdf.ts'

/**
 * ATS uyumu: önizlemenin HTML'i Chromium'da PDF'e basılır (sunucu yok) ve
 * pdf.js ile metin çıkarılır. Okuma sırası hem içerik akışında (çoğu ATS)
 * hem de y'ye göre sıralı okumada (sütun sütun) doğru olmalı.
 */

interface Layout {
  label: string
  template: 'Klasik' | 'Modern'
  columns: 1 | 2
}

const LAYOUTS: Layout[] = [
  { label: 'Klasik tek sütun', template: 'Klasik', columns: 1 },
  { label: 'Klasik iki sütun', template: 'Klasik', columns: 2 },
  { label: 'Modern iki sütun', template: 'Modern', columns: 2 },
]

const POSITIONS = [
  ['Frontend Geliştirici', 'Şub 2024 – Günümüz', 'Lacivert Yazılım · İzmir'],
  ['Yazılım Stajyeri', 'Haz 2023 – Eyl 2023', 'Martı Teknoloji · İstanbul'],
  ['Serbest Web Geliştirici', 'Eyl 2021 – May 2023', 'Serbest · Uzaktan'],
]

const HEADER = ['Deniz Aksoy', 'Frontend Geliştirici']
const CONTACT = [
  'deniz.aksoy@example.com',
  '+90 555 000 00 00',
  'İzmir, Türkiye',
  'denizaksoy.example.com',
  'linkedin.com/in/deniz-aksoy-ornek',
  'github.com/deniz-aksoy-ornek',
]
const MAIN = [
  'ÖZET',
  'Erişilebilir ve hızlı web arayüzleri',
  'DENEYİM',
  ...POSITIONS.flat(),
  'EĞİTİM',
  'Ege Üniversitesi',
  'Eyl 2020 – Haz 2024',
  'Lisans, Bilgisayar Mühendisliği',
  'PROJELER',
  'Rota',
  'Kurucu geliştirici',
  'Kampüs Etkinlik Takvimi',
  'Ekip lideri',
]
const SIDE_SECTIONS = [
  'BECERİLER',
  'Diller:',
  'TypeScript, JavaScript, HTML, CSS, SQL',
  'Çatılar:',
  'Araçlar:',
  'DİLLER',
  'Türkçe',
  'Ana dil',
  'İngilizce',
  'İleri (C1)',
  'SERTİFİKALAR',
  'Web Erişilebilirliği Temelleri',
  'Kas 2023',
  'Örnek Akademi',
]

/**
 * DOM (= mantıksal okuma) sırası. Başlık (ad, unvan, iletişim) her düzende tam
 * genişlikte en üsttedir; tek sütunda yan bölümler ana akışın sonundadır.
 */
function expectedOrder(layout: Layout) {
  if (layout.columns === 1) return { header: [...HEADER, ...CONTACT], side: [], main: [...MAIN, ...SIDE_SECTIONS] }
  return { header: [...HEADER, ...CONTACT], side: SIDE_SECTIONS, main: MAIN }
}

/** Kaydedilmiş CV'deki sütun sayısı (geliştirme sunucusundaki veritabanından). */
async function storedColumns(page: Page, id: string) {
  return page.evaluate(async (cvId) => {
    const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ template: { columns: number } } | undefined> } } }).__cveditorDb
    return (await db.cvs.get(cvId))?.template.columns
  }, id)
}

/** Görünüm sekmesinden sütun sayısını değiştirir (canlı önizleme, yeniden yüklemeden). */
async function switchColumns(page: Page, columns: 1 | 2) {
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  await page.getByRole('radio', { name: columns === 2 ? 'İki sütun' : 'Tek sütun', exact: true }).click()
}

async function openSample(page: Page, layout: Layout): Promise<string> {
  const id = await createCv(page, { template: layout.template, start: 'sample' })
  const twoNow = (await preview(page).locator('.col-side').count()) > 0
  if ((layout.columns === 2) !== twoNow) {
    await switchColumns(page, layout.columns)
    // Düzen testleri geçiş animasyonundan bağımsız olsun: kaydedilince temiz yükle
    // (geçişin kendisi aşağıda ayrı testte).
    await page.waitForFunction(() => '__cveditorDb' in window)
    await expect.poll(() => storedColumns(page, id)).toBe(layout.columns)
    await page.reload()
  }
  await settledPageCount(page)
  await expect(preview(page).locator('.col-side')).toHaveCount(layout.columns === 2 ? 1 : 0)
  return id
}

async function printed(page: Page) {
  const previewPages = await settledPageCount(page)
  const pdf = await renderPreviewPdf(page)
  const pages = await pdfText(pdf)
  return { pdf, pages, previewPages }
}

/** Yan sütun: sayfanın soldaki ~%34'ü (2 sütunda ana sütun metni bunun sağında başlar). */
const inSide = (item: PdfItem, page: PdfPage) => item.x < page.width * 0.34

/**
 * İlk sayfadaki tam genişlik başlığın alt sınırı: sütunların ilk bölüm başlıklarının
 * (ÖZET / BECERİLER) en üstteki satırı. Bunun üstündeki metin başlığa aittir.
 */
function headerBottom(pages: PdfPage[]) {
  const tops = pages[0].items.filter((i) => /^(ÖZET|BECER)/.test(i.str)).map((i) => i.y)
  expect(tops.length, 'ilk sayfada sütun başlığı bulunamadı').toBeGreaterThan(0)
  return Math.max(...tops) + 1.5
}

for (const layout of LAYOUTS) {
  test.describe(`ATS PDF — ${layout.label}`, () => {
    test('metin seçilebilir; Türkçe karakterler, tarihler ve pozisyonlar doğru çıkar', async ({ page }) => {
      await openSample(page, layout)
      const { pages, pdf } = await printed(page)
      const text = flowText(pages)
      for (const url of CONTACT.filter((c) => c.includes('/'))) {
        expect(text, `PDF metninde "${url}" yok`).toContain(url)
      }
      // Bağlantılar tam adresle PDF bağlantısı olarak da duruyor.
      const raw = pdf.toString('latin1')
      for (const uri of [
        'mailto:deniz.aksoy@example.com',
        'https://linkedin.com/in/deniz-aksoy-ornek',
        'https://github.com/deniz-aksoy-ornek',
      ]) {
        expect(raw, `PDF bağlantısı "${uri}" yok`).toContain(`/URI (${uri})`)
      }
      for (const needle of [
        ...HEADER,
        ...CONTACT.filter((c) => !c.includes('/')),
        ...POSITIONS.flat(),
        'TypeScript, JavaScript, HTML, CSS, SQL',
        'Erişilebilir ve hızlı web arayüzleri',
        'Ege Üniversitesi',
        'Kampüs Etkinlik Takvimi',
        'Örnek Akademi',
        'Çatılar:',
        'İleri (C1)',
      ]) {
        expect(text, `PDF metninde "${needle}" yok`).toContain(needle)
      }
      // Bölüm başlıkları CSS ile büyük harf: Türkçe büyük İ (noktalı) çıkmalı.
      const titles = ['ÖZET', 'DENEYİM', 'EĞİTİM', 'PROJELER', 'BECERİLER', 'DİLLER', 'SERTİFİKALAR']
      for (const title of titles) expect(squash(text), `başlık "${title}" yok`).toContain(title)
      expect(squash(text)).not.toMatch(/DENEYIM|EĞITIM|BECERILER|DILLER/)
      // Bozuk/eşlemesiz glif, bağ (ligatür) ya da özel kullanım alanı karakteri yok.
      const bad = [...text].filter((c) => {
        const n = c.codePointAt(0)!
        return n === 0xfffd || (n >= 0xfb00 && n <= 0xfb06) || (n >= 0xe000 && n <= 0xf8ff)
      })
      expect(bad, 'eşlemesiz glif / ligatür / özel alan karakteri').toEqual([])
    })

    test('iletişim başlıkta; adresler satıra bölünmeden tek parça çıkar', async ({ page }) => {
      // İletişim her düzende tam genişlik başlıkta (dar yan sütunda "…deniz-aksoy- ornek" diye
      // kırılıyordu); her öğe bölünmez birim, liste yalnız öğeler arasında kırılır.
      await openSample(page, layout)
      const { pages } = await printed(page)
      const text = flowText(pages)
      for (const url of CONTACT.filter((c) => c.includes('/'))) expect(text).toContain(url)
      expect(squash(text)).not.toContain('İLETİŞİM')
      const bottom = headerBottom(pages)
      const header = squash(ySortedText([pages[0]], (item) => item.y > bottom))
      for (const c of CONTACT) expect(header, `"${c}" başlıkta değil`).toContain(squash(c))
    })

    test('bölüm başlıkları harf harf ayrılmadan tek kelime olarak çıkar', async ({ page }) => {
      // pdf.js (ve pdfminer gibi ayrıştırıcılar) ~0.1em'den büyük harf aralığını kelime boşluğu
      // sayar ("D E N E Y İ M"); şablonlarda başlık harf aralığı bu yüzden 0.05em.
      await openSample(page, layout)
      const text = flowText((await printed(page)).pages)
      for (const title of ['ÖZET', 'DENEYİM', 'EĞİTİM', 'PROJELER', 'BECERİLER']) {
        expect(text, `"${title}" bitişik değil`).toMatch(new RegExp(`(^| )${title}( |$)`))
      }
    })

    test('PDF sayfa sayısı önizlemedeki sayfa sayısına eşit', async ({ page }) => {
      await openSample(page, layout)
      const { pages, previewPages } = await printed(page)
      expect(previewPages).toBeGreaterThan(0)
      expect(pages).toHaveLength(previewPages)
      for (const p of pages) expect(p.items.length, 'boş PDF sayfası').toBeGreaterThan(0)
    })

    test('içerik akışı sırası mantıksal okuma sırasını izler', async ({ page }) => {
      await openSample(page, layout)
      const text = squash(flowText((await printed(page)).pages))
      const { header, side, main } = expectedOrder(layout)
      // Başlık en önde; iki sütunda yan sütunun tamamı ana sütundan önce gelir (DOM sırası).
      expect(orderProblem(text, [...header, ...side, ...main].map(squash))).toBeNull()
    })

    test('y\'ye göre sıralı okuma her sütunda doğru', async ({ page }) => {
      await openSample(page, layout)
      const { pages } = await printed(page)
      const { header, side, main } = expectedOrder(layout)
      if (layout.columns === 1) {
        expect(orderProblem(squash(ySortedText(pages, () => true)), [...header, ...main].map(squash))).toBeNull()
        return
      }
      // Tam genişlik başlık (ilk sayfanın üstü) ayrı okunur; altında iki sütun.
      const bottom = headerBottom(pages)
      const inHeader = (item: PdfItem, p: PdfPage) => p === pages[0] && item.y > bottom
      const headerText = squash(ySortedText(pages, inHeader))
      const sideText = squash(ySortedText(pages, (i, p) => !inHeader(i, p) && inSide(i, p)))
      const mainText = squash(ySortedText(pages, (i, p) => !inHeader(i, p) && !inSide(i, p)))
      expect(orderProblem(headerText, header.map(squash))).toBeNull()
      expect(orderProblem(sideText, side.map(squash))).toBeNull()
      expect(orderProblem(mainText, main.map(squash))).toBeNull()
      // Sütunlar birbirine karışmıyor: ana sütun metni yan sütunda yok (ve tersi).
      for (const needle of ['DENEYİM', 'YazılımStajyeri', 'EgeÜniversitesi']) expect(sideText).not.toContain(needle)
      for (const needle of ['BECERİLER', 'ÖrnekAkademi']) expect(mainText).not.toContain(needle)
      // İletişim yalnız başlıkta; sütunlara düşmüyor.
      for (const needle of ['deniz.aksoy@example.com', 'linkedin.com']) {
        expect(sideText).not.toContain(needle)
        expect(mainText).not.toContain(needle)
      }
    })

    test('yazı tipleri PDF içinde; hiçbiri gömülmeden anılmıyor ve hepsinde ToUnicode var', async ({ page }) => {
      await openSample(page, layout)
      const report = fontReport((await printed(page)).pdf)
      expect(report.subtypes.length).toBeGreaterThan(0)
      expect(report.notEmbedded, `gömülü olmayan yazı tipi: ${report.subtypes.join(', ')}`).toBe(0)
      expect(report.withoutToUnicode, 'ToUnicode eşlemesi olmayan yazı tipi').toBe(0)
    })

    test('yazı tipleri gerçek TrueType/CFF programı olarak gömülü (Type3 değil)', async ({ page }) => {
      // Chromium/Skia değişken (wght) yazı tiplerini PDF'e Type3 (glif başına çizim) olarak basar;
      // bu yüzden public/fonts ağırlık başına statik woff2 içerir (scripts/copy-fonts.mjs).
      await openSample(page, layout)
      const report = fontReport((await printed(page)).pdf)
      expect(report.type3, `Type3 yazı tipi sayısı (alt türler: ${report.subtypes.join(', ')})`).toBe(0)
      expect(report.fontFiles).toBeGreaterThan(0)
    })
  })
}

test('sütun değiştirdikten hemen sonra alınan PDF önizlemeyle aynı (geçiş kopyası kalmaz)', async ({ page }) => {
  // CvFrame şablon geçişinde eski sayfaların kopyasını (#cv-ghost, gölge DOM) koyar ve solunca
  // kaldırır. İframe betiksiz sandbox: zamanlayıcı üst pencereden kurulmazsa hiç çalışmaz, kopya
  // belgede kalır ve yazdırınca eski düzenin yüksekliği kadar boş sayfa eklenir.
  const id = await createCv(page, { template: 'Klasik', start: 'sample' })
  const before = await settledPageCount(page)
  await switchColumns(page, 2)
  await expect.poll(() => storedColumns(page, id)).toBe(2)
  await page.waitForTimeout(1000) // geçiş animasyonu (~260 ms) çoktan bitmiş olmalı
  const { pages, previewPages } = await printed(page)
  expect(previewPages).toBeLessThanOrEqual(before)
  expect(pages).toHaveLength(previewPages)
  expect(flowText(pages).split('Deniz Aksoy').length - 1).toBe(1)
  expect(await preview(page).locator('html').evaluate((html) => !!html.ownerDocument.getElementById('cv-ghost'))).toBe(false)
})

for (const template of ['Klasik', 'Modern'] as const) {
  test(`${template}: bir sayfadan uzun kayıt PDF'te sayfa sınırında metin kaybetmez/çoğaltmaz`, async ({ page }) => {
    const id = await createCv(page, { template, start: 'sample' })
    await patchCv(
      page,
      id,
      `const exp = cv.sections.find((s) => s.type === 'experience');
       exp.items[1].description = '<ul>' + Array.from({ length: 70 }, (_, i) => '<li>Madde ' + (i + 1) + ' sonucu ölçülebilir biçimde anlatır.</li>').join('') + '</ul>';`,
    )
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
    const { pages, previewPages } = await printed(page)
    expect(previewPages).toBeGreaterThan(1)
    expect(pages).toHaveLength(previewPages)
    const text = flowText(pages)
    const bullets = Array.from({ length: 70 }, (_, i) => `Madde ${i + 1} sonucu ölçülebilir biçimde anlatır.`)
    for (const bullet of bullets) {
      expect(text.split(bullet).length - 1, `"${bullet}" PDF'te tam bir kez olmalı`).toBe(1)
    }
    // Maddeler sayfalar boyunca sırayla akar; bölünen kaydın başlığı tek kez yazılır.
    expect(orderProblem(text, bullets)).toBeNull()
    expect(text.split('Yazılım Stajyeri').length - 1).toBe(1)
    expect(orderProblem(squash(text), ['Yazılım Stajyeri', 'Madde 1 sonucu', 'Madde 70 sonucu', 'Serbest Web Geliştirici'].map(squash))).toBeNull()
  })
}
