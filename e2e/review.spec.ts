import { expect, test, type Page } from '@playwright/test'
import { lengthenScript, patchCv } from './helpers.ts'

/**
 * CV İnceleme: kural bulguları, "Düzenle" ile editöre odaklı geçiş, ilan
 * karşılaştırması ve PDF yükleme (test içinde Chromium'la basılan PDF).
 */

/** Uydurma örnek CV'yi bilerek bozup veritabanına yazar; id'leri döndürür. */
async function seedBrokenCv(page: Page) {
  await page.goto('/cvler')
  await page.waitForFunction(() => '__cveditorDb' in window)
  return page.evaluate(async () => {
    const factory = await import('/src/cv/factory.ts' as string)
    const sample = await import('/src/cv/sample.ts' as string)
    const templates = await import('/src/render/templates.ts' as string)
    const sections = sample.sampleSections('tr')
    const cv = factory.createCv({
      name: 'İncelenecek CV',
      language: 'tr',
      templateId: 'zarif',
      template: templates.templateSettingsFor('zarif', sections),
      personal: sample.samplePersonal('tr'),
      sections,
    })
    const exp = cv.sections.find((s: { type: string }) => s.type === 'experience')
    exp.title = 'Kariyer Yolculuğum'
    exp.items[1].dates = { start: { year: 2023, month: 9 }, end: { year: 2023, month: 6 }, current: false }
    const db = (window as unknown as { __cveditorDb: { cvs: { put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
    await db.cvs.put(cv)
    return { cvId: cv.id as string, invertedItemId: exp.items[1].id as string }
  })
}

test('kurallar sorunları gösterir, Düzenle editörde kayda odaklanır', async ({ page }) => {
  const { cvId, invertedItemId } = await seedBrokenCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  await expect(page.getByRole('heading', { name: 'CV İnceleme' })).toBeVisible()
  await expect(page.getByLabel('CV', { exact: true })).toHaveValue(cvId)

  const inverted = page.locator(`[data-finding="date-inverted-${invertedItemId}"]`)
  await expect(inverted).toContainText('Sorun')
  await expect(inverted).toContainText('Tarihler ters: Yazılım Stajyeri — Martı Teknoloji')
  await expect(page.getByText('“Kariyer Yolculuğum” başlığını ATS tanımayabilir')).toBeVisible()
  await expect(page.getByText('Standart karşılığı: “Deneyim”.')).toBeVisible()
  // Önce yalnız düzeltilecekler: geçen kontroller kapalı bir satırda, açınca listelenir; puan yok
  await expect(page.getByRole('list', { name: 'Düzeltilecekler' }).locator('[data-severity="ok"]')).toHaveCount(0)
  await expect(page.locator('[data-severity="ok"]')).toHaveCount(0)
  const passed = page.getByRole('button', { name: /^Geçen \d+ kontrol$/ })
  await expect(passed).toHaveAttribute('aria-expanded', 'false')
  await passed.click()
  await expect(passed).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-severity="ok"]').first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'İletişim ve bağlantılar' }).locator('[data-severity="ok"]').first()).toBeVisible()
  await expect(page.locator('[data-finding]').filter({ hasText: /%\d|\d+\s?%|puan|skor/i })).toHaveCount(0)

  // Yeniden kapanır; düzeltilecekler yerinde
  await passed.click()
  await expect(passed).toHaveAttribute('aria-expanded', 'false')
  await expect(inverted).toBeVisible()

  await inverted.getByRole('button', { name: /Düzenle/ }).click()
  await page.waitForURL(`**/editor/${cvId}`)
  const card = page.locator(`#item-${invertedItemId}`)
  await expect(card).toBeInViewport()
  await expect(card.locator('input').first()).toBeFocused()
})

test('editör menüsünden ve üst menüden incelemeye gidilir', async ({ page }) => {
  const { cvId } = await seedBrokenCv(page)
  await page.goto(`/editor/${cvId}`)
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: "Bu CV'yi incele" }).click()
  await page.waitForURL(`**/inceleme?cv=${cvId}`)
  await expect(page.getByRole('link', { name: 'İnceleme' })).toBeVisible()
  await expect(page.getByText('“Kariyer Yolculuğum” başlığını ATS tanımayabilir')).toBeVisible()
})

test('iş ilanı yapıştırınca eksik anahtar kelimeler görünür', async ({ page }) => {
  const { cvId } = await seedBrokenCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  // İlan alanı hep açık (geniş sütunda, sonuçların altında)
  await page.getByLabel('İlan metni').fill(
    ['Frontend Geliştirici arıyoruz', '- React ve TypeScript deneyimi', '- Docker ve Kubernetes bilgisi', '- GraphQL ile API geliştirme'].join('\n'),
  )
  const missing = page.getByRole('list', { name: 'Eksik' })
  const present = page.getByRole('list', { name: 'Var' })
  await expect(missing.getByText('Docker', { exact: true })).toBeVisible()
  await expect(missing.getByText('GraphQL', { exact: true })).toBeVisible()
  await expect(present.getByText('React', { exact: true })).toBeVisible()
  await expect(present.getByText('TypeScript', { exact: true })).toBeVisible()
})

test('PDF yükleyince ATS\'nin gördüğü metin ve bulgular görünür', async ({ page, context }) => {
  const printer = await context.newPage()
  await printer.setContent(`<html lang="tr"><body style="font-family: sans-serif">
    <h1>Deniz Aksoy</h1>
    <p>deniz.aksoy@example.com · +90 555 000 00 00</p>
    <h2>Deneyim</h2>
    <p>Frontend Geliştirici, Lacivert Yazılım, 03/2021 – Mar 2024</p>
    <ul><li>Müşteri panelini React ve TypeScript ile yeniden yazdım.</li></ul>
    <h2>Eğitim</h2>
    <p>Ege Üniversitesi, Bilgisayar Mühendisliği, 2016 – 2020</p>
    </body></html>`)
  const pdf = await printer.pdf()
  await printer.close()

  await page.goto('/inceleme')
  await page.getByRole('radio', { name: 'PDF yükle' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'deniz-cv.pdf', mimeType: 'application/pdf', buffer: pdf })
  await expect(page.getByText('deniz-cv.pdf')).toBeVisible()
  // pdfjs ilk kez yüklenirken (yük altında) birkaç saniye sürebilir
  await expect(page.locator('[data-finding="pdf-dates"]')).toContainText('Tarih biçimleri karışık', { timeout: 20_000 })
  // Geçen kontroller (e-posta bulundu) kapalı satırda
  await page.getByRole('button', { name: /^Geçen \d+ kontrol$/ }).click()
  await expect(page.locator('[data-finding="pdf-email"]')).toContainText('E-posta bulundu: deniz.aksoy@example.com')

  await page.getByRole('button', { name: "ATS'nin gördüğü metin" }).click()
  const text = page.getByTestId('ats-text')
  await expect(text).toBeVisible()
  await expect(text).toContainText('Deniz Aksoy')
  await expect(text).toContainText('Müşteri panelini React ve TypeScript ile yeniden yazdım.')
  // PDF'te düzenlenecek kayıt yok
  await expect(page.getByRole('button', { name: /^Düzenle/ })).toHaveCount(0)
})

test('iki sütunu satır satır karışık basılmış PDF: uyarı ve ham akış sırası', async ({ page, context }) => {
  // Kasıtlı olarak kötü PDF: içerik akışı sol-sağ-sol-sağ (DOM sırası), sağ sütun yarım satır aşağıda.
  const rows = Array.from(
    { length: 10 },
    (_, i) =>
      `<p style="position:absolute;margin:0;font-size:12px;left:40px;top:${100 + i * 20}px">Sol sütundaki uzun bir satır ${i}</p>` +
      `<p style="position:absolute;margin:0;font-size:12px;left:330px;top:${110 + i * 20}px">Sağ sütundaki uzun bir satır ${i}</p>`,
  ).join('')
  const printer = await context.newPage()
  await printer.setContent(`<html lang="tr"><body style="font-family: sans-serif; margin: 0">${rows}</body></html>`)
  const pdf = await printer.pdf({ format: 'A4' })
  await printer.close()

  await page.goto('/inceleme')
  await page.getByRole('radio', { name: 'PDF yükle' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'karisik.pdf', mimeType: 'application/pdf', buffer: pdf })
  await expect(page.locator('[data-finding="pdf-columns"]')).toContainText('Sütunlar karışıyor', { timeout: 20_000 })

  await page.getByRole('button', { name: "ATS'nin gördüğü metin" }).click()
  const lines = (await page.getByTestId('ats-text').locator('p.whitespace-pre-wrap').allInnerTexts()).map((l) => l.trim())
  // Panel PDF'in okunduğu ham sırayı gösterir (sütunlara ayrılmış hâlini değil)
  expect(lines.slice(0, 4)).toEqual(['Sol sütundaki uzun bir satır 0', 'Sağ sütundaki uzun bir satır 0', 'Sol sütundaki uzun bir satır 1', 'Sağ sütundaki uzun bir satır 1'])
})

test('PDF olmayan dosya anlaşılır bir sorun olarak görünür', async ({ page }) => {
  await page.goto('/inceleme')
  await page.getByRole('radio', { name: 'PDF yükle' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'cv.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK not a pdf') })
  await expect(page.locator('[data-finding="pdf-error-not_pdf"]')).toContainText('Bu dosya PDF değil', { timeout: 15_000 })
})

