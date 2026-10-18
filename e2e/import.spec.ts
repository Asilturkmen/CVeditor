import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { encryptedPdf, enCvPdf, fakePdf, imageOnlyPdf, trCvPdf } from './fixtures/pdfs.ts'
import { preview } from './helpers.ts'

/** Şablonlar → Zarif → (dil) → "Eski CV'yi içe aktar" → PDF seçimi ekranı */
async function openImport(page: Page, language: 'Türkçe' | 'İngilizce' = 'Türkçe') {
  await page.goto('/sablonlar')
  await page.getByRole('button', { name: /Zarif şablonunu seç/ }).click()
  await page.getByRole('radio', { name: language }).click()
  await page.getByRole('button', { name: 'Devam' }).click()
  await page.getByRole('radio', { name: /Eski CV'yi içe aktar/ }).click()
  await page.getByRole('button', { name: 'Devam' }).click()
  await expect(page.getByText("Eski CV'nin PDF'ini seç")).toBeVisible()
}

const pick = (page: Page, name: string, buffer: Buffer) =>
  page.getByTestId('import-file').setInputFiles({ name, mimeType: 'application/pdf', buffer })

test('Türkçe PDF içe aktarılır: dil, iletişim, deneyim kayıtları önizlemeye gelir', async ({ page, browser }) => {
  const pdf = await trCvPdf(browser)
  await openImport(page)
  await pick(page, 'ece-cv.pdf', pdf)

  await expect(page.getByText(/Kayıtlar kurallarla ayrıldı/)).toBeVisible()
  await expect(page.getByTestId('import-language')).toHaveText("PDF'in dili: Türkçe")
  await expect(page.getByText(/ece-cv\.pdf · 1 sayfa/)).toBeVisible()
  await expect(page.getByText(/görünüyor, CV'yi ise/)).toHaveCount(0)
  await expect(page.getByLabel('Ad soyad')).toHaveValue('Ece Yıldırım')
  await expect(page.getByLabel('Unvan')).toHaveValue('Kıdemli Frontend Geliştirici')
  const contacts = page.getByTestId('import-contacts')
  await expect(contacts).toContainText('ece.yildirim@example.com')
  await expect(contacts).toContainText('+90 532 000 12 34')
  await expect(contacts).toContainText('linkedin.com/in/ece-yildirim-ornek')

  const records = page.getByTestId('import-record')
  await expect(records.filter({ hasText: 'Kıdemli Frontend Geliştirici — Örnek Teknoloji A.Ş.' })).toContainText('Şub 2022 – Günümüz')
  await expect(records.filter({ hasText: 'Frontend Geliştirici — Deneme Yazılım Ltd.' })).toContainText('Haz 2019 – Oca 2022')

  // Kaydı açıp alanı düzelt; sertifikayı dışarıda bırak
  await records.filter({ hasText: 'Deneme Yazılım' }).getByRole('button', { name: 'Alanları göster' }).click()
  await page.getByLabel('Konum').last().fill('Ankara, Türkiye')
  await records.filter({ hasText: 'AWS Certified' }).locator('label').click()
  await expect(page.getByText('9/10 kayıt seçili')).toBeVisible()

  // Ham metin paneli
  await page.getByText("PDF'ten okunan metin").click()
  await expect(page.locator('pre')).toContainText('İŞ DENEYİMİ')

  await page.getByRole('button', { name: "CV'yi oluştur" }).click()
  await page.waitForURL(/\/editor\//)
  const frame = preview(page)
  await expect(frame.locator('.page').first()).toContainText('Ece Yıldırım')
  await expect(frame.locator('.page').first()).toContainText('Örnek Teknoloji A.Ş.')
  await expect(frame.locator('.page').first()).toContainText('Ankara, Türkiye')
  await expect(frame.locator('.page').first()).toContainText('talepleri belirgin şekilde azaldı')
  await expect(frame.locator('body')).not.toContainText('AWS Certified')
})

test('İngilizce PDF Türkçe CV seçiliyken uyarı verir; tek tıkla CV dili İngilizce olur', async ({ page, browser }) => {
  const pdf = await enCvPdf(browser)
  await openImport(page, 'Türkçe')
  await pick(page, 'alex.pdf', pdf)

  await expect(page.getByTestId('import-language')).toHaveText("PDF'in dili: İngilizce")
  await expect(page.getByText("PDF İngilizce görünüyor, CV'yi ise Türkçe oluşturuyorsun.", { exact: false })).toBeVisible()
  // İki sütunlu düzende ad, yan sütundaki iletişim bilgileri ve kayıtlar
  await expect(page.getByLabel('Ad soyad')).toHaveValue('Alex Morgan')
  await expect(page.getByTestId('import-contacts')).toContainText('London, United Kingdom')
  await expect(page.getByTestId('import-record').filter({ hasText: 'Senior Backend Engineer — Sample Payments Ltd' })).toBeVisible()

  await page.getByRole('button', { name: 'CV dilini İngilizce yap' }).click()
  await expect(page.getByText(/görünüyor, CV'yi ise/)).toHaveCount(0)
  // Bölüm başlıkları artık CV diliyle
  await expect(page.getByTestId('import-section').first()).toContainText('Summary')

  await page.getByRole('button', { name: "CV'yi oluştur" }).click()
  await page.waitForURL(/\/editor\//)
  await expect(preview(page).locator('html')).toHaveAttribute('lang', 'en')
  await expect(preview(page).locator('.page').first()).toContainText('Experience')
  await expect(preview(page).locator('.page').first()).toContainText('Jan 2021 – Present')
})

test('metni görsel olan PDF açık hata verir; PDF olmayan dosya da', async ({ page, browser }) => {
  const image = await imageOnlyPdf(browser)
  await openImport(page)
  await pick(page, 'gorsel.pdf', image)
  await expect(page.getByRole('alert')).toContainText("Bu PDF'te okunabilir metin yok")
  await expect(page.getByRole('alert')).toContainText('OCR')
  await expect(page.getByRole('button', { name: "CV'yi oluştur" })).toBeDisabled()

  await pick(page, 'not.pdf', fakePdf())
  await expect(page.getByRole('alert')).toContainText('Bu dosya PDF değil')
})

test('parolalı PDF açık "parolalı" hatası verir; CV oluşturulamaz', async ({ page }) => {
  const tr = JSON.parse(readFileSync(new URL('../messages/tr.json', import.meta.url), 'utf8')) as Record<string, string>
  await openImport(page)
  await pick(page, 'parolali.pdf', encryptedPdf())
  const alert = page.getByRole('alert')
  await expect(alert).toContainText(tr.imp_err_encrypted_title)
  await expect(alert).toContainText(tr.imp_err_encrypted_body)
  await expect(page.getByRole('button', { name: "CV'yi oluştur" })).toBeDisabled()
})
