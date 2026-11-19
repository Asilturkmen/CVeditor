import { expect, type FrameLocator, type Page } from '@playwright/test'

export const preview = (page: Page): FrameLocator => page.frameLocator('iframe[title="CV önizleme"]')

/**
 * Şablon sayfasını açar (Şablonlar → karta tıkla): büyük önizleme + Yeni CV formu tek sayfada.
 * `template`: şablonun arayüzdeki (Türkçe) adı, ör. "Zarif".
 */
export async function openTemplate(page: Page, template = 'Zarif') {
  await page.goto('/sablonlar')
  await page.getByRole('button', { name: new RegExp(`${template} şablonunu seç`) }).click()
  await expect(page.locator('[data-template-sheet]')).toBeVisible()
}

/**
 * Şablon sayfasında "Eski CV'yi içe aktar"ı seçip "Devam: PDF seç" ile içe aktarma penceresini açar
 * (dosya seçimi → bulunan kayıtlar; "CV'yi oluştur" bu pencerede).
 */
export async function continueToImport(page: Page) {
  await page.getByRole('radio', { name: /Eski CV'yi içe aktar/ }).click()
  await page.getByRole('button', { name: 'Devam: PDF seç' }).click()
  await expect(page.getByText("Eski CV'nin PDF'ini seç")).toBeVisible()
}

/**
 * Şablonlar ekranından yeni CV oluşturur ve editörü açar. Akış: şablon kartı → şablon sayfası
 * (ad, dil, başlangıç aynı sayfada) → "Bu şablonla başla"; örnekle başlarken "Devam: PDF seç" →
 * içe aktarma penceresinde "Örnekle göster" → "CV'yi oluştur".
 */
export async function createCv(
  page: Page,
  /** `template`: şablonun arayüzdeki (Türkçe) adı, ör. "Zarif" */
  options: { template?: string; name?: string; language?: 'Türkçe' | 'İngilizce'; start?: 'blank' | 'sample' } = {},
) {
  const { template = 'Zarif', name, language, start = 'blank' } = options
  await openTemplate(page, template)
  if (language) await page.getByRole('radio', { name: language }).click()
  if (name) await page.getByLabel('CV adı').fill(name)
  if (start === 'sample') {
    await continueToImport(page)
    await page.getByRole('button', { name: 'Örnekle göster' }).click()
    await expect(page.getByText('Bulunan kayıtlar (örnek veri)')).toBeVisible()
    await page.getByRole('button', { name: "CV'yi oluştur" }).click()
  } else {
    await page.getByRole('button', { name: 'Bu şablonla başla' }).click()
  }
  await page.waitForURL(/\/editor\//)
  await expect(preview(page).locator('.page').first()).toBeVisible()
  return page.url().split('/').pop()!
}

/**
 * Sağ paneldeki anahatta bir kaydı açar (kapalıysa). `scope`: kayıt satırını içeren metin ya da
 * locator (ör. bölüm). Kapalı kaydın alanları çizilmez; alana yazmadan önce kayıt açılır.
 */
export async function openRow(page: Page, text: string | RegExp, index = 0) {
  const row = page.locator('[id^="item-"]', { hasText: text }).nth(index)
  const toggle = row.locator('[aria-expanded]').first()
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return row
}

/** Bölümdeki n. kaydı açar (adı olmayan boş kayıtlar için). */
export async function openRowIn(page: Page, section: string, index = 0) {
  const row = page.getByRole('region', { name: section, exact: true }).locator('[id^="item-"]').nth(index)
  const toggle = row.locator('[aria-expanded]').first()
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return row
}

/** Geliştirme sunucusunda açık olan veritabanı üzerinden CV değiştirir. */
export async function patchCv(page: Page, cvId: string, script: string) {
  await page.waitForFunction(() => '__cveditorDb' in window)
  await page.evaluate(
    async ({ id, body }) => {
      const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<unknown>; put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
      const cv = await db.cvs.get(id)
      new Function('cv', body)(cv)
      await db.cvs.put(cv)
    },
    { id: cvId, body: script },
  )
}
