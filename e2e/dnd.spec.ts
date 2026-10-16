import { expect, test, type Page } from '@playwright/test'
import { createCv, preview } from './helpers.ts'

/** Klavyeyle sıralama: Boşluk tut, ok taşı, Boşluk bırak, Escape vazgeç. */

const sectionTitles = async (page: Page) => (await preview(page).locator('.section-title').allInnerTexts()).slice(0, 3)

const liveRegion = (page: Page, text: string) => page.locator('[id^="DndLiveRegion"]').filter({ hasText: text })
const sectionHandle = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true }).getByRole('button', { name: 'Bölümü sürükleyerek sırala' })

test('bölümler klavyeyle sıralanır, önizlemeye yansır, Ctrl+Z geri alır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  expect(await sectionTitles(page)).toEqual(['ÖZET', 'DENEYİM', 'EĞİTİM'])

  const handle = sectionHandle(page, 'Özet')
  await expect(handle).toHaveAttribute('aria-roledescription', 'sıralanabilir')
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(liveRegion(page, 'Tuttun: Özet')).toHaveCount(1)
  // Her ok tuşu öğeyi gerçekten taşır (panel kaydırılsa bile).
  await page.keyboard.press('ArrowDown')
  await expect(liveRegion(page, 'Özet: sıra 2 /')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(liveRegion(page, 'Özet: sıra 3 /')).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect.poll(() => sectionTitles(page)).toEqual(['DENEYİM', 'EĞİTİM', 'ÖZET'])
  await expect(liveRegion(page, 'Bıraktın: Özet')).toHaveCount(1)

  // Bırakınca odak tutamakta kalır; yukarı taşıma da çalışır.
  await expect(handle).toBeFocused()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Space')
  await expect.poll(() => sectionTitles(page)).toEqual(['DENEYİM', 'ÖZET', 'EĞİTİM'])

  await page.keyboard.press('Control+z')
  await expect.poll(() => sectionTitles(page)).toEqual(['DENEYİM', 'EĞİTİM', 'ÖZET'])
  await page.keyboard.press('Control+z')
  await expect.poll(() => sectionTitles(page)).toEqual(['ÖZET', 'DENEYİM', 'EĞİTİM'])
})

test('uzun bölüm panelin ortasını geçince de her ok tuşu öğeyi taşır', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 })
  await createCv(page, { start: 'sample' })
  const before = (await preview(page).locator('.section-title').allInnerTexts())
  const handle = sectionHandle(page, 'Deneyim')
  await handle.focus()
  await page.keyboard.press('Space')
  const panel = page.locator('[data-panel-scroll]')
  const startScroll = await panel.evaluate((el) => el.scrollTop)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await expect(liveRegion(page, 'Deneyim: sıra 5 /')).toHaveCount(1)
  // Hedef görünür kalsın diye panel kendiliğinden kayar.
  expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(startScroll)
  await page.keyboard.press('Space')
  const expected = [...before]
  expected.splice(1, 1)
  expected.splice(4, 0, 'DENEYİM')
  await expect.poll(async () => preview(page).locator('.section-title').allInnerTexts()).toEqual(expected)
})

test('Escape klavyeyle başlatılan taşımayı iptal eder', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await sectionHandle(page, 'Özet').focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(liveRegion(page, 'Vazgeçtin: Özet')).toHaveCount(1)
  expect(await sectionTitles(page)).toEqual(['ÖZET', 'DENEYİM', 'EĞİTİM'])
})

test('bölüm içindeki kayıtlar klavyeyle sıralanır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const experience = page.getByRole('region', { name: 'Deneyim' })
  const positions = () => experience.getByLabel('Pozisyon').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
  const before = await positions()
  expect(before.length).toBeGreaterThan(1)

  const handle = experience.getByRole('button', { name: 'Sürükleyerek sırala', exact: true }).first()
  await handle.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space')
  await expect.poll(positions).toEqual([before[1], before[0], ...before.slice(2)])
  const previewOrder = async () =>
    (await preview(page).locator('#cv-pages strong').allInnerTexts()).filter((t) => before.includes(t)).slice(0, 2)
  await expect.poll(previewOrder).toEqual([before[1], before[0]])

  await page.keyboard.press('Control+z')
  await expect.poll(positions).toEqual(before)
})