test('20 MB\'tan büyük ya da çok uzun PDF anlaşılır bir sorun olarak görünür', async ({ page, context }) => {
  await page.goto('/inceleme')
  await page.getByRole('radio', { name: 'PDF yükle' }).click()
  const big = Buffer.alloc(20 * 1024 * 1024 + 1, 0x20)
  big.write('%PDF-1.7\n')
  await page.locator('input[type=file]').setInputFiles({ name: 'buyuk.pdf', mimeType: 'application/pdf', buffer: big })
  await expect(page.locator('[data-finding="pdf-error-too_large"]')).toContainText('Dosya çok büyük', { timeout: 15_000 })

  const printer = await context.newPage()
  const pages = Array.from({ length: 31 }, (_, i) => `<p style="break-after:page">Sayfa ${i + 1}: deneme metni satırı</p>`).join('')
  await printer.setContent(`<html lang="tr"><body style="font-family: sans-serif">${pages}</body></html>`)
  const long = await printer.pdf()
  await printer.close()
  await page.locator('input[type=file]').setInputFiles({ name: 'uzun.pdf', mimeType: 'application/pdf', buffer: long })
  await expect(page.locator('[data-finding="pdf-error-too_long"]')).toContainText('PDF çok uzun', { timeout: 20_000 })
  await expect(page.locator('[data-finding="pdf-error-too_long"]')).toContainText('30 sayfalık')
})

