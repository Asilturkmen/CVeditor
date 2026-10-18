import { expect, type FrameLocator, type Page } from '@playwright/test'

export const preview = (page: Page): FrameLocator => page.frameLocator('iframe[title="CV önizleme"]')

/** Şablonlar ekranından yeni CV oluşturur ve editörü açar. */
export async function createCv(
  page: Page,
  /** `template`: şablonun arayüzdeki (Türkçe) adı, ör. "Zarif" */
  options: { template?: string; name?: string; language?: 'Türkçe' | 'İngilizce'; start?: 'blank' | 'sample' } = {},
) {
  const { template = 'Zarif', name, language, start = 'blank' } = options
  await page.goto('/sablonlar')
  await page.getByRole('button', { name: new RegExp(`${template} şablonunu seç`) }).click()
  if (language) await page.getByRole('radio', { name: language }).click()
  if (name) await page.getByLabel('CV adı').fill(name)
  await page.getByRole('button', { name: 'Devam' }).click()
  if (start === 'sample') {
    await page.getByRole('radio', { name: /Eski CV'yi içe aktar/ }).click()
    await page.getByRole('button', { name: 'Devam' }).click()
    await page.getByRole('button', { name: 'Örnekle göster' }).click()
    await expect(page.getByText('Bulunan kayıtlar (örnek veri)')).toBeVisible()
  }
  await page.getByRole('button', { name: "CV'yi oluştur" }).click()
  await page.waitForURL(/\/editor\//)
  await expect(preview(page).locator('.page').first()).toBeVisible()
  return page.url().split('/').pop()!
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
