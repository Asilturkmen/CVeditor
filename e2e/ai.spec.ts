import { expect, test } from '@playwright/test'
import { createCv, preview } from './helpers.ts'

const promptBox = (page: import('@playwright/test').Page) => page.getByLabel('Yapay zekâdan iste')

test('öneri: alan + ekleme + kaldırma işaretlenir, toplu kabul tek Ctrl+Z ile geri alınır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const frame = preview(page)
  await expect(frame.getByText('Serbest Web Geliştirici')).toBeVisible()

  await promptBox(page).fill('Deneyim maddelerini daha ölçülebilir yaz, bir kayıt ekle ve son kaydı sil')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toBeVisible({ timeout: 5000 })

  // Listede tür etiketleri, önizlemede geçici işaretler.
  await expect(page.getByText('Yeni kayıt', { exact: true })).toBeVisible()
  await expect(page.getByText('Kaldırılacak', { exact: true })).toBeVisible()
  await expect(page.getByText('Örnek', { exact: true })).toBeVisible()
  await expect(frame.locator('.sg-added')).toHaveCount(1)
  await expect(frame.locator('.sg-removed')).toContainText('Serbest Web Geliştirici')
  await expect(frame.locator('.sg-block')).toHaveCount(1)
  // Sağ panelde öneri bekleyen kartlar işaretli (kartın solunda nokta).
  const marker = await page
    .locator('[id^="item-"]', { hasText: 'Serbest Web Geliştirici' })
    .first()
    .evaluate((el) => getComputedStyle(el, '::before').content)
  expect(marker).toBe('""')

  await page.getByRole('button', { name: 'Tümünü kabul et' }).click()
  await expect(frame.locator('.sg')).toHaveCount(0)
  await expect(frame.getByText('Örnek Şirket')).toBeVisible()
  await expect(frame.getByText('Serbest Web Geliştirici')).toHaveCount(0)
  await expect(frame.getByText('teslim süresini yaklaşık %20')).toBeVisible()
  // Kabul edilen kayıt önizlemede kısa süre parlar.
  await expect(frame.locator('.sg-flash').first()).toBeAttached()

  await page.keyboard.press('Control+z')
  await expect(frame.getByText('Serbest Web Geliştirici')).toBeVisible()
  await expect(frame.getByText('Örnek Şirket')).toHaveCount(0)
  await expect(frame.getByText('teslim süresini yaklaşık %20')).toHaveCount(0)
})

test('Durdur isteği iptal eder; öneri gelmez', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await promptBox(page).fill('Özeti daha somut yaz')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Öneriler hazırlanıyor')).toBeVisible()
  await page.getByRole('button', { name: 'Durdur' }).click()
  await expect(page.getByText('Enter gönderir')).toBeVisible()
  await page.waitForTimeout(1300)
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toHaveCount(0)
  await expect(promptBox(page)).toHaveValue('Özeti daha somut yaz')
})

test('"Ne gönderilir?" gidecek veriyi gösterir; ad ve e-posta yok', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await promptBox(page).fill('Özeti kısalt')
  await page.getByRole('button', { name: 'Ne gönderilir?' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Yapay zekâya ne gönderilir?' })).toBeVisible()
  const payload = dialog.getByTestId('ai-payload')
  await expect(payload).toContainText('"prompt": "Özeti kısalt"')
  await expect(payload).toContainText('Frontend Geliştirici')
  await expect(payload).not.toContainText('deniz.aksoy@example.com')
  await expect(payload).not.toContainText('Deniz Aksoy')
  await page.keyboard.press('Escape')

  // İstek iletişimle ilgiliyse yalnız ilgili alan gider.
  await promptBox(page).fill('E-posta adresimi düzelt')
  await page.getByRole('button', { name: 'Ne gönderilir?' }).click()
  await expect(page.getByTestId('ai-payload')).toContainText('deniz.aksoy@example.com')
  await expect(page.getByTestId('ai-payload')).not.toContainText('+90 555')
})

test('önizleme vurgusu odak panelden çıkınca ve Görünüm sekmesinde kalkar', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const frame = preview(page)
  await page.locator('[id^="item-"]', { hasText: 'Kampüs Etkinlik Takvimi' }).first().getByLabel('Rol').click()
  await expect(frame.locator('.is-focused')).toHaveCount(1)
  await page.getByRole('heading', { name: 'Kişisel bilgiler' }).click()
  await expect(frame.locator('.is-focused')).toHaveCount(0)

  // "Seçili kayıt" kapsamı odak çıktıktan sonra da sunulur.
  await page.getByRole('button', { name: 'Kapsam' }).click()
  await expect(page.getByRole('menuitem', { name: /Seçili kayıt: Kampüs Etkinlik Takvimi/ })).toBeVisible()
  await page.keyboard.press('Escape')
  // Menü kapanınca odak tetikleyiciye döner; ardından tıklanmalı.
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kapsam' })).toBeFocused()

  await page.locator('[id^="item-"]', { hasText: 'Kampüs Etkinlik Takvimi' }).first().getByLabel('Rol').click()
  await expect(frame.locator('.is-focused')).toHaveCount(1)
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  await expect(frame.locator('.is-focused')).toHaveCount(0)
})

test('yakınlaştırma çubuğu sayfanın altında; yüzdeye tıklamak %100 yapar', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.getByRole('button', { name: 'Uzaklaştır' }).click()
  const readout = page.getByRole('group', { name: 'Yakınlaştırma' }).getByRole('button', { name: /%$/ })
  await expect(readout).not.toHaveText('100%')
  await readout.click()
  await expect(readout).toHaveText('100%')
  await expect(page.getByRole('button', { name: '100%' })).toHaveCount(1)
})
