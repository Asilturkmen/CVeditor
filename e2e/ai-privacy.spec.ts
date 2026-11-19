import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { continueToImport, createCv, openTemplate } from './helpers.ts'

/**
 * Yüklenen PDF'in yapay zekâ isteği (CV İnceleme): "Ne gönderilir?" gerçek
 * isteği gösterir; ad, konum (gövdede geçtiği yerler dahil) ve referans adları
 * maskelidir. PDF'te ad bulunamazsa göndermeden önce uyarı görünür.
 */

async function printPdf(context: BrowserContext, body: string) {
  const printer = await context.newPage()
  await printer.setContent(`<html lang="tr"><body style="font-family: sans-serif">${body}</body></html>`)
  const pdf = await printer.pdf()
  await printer.close()
  return pdf
}

async function uploadPdf(page: Page, pdf: Buffer) {
  await page.goto('/inceleme')
  await page.getByRole('radio', { name: 'PDF yükle' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf })
  await expect(page.getByTestId('review-ai').getByRole('button', { name: 'Yorum iste' })).toBeVisible({ timeout: 20_000 })
}

test('PDF: ad, konum ve referans adı "Ne gönderilir?"de maskeli; ad bulunduysa uyarı yok', async ({ page, context }) => {
  const pdf = await printPdf(
    context,
    `<h1>Ayşe Yılmaz</h1>
    <p>ayse.yilmaz@example.com | 0555 111 22 33 | Kadıköy, İstanbul</p>
    <h2>Deneyim</h2>
    <ul><li>İstanbul ofisinde raporlama sürecini yeniden kurdum.</li></ul>
    <h2>Referanslar</h2>
    <p>Mehmet Demir, Örnek A.Ş.</p>`,
  )
  await uploadPdf(page, pdf)
  const card = page.getByTestId('review-ai')
  await expect(card.getByTestId('ai-name-missing')).toHaveCount(0)
  await card.getByRole('button', { name: 'Ne gönderilir?' }).click()
  const dialog = page.getByRole('dialog')
  const payload = dialog.getByTestId('ai-payload')
  await expect(payload).toContainText('raporlama sürecini')
  for (const needle of ['Ayşe', 'Yılmaz', 'İstanbul', 'Kadıköy', 'Mehmet', 'Demir', 'example.com', '555']) {
    await expect(payload).not.toContainText(needle)
  }
  await expect(payload).toContainText('⟦REFNAME⟧')
  await expect(dialog.getByTestId('ai-payload-warning')).toHaveCount(0)
})

test('PDF\'te ad bulunamazsa göndermeden önce uyarı görünür (kart, karşılaştırma ve "Ne gönderilir?")', async ({ page, context }) => {
  const pdf = await printPdf(
    context,
    `<p>deneyimli bir yazılımcıyım, raporlar hazırladım.</p>
    <h2>Deneyim</h2>
    <ul><li>Raporlama sürecini yeniden kurdum.</li></ul>`,
  )
  await uploadPdf(page, pdf)
  const card = page.getByTestId('review-ai')
  await expect(card.getByTestId('ai-name-missing')).toContainText('PDF\'te adın bulunamadı')
  await card.getByRole('button', { name: 'Ne gönderilir?' }).click()
  await expect(page.getByRole('dialog').getByTestId('ai-payload-warning')).toContainText('PDF\'te adın bulunamadı')
  await page.keyboard.press('Escape')

  await page.getByLabel('İlan metni').fill('Raporlama ve Excel bilen biri arıyoruz.')
  await expect(page.getByTestId('keyword-ai').getByTestId('ai-name-missing')).toBeVisible()
})

/** Şablonlar → Zarif → Türkçe → "Eski CV'yi içe aktar"; örnek sağlayıcı gerçek sağlayıcı gibi davranır (`live`). */
async function openLiveImport(page: Page) {
  await page.goto('/sablonlar')
  await page.evaluate(() => localStorage.setItem('cveditor:mockAi', JSON.stringify({ live: true })))
  await openTemplate(page, 'Zarif')
  await page.getByRole('radio', { name: 'Türkçe' }).click()
  await continueToImport(page)
}

