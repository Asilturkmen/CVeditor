import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { createCv } from './helpers.ts'

/**
 * Sağlayıcı şemaya uymayan bir yanıt döndürdüğünde kullanıcı açık bir hata
 * görür, öneri gösterilmez. Örnek sağlayıcı localStorage'daki deneme
 * bayrağıyla (`cveditor:mockAi` → { malformed: true }) bozuk yanıt döndürür.
 */
const tr = JSON.parse(readFileSync(new URL('../messages/tr.json', import.meta.url), 'utf8')) as Record<string, string>

/** Bayrak CV oluşturulduktan sonra konur: içe aktarma örneği bozuk yanıttan etkilenmesin. */
const breakMockAi = (page: Page) => page.evaluate(() => localStorage.setItem('cveditor:mockAi', JSON.stringify({ malformed: true })))

test('bozuk düzenleme yanıtı hata bildirimi gösterir; öneri gelmez, istek kutuda kalır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await breakMockAi(page)

  const promptBox = page.getByLabel('Yapay zekâdan iste')
  await promptBox.fill('Özeti daha somut yaz')
  await page.keyboard.press('Enter')

  const toast = page.getByRole('status').filter({ hasText: tr.ai2_error_invalid })
  await expect(toast).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toHaveCount(0)
  await expect(promptBox).toHaveValue('Özeti daha somut yaz')
  await expect(promptBox).toBeEnabled()
})

test('bozuk çeviri yanıtı çeviri penceresinde hata gösterir', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await breakMockAi(page)

  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Diğer dile çevir' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Çevir' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 5000 })
  await expect(dialog.getByRole('heading', { name: 'Çeviriyi kontrol et' })).toHaveCount(0)
})
