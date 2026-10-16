import { expect, test, type Page } from '@playwright/test'
import { createCv, preview } from './helpers.ts'

/** Klavyeyle sıralama: Boşluk tut, ok taşı, Boşluk bırak, Escape vazgeç. */

const sectionTitles = async (page: Page) => (await preview(page).locator('.section-title').allInnerTexts()).slice(0, 3)

const liveRegion = (page: Page, text: string) => page.locator('[id^="DndLiveRegion"]').filter({ hasText: text })
const sectionHandle = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true }).getByRole('button', { name: 'Bölümü sürükleyerek sırala' })

/*
 * dnd-kit klavye sensörü ok tuşlarını Boşluk'tan bir tik sonra dinlemeye başlar;
 * tuşlar arka arkaya gönderilirse ilk ok kaybolabilir. Bu yüzden her adımdan sonra
 * ekran okuyucu duyurusu (sürükleme başladı / yeni sıra) beklenir: sabit bekleme yok.
 */
async function pickUp(page: Page, name: string) {
  await page.keyboard.press('Space')
  await expect(liveRegion(page, `Tuttun: ${name}`)).toHaveCount(1)
}
async function moveTo(page: Page, key: 'ArrowDown' | 'ArrowUp', name: string, pos: number) {
  await page.keyboard.press(key)
  await expect(liveRegion(page, `${name}: sıra ${pos} /`)).toHaveCount(1)
}
async function drop(page: Page, name: string) {
  await page.keyboard.press('Space')
  await expect(liveRegion(page, `Bıraktın: ${name}`)).toHaveCount(1)
}

test('bölümler klavyeyle sıralanır, önizlemeye yansır, Ctrl+Z geri alır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  expect(await sectionTitles(page)).toEqual(['ÖZET', 'DENEYİM', 'EĞİTİM'])

  const handle = sectionHandle(page, 'Özet')
  await expect(handle).toHaveAttribute('aria-roledescription', 'sıralanabilir')
  await handle.focus()
  await pickUp(page, 'Özet')
  // Her ok tuşu öğeyi gerçekten taşır (panel kaydırılsa bile).
  await moveTo(page, 'ArrowDown', 'Özet', 2)
  await moveTo(page, 'ArrowDown', 'Özet', 3)
  await drop(page, 'Özet')
  await expect.poll(() => sectionTitles(page)).toEqual(['DENEYİM', 'EĞİTİM', 'ÖZET'])

  // Bırakınca odak tutamakta kalır; yukarı taşıma da çalışır.
  await expect(handle).toBeFocused()
  await pickUp(page, 'Özet')
  await moveTo(page, 'ArrowUp', 'Özet', 2)
  await drop(page, 'Özet')
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
  await pickUp(page, 'Deneyim')
  const panel = page.locator('[data-panel-scroll]')
  const startScroll = await panel.evaluate((el) => el.scrollTop)
  for (const pos of [3, 4, 5]) await moveTo(page, 'ArrowDown', 'Deneyim', pos)
  // Hedef görünür kalsın diye panel kendiliğinden kayar.
  expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(startScroll)
  await drop(page, 'Deneyim')
  const expected = [...before]
  expected.splice(1, 1)
  expected.splice(4, 0, 'DENEYİM')
  await expect.poll(async () => preview(page).locator('.section-title').allInnerTexts()).toEqual(expected)
})

test('Escape klavyeyle başlatılan taşımayı iptal eder', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await sectionHandle(page, 'Özet').focus()
  await pickUp(page, 'Özet')
  await moveTo(page, 'ArrowDown', 'Özet', 2)
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
  // Duyurudaki ad kart başlığıyla aynı ("Pozisyon — Şirket").
  const label = (await experience.locator('[id^="item-"]').first().locator('span[title]').first().getAttribute('title'))!
  await handle.focus()
  await pickUp(page, label)
  await moveTo(page, 'ArrowDown', label, 2)
  await drop(page, label)
  await expect.poll(positions).toEqual([before[1], before[0], ...before.slice(2)])
  const previewOrder = async () =>
    (await preview(page).locator('#cv-pages strong').allInnerTexts()).filter((t) => before.includes(t)).slice(0, 2)
  await expect.poll(previewOrder).toEqual([before[1], before[0]])

  await page.keyboard.press('Control+z')
  await expect.poll(positions).toEqual(before)
})
