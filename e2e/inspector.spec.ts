import { expect, test, type Page } from '@playwright/test'
import { createCv, openRow, openRowIn, patchCv, preview } from './helpers.ts'

/**
 * Sağ panel (denetçi): İçerik anahattı (tek açık kayıt, "Tümünü aç"), zengin metin, kaydın içinde
 * öneri farkı, Bölüm ekle menüsü, ⋯ ile taşıma, prompt çubuğunun boşta/odakta hâli, Görünüm satırları.
 */

const toggleOf = (page: Page, text: string) =>
  page.locator('[id^="item-"]', { hasText: text }).first().locator('[aria-expanded]').first()

test('anahat: kayıtlar kapalı satır, bir kayıt açılınca öbürü kapanır; "Tümünü aç" eski hep açık formu verir ve hatırlanır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  // Varsayılan: Kişisel bilgiler açık, kayıtlar kapalı (alanları çizilmez).
  await expect(page.getByLabel('Ad soyad')).toBeVisible()
  await expect(page.getByLabel('Pozisyon')).toHaveCount(0)
  const first = toggleOf(page, 'Lacivert Yazılım')
  await expect(first).toHaveAttribute('aria-expanded', 'false')
  // Kapalı satır kaydın adını, kurumunu ve tarihini gösterir.
  await expect(page.locator('[id^="item-"]', { hasText: 'Lacivert Yazılım' }).first()).toContainText('Frontend Geliştirici')

  await first.click()
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#personal-card [aria-expanded]')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Pozisyon')).toHaveValue('Frontend Geliştirici')

  const second = toggleOf(page, 'Martı Teknoloji')
  await second.click()
  await expect(second).toHaveAttribute('aria-expanded', 'true')
  await expect(first).toHaveAttribute('aria-expanded', 'false')

  // Escape açık kaydı kapatır, odak satırın düğmesine döner.
  await page.locator('[id^="item-"]', { hasText: 'Martı Teknoloji' }).first().getByLabel('Şirket').click()
  await page.keyboard.press('Escape')
  await expect(second).toHaveAttribute('aria-expanded', 'false')
  await expect(second).toBeFocused()

  // Tümünü aç: bütün deneyim kayıtları açık; yenileyince de.
  await page.getByRole('switch', { name: 'Tümünü aç' }).click()
  await expect(page.getByRole('region', { name: 'Deneyim', exact: true }).getByLabel('Pozisyon')).toHaveCount(3)
  await expect(page.getByLabel('Ad soyad')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Tümünü aç' })).toBeChecked()
  await expect(page.getByRole('region', { name: 'Deneyim', exact: true }).getByLabel('Pozisyon')).toHaveCount(3)
  // Tümünü açıkken tek kayıt yine kapatılabilir.
  await toggleOf(page, 'Lacivert Yazılım').click()
  await expect(page.getByRole('region', { name: 'Deneyim', exact: true }).getByLabel('Pozisyon')).toHaveCount(2)
  await page.getByRole('switch', { name: 'Tümünü aç' }).click()
  await expect(page.getByLabel('Pozisyon')).toHaveCount(0)
})

test('beceri ve dil satır içi formdur; bölüm ⋯ menüsünden aşağı taşınır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const skills = page.getByRole('region', { name: 'Beceriler', exact: true })
  const group = skills.getByLabel('Grup').first()
  await expect(group).toBeVisible()
  await group.fill('Diller ve çatılar')
  await expect(preview(page).getByText('Diller ve çatılar')).toBeVisible()

  const titles = async () => (await preview(page).locator('.section-title').allInnerTexts()).slice(0, 2)
  expect(await titles()).toEqual(['ÖZET', 'DENEYİM'])
  await page.getByRole('button', { name: 'Özet bölümü için işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Aşağı taşı' }).click()
  await expect.poll(titles).toEqual(['DENEYİM', 'ÖZET'])
})

test('Bölüm ekle: eklenebilenler önce; eklenen bölümün ilk kaydı açık ve odaklı gelir; var olan bölüme götürür', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.locator('[data-add-section]').click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /Deneyim/ })).toContainText('Eklendi')
  await menu.getByRole('menuitem', { name: 'Sertifikalar' }).click()
  const section = page.getByRole('region', { name: 'Sertifikalar', exact: true })
  await expect(section.getByLabel('Sertifika', { exact: true })).toBeFocused()
  await page.keyboard.type('Örnek Sertifika')
  await expect(preview(page).getByText('Örnek Sertifika')).toBeVisible()

  await page.locator('[data-add-section]').click()
  await page.getByRole('menu').getByRole('menuitem', { name: /Eğitim/ }).click()
  await expect(page.getByRole('region', { name: 'Eğitim', exact: true }).locator('[data-section-title]')).toBeFocused()
})