const pickImport = (page: Page, pdf: Buffer) =>
  page.getByTestId('import-file').setInputFiles({ name: 'eski-cv.pdf', mimeType: 'application/pdf', buffer: pdf })

test('içe aktarma (gerçek sağlayıcı): göndermeden önce maskeli metin gösterilir; Vazgeç hiçbir şey göndermez, Gönder sürer', async ({ page, context }) => {
  const pdf = await printPdf(
    context,
    `<p style="font-size:11px">CURRICULUM VITAE</p>
    <h1 style="font-size:30px">Ayşe Yılmaz</h1>
    <p>ayse.yilmaz@example.com | 0(532) 123 45 67 | LinkedIn: aysecodes</p>
    <p>Doğum Tarihi: 12.03.1995</p>
    <h2>Deneyim</h2>
    <p>Kıdemli Analist — Örnek A.Ş. — 03.2020 – 05.2022</p>
    <ul><li>Raporlama sürecini yeniden kurdum.</li></ul>`,
  )
  await openLiveImport(page)
  await expect(page.getByText(/gidecek metnin tamamını görüp sen onaylarsın/)).toBeVisible()
  await pickImport(page, pdf)
  const confirm = page.getByTestId('import-confirm')
  await expect(confirm).toBeVisible()
  const sent = confirm.getByTestId('import-send-text')
  await expect(sent).toContainText('Raporlama sürecini')
  await expect(sent).toContainText('03.2020 – 05.2022')
  for (const needle of ['Ayşe', 'Yılmaz', 'example.com', '532', 'aysecodes', '1995']) await expect(sent).not.toContainText(needle)
  await expect(sent).toContainText('⟦BIRTHDATE⟧')
  // Ad "CURRICULUM VITAE" sanılmadı: uyarı yok
  await expect(confirm.getByTestId('ai-name-missing')).toHaveCount(0)

  await confirm.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(page.getByText("Eski CV'nin PDF'ini seç")).toBeVisible()

  await pickImport(page, pdf)
  await page.getByTestId('import-confirm').getByRole('button', { name: 'Gönder' }).click()
  await expect(page.getByText(/Kayıtları yapay zekâ ayırdı/)).toBeVisible()
  await expect(page.getByLabel('Ad soyad')).toHaveValue('Ayşe Yılmaz')
  await expect(page.getByTestId('import-contacts')).toContainText('ayse.yilmaz@example.com')
})

test('içe aktarma (gerçek sağlayıcı): ad bulunamazsa onay adımında uyarı görünür', async ({ page, context }) => {
  const pdf = await printPdf(
    context,
    `<p>deneyimli bir yazılımcıyım, raporlar hazırladım.</p>
    <h2>Deneyim</h2>
    <ul><li>Raporlama sürecini yeniden kurdum.</li></ul>`,
  )
  await openLiveImport(page)
  await pickImport(page, pdf)
  await expect(page.getByTestId('import-confirm').getByTestId('ai-name-missing')).toContainText('PDF\'te adın güvenle bulunamadı')
})

test('düzenleme: anahtar kelime iletişimi kendiliğinden göndermez; kutu seçilirse gider', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const box = page.getByLabel('Yapay zekâdan iste')
  await box.fill('Telefonumu özete ekle')
  await page.getByRole('button', { name: 'Ne gönderilir?' }).click()
  await expect(page.getByTestId('ai-payload')).not.toContainText('"phone"')
  await page.keyboard.press('Escape')
  await page.getByLabel('İletişim bilgilerimi de gönder').check()
  await page.getByRole('button', { name: 'Ne gönderilir?' }).click()
  await expect(page.getByTestId('ai-payload')).toContainText('"phone"')
})
