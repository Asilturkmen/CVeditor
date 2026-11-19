import { expect, test, type Page } from '@playwright/test'
import { continueToImport, createCv, openTemplate } from './helpers.ts'

/**
 * Bağımsız tasarım eleştirisindeki (Q) arayüz bulgularının düzeltmeleri: sekme başına kaydırma,
 * yazı tipi menüsü, sürüklenen satırın kopyası, şablon sayfasında başlangıç seçenekleri, öneri
 * tepsisinin yüksekliği, boş CV, içe aktarma penceresinin ritmi, İnceleme'nin sütunları.
 */
test.describe.configure({ timeout: 60_000 })

const panel = (page: Page) => page.locator('[data-panel-scroll]')
const scrollTop = (page: Page) => panel(page).evaluate((el) => el.scrollTop)

test('Görünüm İçerik\'in kaydırma konumunda açılmaz; her sekme kendi konumunu hatırlar', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await panel(page).evaluate((el) => (el.scrollTop = 900))
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(400)
  const contentTop = await scrollTop(page)

  await page.getByRole('radio', { name: 'Görünüm' }).click()
  // İlk açılış en üstten: Şablon satırı görünür.
  await expect.poll(() => scrollTop(page)).toBe(0)
  await expect(page.getByRole('button', { name: 'Değiştir…' })).toBeInViewport()

  await panel(page).evaluate((el) => (el.scrollTop = 150))
  await page.getByRole('radio', { name: 'İçerik' }).click()
  await expect.poll(() => scrollTop(page)).toBe(contentTop)
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  await expect.poll(() => scrollTop(page)).toBe(150)
})

test('yazı tipi menüsü: en az 280px, pencere kenarından 12px içeride, segmenti örtmez, satır kırılmaz; klavyeyle seçilir', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  const trigger = page.getByRole('combobox', { name: 'Yazı tipi' })
  // Açıkken menü dışı erişilebilirlik ağacından gizlenir: segmentin yeri önce ölçülür.
  const tabs = (await page.getByRole('radiogroup', { name: 'Düzenleme paneli' }).boundingBox())!
  await trigger.click()
  const list = page.getByRole('listbox')
  await expect(list).toBeVisible()
  // Açılış animasyonu (ölçek .96 → 1) bitince ölç.
  await list.evaluate((el) => Promise.all((el.closest('.pop') ?? el).getAnimations({ subtree: true }).map((a) => a.finished)))
  const box = (await list.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.width).toBeGreaterThanOrEqual(280)
  expect(viewport.width - (box.x + box.width)).toBeGreaterThanOrEqual(11.5)
  expect(box.y).toBeGreaterThanOrEqual(tabs.y + tabs.height)
  // Her seçenek tek satır (ad ve örnek yan yana).
  const heights = await list.getByRole('option').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
  for (const h of heights) expect(h).toBeLessThan(40)

  // Klavye: iki ok + Enter iki sonraki (listenin sonundaysa iki önceki) yazı tipini seçer, menü kapanır.
  const options = list.getByRole('option')
  const count = await options.count()
  const selected = await options.evaluateAll((els) => els.findIndex((el) => el.getAttribute('aria-selected') === 'true'))
  const step = selected + 2 < count ? 1 : -1
  const key = step > 0 ? 'ArrowDown' : 'ArrowUp'
  await expect(options.nth(selected)).toBeFocused()
  await page.keyboard.press(key)
  await expect(options.nth(selected + step)).toBeFocused()
  await page.keyboard.press(key)
  await expect(options.nth(selected + 2 * step)).toBeFocused()
  const expected = (await options.nth(selected + 2 * step).innerText()).split(/\s*\n/)[0].trim()
  await page.keyboard.press('Enter')
  await expect(list).toHaveCount(0)
  await expect(trigger).toContainText(expected)
})

test('sürüklenen kayıt satırının kopyası grubun dışında çizilir (kırpılmaz)', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const section = page.getByRole('region', { name: 'Deneyim', exact: true })
  const row = section.locator('[data-row]').nth(1)
  const handle = row.getByRole('button', { name: 'Sürükleyerek sırala' })
  const position = (await row.locator('[data-row-title]').innerText()).trim()
  await handle.scrollIntoViewIfNeeded()
  const b = (await handle.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y - 20, { steps: 5 })
  await page.mouse.move(b.x + b.width / 2, b.y - 80, { steps: 8 })
  const ghost = page.locator('[data-drag-ghost]')
  await expect(ghost).toBeVisible()
  // Kopya gövdede (grubun overflow-hidden'ında değil) ve satırın adını taşır.
  expect(await ghost.evaluate((el) => el.closest('[data-section-id]') === null)).toBe(true)
  await expect(ghost).toContainText(position)
  await page.mouse.up()
  await expect(ghost).toHaveCount(0)
})

