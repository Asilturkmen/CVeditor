import { expect, test } from '@playwright/test'

test('arayüz dili Ayarlar\'dan İngilizceye geçer, yenileyince kalır, Türkçeye döner', async ({ page }) => {
  await page.goto('/ayarlar')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  const nav = page.getByRole('navigation', { name: 'Ana gezinme' })
  await expect(nav.getByRole('link', { name: "CV'lerim" })).toBeVisible()

  // Dil seçimi sayfayı yeniden yükler.
  await Promise.all([page.waitForEvent('load'), page.getByRole('radio', { name: 'English' }).click()])
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const enNav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(enNav.getByRole('link', { name: 'My CVs' })).toBeVisible()
  await expect(enNav.getByRole('link', { name: 'Templates' })).toBeVisible()
  await expect(enNav.getByRole('link', { name: 'Review' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(enNav.getByRole('link', { name: 'My CVs' })).toBeVisible()
  await page.goto('/sablonlar')
  await expect(page.getByRole('heading', { name: 'Welcome to CVeditör' })).toBeVisible()

  await page.goto('/ayarlar')
  await Promise.all([page.waitForEvent('load'), page.getByRole('radio', { name: 'Türkçe' }).click()])
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(nav.getByRole('link', { name: "CV'lerim" })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible()
})