test("kendi CV'nde ATS'nin gördüğü metin basılacak sırayla görünür", async ({ page }) => {
  const { cvId } = await seedBrokenCv(page)
  // Sayfa sayfa gösterimi denetlemek için CV bilerek birden çok sayfa (şablonun yoğunluğundan bağımsız).
  await patchCv(page, cvId, lengthenScript())
  await page.goto(`/inceleme?cv=${cvId}`)
  await page.getByRole('button', { name: "ATS'nin gördüğü metin" }).click()
  const text = page.getByTestId('ats-text')
  await expect(text).toBeVisible()
  await expect(page.getByText(/PDF'e basıldığında/)).toBeVisible()
  // Uzatılmış CV birden çok sayfa: metin sayfa sayfa
  await expect(text.getByText('Sayfa 2', { exact: true })).toBeVisible()
  const lines = (await text.locator('p.whitespace-pre-wrap').allInnerTexts()).map((l) => l.trim())
  // Başlık, iletişim (madde işaretsiz), sonra bölümler DOM sırasıyla
  expect(lines[0]).toBe('Deniz Aksoy')
  expect(lines.find((l) => l.includes('deniz.aksoy@example.com'))).not.toMatch(/^•/)
  // Basılan metin: CSS büyük harfi Türkçe kuralıyla (İ), unvan ile tarih aynı satırda geniş boşlukla
  const heading = lines.indexOf('KARİYER YOLCULUĞUM')
  expect(heading).toBeGreaterThan(0)
  expect(lines).toContain('Frontend Geliştirici   Şub 2024 – Günümüz')
  expect(lines.some((l) => l.startsWith('• Müşteri panelini React 19'))).toBe(true)
  expect(lines.indexOf('EĞİTİM')).toBeGreaterThan(heading)
})

test('Düzenle eksik bölümü ekleyip ilk kaydına, sayfa sayısında Görünüm sekmesine gider', async ({ page }) => {
  const { cvId } = await seedBrokenCv(page)
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ sections: { type: string }[] }>; put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
    const cv = await db.cvs.get(id)
    cv.sections = cv.sections.filter((s) => s.type !== 'education')
    // Sayfa sayısı bulgusu için CV birden çok sayfa olsun (şablonun yoğunluğundan bağımsız).
    const exp = cv.sections.find((s) => s.type === 'experience') as unknown as { items: Record<string, unknown>[] }
    for (let i = 1; i <= 6; i++) {
      exp.items.push({
        ...structuredClone(exp.items[0]),
        id: `ek-${i}`,
        translationGroupId: `ek-grup-${i}`,
        position: `Ek Görev ${i}`,
        description: '<ul>' + [1, 2, 3].map((k) => `<li>Görev ${i} maddesi ${k} ölçülebilir bir sonucu kısaca anlatır.</li>`).join('') + '</ul>',
      })
    }
    await db.cvs.put(cv)
  }, cvId)
  await page.goto(`/inceleme?cv=${cvId}`)
  const need = page.locator('[data-finding="need-education"]')
  await need.getByRole('button', { name: /Düzenle/ }).click()
  await page.waitForURL(`**/editor/${cvId}`)
  const section = page.getByRole('region', { name: 'Eğitim' })
  await expect(section).toBeVisible()
  await expect(section.locator('input').first()).toBeFocused()
  await expect(section.locator('[id^="item-"]')).toHaveCount(1)
  // Tek geri alma adımı: geri alınca bölüm gider
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await expect(section).toHaveCount(0)

  // Uzatılmış örnek CV birden çok sayfa: sayfa sayısı bulgusu Görünüm sekmesini açar
  await page.goto(`/inceleme?cv=${cvId}`)
  const pages = page.locator('[data-finding="pages"]')
  await expect(pages).toContainText(/CV [2-9] sayfa/)
  await pages.getByRole('button', { name: /Düzenle/ }).click()
  await page.waitForURL(`**/editor/${cvId}`)
  await expect(page.getByRole('radio', { name: 'Görünüm' })).toBeChecked()
})

test('Düzenle çift tıklanınca eksik bölüm bir kez eklenir (tek kayıt, tek geri alma adımı)', async ({ page }) => {
  const { cvId } = await seedBrokenCv(page)
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ sections: { type: string }[] }>; put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
    const cv = await db.cvs.get(id)
    cv.sections = cv.sections.filter((s) => s.type !== 'education')
    await db.cvs.put(cv)
  }, cvId)
  await page.goto(`/inceleme?cv=${cvId}`)
  await page.locator('[data-finding="need-education"]').getByRole('button', { name: /Düzenle/ }).dblclick()
  await page.waitForURL(`**/editor/${cvId}`)
  const section = page.getByRole('region', { name: 'Eğitim' })
  await expect(section).toBeVisible()
  await expect(section.locator('input').first()).toBeFocused()
  await page.waitForTimeout(300)
  await expect(page.getByRole('region', { name: 'Eğitim' })).toHaveCount(1)
  await expect(section.locator('[id^="item-"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await expect(section).toHaveCount(0)
})
