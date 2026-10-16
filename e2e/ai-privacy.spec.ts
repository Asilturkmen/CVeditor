import { expect, test, type BrowserContext, type Page } from '@playwright/test'

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

  await page.getByRole('button', { name: /İş ilanı/ }).click()
  await page.getByLabel('İlan metni').fill('Raporlama ve Excel bilen biri arıyoruz.')
  await expect(page.getByTestId('keyword-ai').getByTestId('ai-name-missing')).toBeVisible()
})