test('zengin metin: yazı, kalın, madde, bağlantı önizlemeye düşer; Ctrl+Z geri alır', async ({ page }) => {
  await createCv(page)
  await openRowIn(page, 'Deneyim')
  const editor = page.getByRole('textbox', { name: 'Açıklama' })
  await editor.click()
  await page.keyboard.type('Panel yeniden yazıldı')
  const frame = preview(page)
  await expect(frame.getByText('Panel yeniden yazıldı')).toBeVisible()
  // Yazma adımı kapanır (aynı alanda 1,2 sn içindeki değişiklikler tek adım).
  await page.waitForTimeout(1400)

  await page.keyboard.press('Control+a')
  await page.getByRole('button', { name: 'Kalın' }).click()
  await expect(page.getByRole('button', { name: 'Kalın' })).toHaveAttribute('aria-pressed', 'true')
  await expect(frame.locator('#cv-pages strong', { hasText: 'Panel yeniden yazıldı' })).toHaveCount(1)
  await page.waitForTimeout(1400)

  await page.getByRole('button', { name: 'Madde işaretli liste' }).click()
  await expect(frame.locator('#cv-pages li', { hasText: 'Panel yeniden yazıldı' })).toHaveCount(1)
  await page.waitForTimeout(1400)

  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Bağlantı' }).click()
  const url = page.getByLabel('Bağlantı adresi')
  await expect(url).toBeFocused()
  await url.fill('example.com')
  await page.keyboard.press('Enter')
  await expect(editor.locator('a[href="https://example.com"]')).toHaveCount(1)
  await expect(frame.locator('#cv-pages a', { hasText: 'example.com' })).toHaveCount(1)

  // Geri al: önce bağlantı, sonra madde gider; düzenleyici CV ile eşit kalır.
  await page.waitForTimeout(1400)
  await page.keyboard.press('Control+z')
  await expect(editor.locator('a')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(editor.locator('li')).toHaveCount(0)
  await expect(editor.locator('strong')).toHaveText('Panel yeniden yazıldı')
  await expect(frame.locator('#cv-pages li', { hasText: 'Panel yeniden yazıldı' })).toHaveCount(0)
})

test('öneri kaydın içinde okunur fark olarak görünür; "Kabul et" uygular ve düzenleyiciyi eşitler, Ctrl+Z geri alır', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     exp.items[0].description = '<ul><li>birinci madde</li><li>ikinci madde</li></ul>';`,
  )
  await page.reload()
  const row = await openRow(page, 'Lacivert Yazılım')
  const editor = row.getByRole('textbox', { name: 'Açıklama' })
  await expect(editor).toContainText('birinci madde')

  // Açık kayıtta "Yalnız bu kayıt" çipi kapsamı daraltır.
  const prompt = page.getByLabel('Yapay zekâdan iste')
  await prompt.click()
  await page.getByRole('button', { name: 'Yalnız bu kayıt' }).click()
  await expect(page.getByRole('button', { name: 'Yalnız bu kayıt' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Kapsam' })).toContainText('Deneyim: Frontend Geliştirici')

  await prompt.fill('Maddeleri düzelt')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toBeVisible({ timeout: 5000 })
  const box = row.locator('[data-field-suggestion]')
  await expect(box).toBeVisible()
  await expect(box.locator('ins').first()).toContainText('Birinci')
  await expect(box.locator('del').first()).toContainText('birinci')
  await expect(row.locator('[data-pending="field"]')).toHaveCount(1)

  await box.getByRole('button', { name: 'Kabul et' }).click()
  await expect(box).toHaveCount(0)
  await expect(editor).toContainText('Birinci madde')
  await expect(preview(page).getByText('Birinci madde')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(editor).toContainText('birinci madde')
})

test('prompt çubuğu boşta tek satır, odakta büyür; Görünüm satırları ve "Değiştir…"', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  const prompt = page.getByLabel('Yapay zekâdan iste')
  const bar = page.locator('aside').getByRole('button', { name: 'Kapsam' }).locator('xpath=ancestor::div[contains(@class,"material")][1]')
  const idle = (await bar.boundingBox())!.height
  expect(idle).toBeLessThanOrEqual(56)
  await expect(page.getByText('Enter gönderir')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ne gönderilir?' })).toBeVisible()
  await prompt.click()
  await expect(page.getByText('Enter gönderir')).toBeVisible()
  await expect(page.getByLabel('İletişim bilgilerimi de gönder')).toBeVisible()
  expect((await bar.boundingBox())!.height).toBeGreaterThan(idle)
  await page.keyboard.type('özeti kısalt')
  await page.keyboard.press('Control+z')
  // Ctrl+Z prompt kutusunda yalnız metni geri alır; CV değişmez.
  await expect(page.getByLabel('Unvan')).toHaveValue('Frontend Geliştirici')

  await page.getByRole('radio', { name: 'Görünüm' }).click()
  // Yazı tipi açılır menü: seçim önizlemeye yansır.
  await page.getByRole('combobox', { name: 'Yazı tipi' }).click()
  await page.getByRole('option', { name: /Literata/ }).click()
  await expect(page.getByRole('combobox', { name: 'Yazı tipi' })).toContainText('Literata')
  await expect
    .poll(() =>
      page.evaluate(async (cvId) => {
        const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ template: { font: string } } | undefined> } } }).__cveditorDb
        return (await db.cvs.get(cvId))?.template.font
      }, id),
    )
    .toBe('literata')
  // Boşluk segmenti
  await page.getByRole('radiogroup', { name: 'Boşluk' }).getByRole('radio', { name: 'Sıkı' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Boşluk' }).getByRole('radio', { name: 'Sıkı' })).toHaveAttribute('aria-checked', 'true')
  // Şablon satırı: "Değiştir…" tuvalin solundaki şablon rayını açar.
  const change = page.getByRole('button', { name: 'Değiştir…' })
  await change.click()
  await expect(change).toHaveAttribute('aria-expanded', 'true')
})