test.describe('1280×720', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('şablon sayfası: başlangıç seçenekleri ve ana düğme katlamanın üstünde; galeriden içe aktarma seçili ve görünür', async ({ page }) => {
    await openTemplate(page, 'Zarif')
    const sheet = page.locator('[data-template-sheet]')
    await expect(sheet.getByRole('radio', { name: /Boş CV/ })).toBeInViewport()
    await expect(sheet.getByRole('radio', { name: /Eski CV'yi içe aktar/ })).toBeInViewport()
    await expect(sheet.getByRole('button', { name: 'Bu şablonla başla' })).toBeInViewport()

    await page.goto('/sablonlar')
    await page.getByRole('button', { name: "Eski CV'ni içe aktar (PDF)" }).click()
    const imp = page.locator('[data-template-sheet]').getByRole('radio', { name: /Eski CV'yi içe aktar/ })
    await expect(imp).toBeChecked()
    await expect(imp).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('button', { name: 'Devam: PDF seç' })).toBeInViewport()
  })

  test('öneri tepsisi panelin en çok ~%35\'i; toplu eylemler görünür, liste kendi içinde kayar', async ({ page }) => {
    await createCv(page, { start: 'sample' })
    const box = page.getByLabel('Yapay zekâdan iste')
    await box.click()
    await box.fill('Deneyim maddelerini daha ölçülebilir yaz, bir kayıt ekle ve son kaydı sil')
    await page.keyboard.press('Enter')
    const accept = page.getByRole('button', { name: 'Tümünü kabul et' })
    await expect(accept).toBeVisible({ timeout: 8000 })
    await expect(accept).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Tümünü reddet' })).toBeInViewport()
    const ratio = await accept.evaluate((el) => {
      const tray = el.closest('.rounded-xl')!.getBoundingClientRect()
      const inspector = document.querySelector('[data-panel-scroll]')!.parentElement!.getBoundingClientRect()
      return tray.height / inspector.height
    })
    expect(ratio).toBeLessThanOrEqual(0.36)
  })
})

test('boş CV: bölümlerde hazır "Adsız kayıt" yok, panelde boş durum metni; ilk yazıyla kaybolur', async ({ page }) => {
  await createCv(page)
  const intro = page.locator('[data-empty-intro]')
  await expect(intro).toBeVisible()
  await expect(page.getByLabel('Ad soyad')).toBeVisible()
  const experience = page.getByRole('region', { name: 'Deneyim', exact: true })
  await expect(experience.locator('[id^="item-"]')).toHaveCount(0)
  await expect(experience.getByRole('button', { name: 'Deneyim ekle' })).toBeVisible()
  await expect(page.getByText('Adsız kayıt')).toHaveCount(0)
  await page.getByLabel('Ad soyad').fill('Deniz Aksoy')
  await expect(intro).toHaveCount(0)
})

test('içe aktarma penceresi: kişisel bilgiler tek ritimde, seçili sayısı eylem satırında', async ({ page }) => {
  await openTemplate(page, 'Zarif')
  await continueToImport(page)
  await page.getByRole('button', { name: 'Örnekle göster' }).click()
  const rows = page.getByTestId('import-contacts').locator('.group-rows > *')
  const heights = await rows.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
  expect(heights.length).toBeGreaterThan(3)
  expect(new Set(heights)).toEqual(new Set([40]))
  const footer = page.getByRole('dialog').last().getByRole('button', { name: "CV'yi oluştur" }).locator('..')
  await expect(footer).toContainText(/\d+\/\d+ kayıt seçili/)
})

test('İnceleme: iş ilanı ve karşılaştırma geniş sütunda; anahtar kelimeler düz liste', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.goto('/inceleme')
  await page.getByLabel('İlan metni').fill('Frontend Geliştirici arıyoruz. React, TypeScript, Docker ve GraphQL deneyimi.')
  const missing = page.getByRole('list', { name: 'Eksik' })
  await expect(missing.getByText('Docker', { exact: true })).toBeVisible()
  // Terimler hap değil: zemin/kenar yok.
  const chip = await missing.locator('li').first().evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, shadow: s.boxShadow, display: s.display }
  })
  expect(chip.display).toBe('inline')
  expect(chip.bg).toBe('rgba(0, 0, 0, 0)')
  expect(chip.shadow).toBe('none')
  // İlan kutusu sonuçlarla aynı (geniş, sol) sütunda; yapay zekâ yorumu sağda.
  const ad = (await page.getByLabel('İlan metni').boundingBox())!
  const ai = (await page.getByTestId('review-ai').boundingBox())!
  expect(ad.width).toBeGreaterThan(ai.width)
  expect(ad.x).toBeLessThan(ai.x)
})
