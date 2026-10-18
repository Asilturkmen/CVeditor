import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { createCv, patchCv, preview } from './helpers.ts'

test('ilk ziyarette Şablonlar açılır, CV varsa CV\'lerim', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/sablonlar$/)
  await expect(page.getByRole('heading', { name: "CVeditör'e hoş geldin" })).toBeVisible()
  await createCv(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/cvler$/)
  await expect(page.getByRole('heading', { name: 'Genel TR' })).toBeVisible()
})

test('yazılan bilgi canlı önizlemeye düşer ve yenileyince kalır', async ({ page }) => {
  await createCv(page)
  await page.getByLabel('Ad soyad').fill('Ece Yıldız')
  await page.getByLabel('Unvan').fill('Veri Analisti')
  await page.getByLabel('Pozisyon').first().fill('Analist Stajyeri')
  await expect(preview(page).locator('.cv-name')).toHaveText('Ece Yıldız')
  await expect(preview(page).getByText('Analist Stajyeri')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Ad soyad')).toHaveValue('Ece Yıldız')
  await expect(preview(page).locator('.cv-name')).toHaveText('Ece Yıldız')
})

test('geri al ve yinele klavyeyle çalışır', async ({ page }) => {
  await createCv(page)
  const headline = page.getByLabel('Unvan')
  await headline.fill('Birinci')
  await page.getByLabel('E-posta').fill('a@b.com')
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('E-posta')).toHaveValue('')
  await expect(headline).toHaveValue('Birinci')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByLabel('E-posta')).toHaveValue('a@b.com')
})

test('İngilizce CV başlıkları ve tarihleri İngilizce yazar; html lang doğru', async ({ page }) => {
  await createCv(page, { language: 'İngilizce', start: 'sample' })
  const frame = preview(page)
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en')
  await expect(frame.getByText('Experience', { exact: true })).toBeVisible()
  await expect(frame.getByText(/Present/).first()).toBeVisible()
})

test('Türkçe CV büyük harfte İ kullanır (lang=tr)', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const frame = preview(page)
  await expect(frame.locator('html')).toHaveAttribute('lang', 'tr')
  const title = frame.locator('.section-title', { hasText: 'Deneyim' })
  const rendered = await title.evaluate((el) => (el as HTMLElement).innerText)
  expect(rendered).toBe('DENEYİM')
})

test('şablon değiştirmek içeriği korur ve iki sütuna geçer', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  await page.getByRole('radio', { name: /Panel/ }).click()
  const frame = preview(page)
  await expect(frame.locator('.col-side').first()).toBeVisible()
  await expect(frame.locator('.col-side').first()).toContainText('Beceriler')
  await expect(frame.getByText('Lacivert Yazılım').first()).toBeVisible()
})

test('bir sayfadan uzun kayıt uyarı verir, PDF onay ister, metin kaybolmaz', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     exp.items[1].description = '<ul>' + Array.from({ length: 70 }, (_, i) => '<li>Madde ' + (i + 1) + ' sonucu ölçülebilir biçimde anlatır.</li>').join('') + '</ul>';`,
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
  await expect(page.getByText(/^[23] sayfa$/)).toBeVisible()
  // Bütün maddeler bir yerde görünür (alttan kesilip kaybolmaz).
  const frame = preview(page)
  await expect(frame.locator('#cv-pages li', { hasText: /^Madde 70 / })).toHaveCount(1)
  await expect(frame.locator('#cv-pages li', { hasText: /^Madde 1 / })).toHaveCount(1)
  // PDF: onay kutusu işaretlenmeden devam edilemez.
  await page.getByRole('button', { name: /^PDF al$/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Bir sayfadan uzun kayıt var')
  await expect(dialog.getByRole('button', { name: 'PDF al' })).toBeDisabled()
  await dialog.getByRole('checkbox').check()
  await expect(dialog.getByRole('button', { name: 'PDF al' })).toBeEnabled()
})

test('kayıt hiçbir zaman iki sayfaya bölünmez (sığıyorsa)', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     const base = exp.items[0];
     for (let i = 0; i < 8; i++) exp.items.push({ ...base, id: 'kopya-' + i, translationGroupId: 'g-' + i });`,
  )
  await page.reload()
  const frame = preview(page)
  await expect(frame.locator('.page').nth(1)).toBeVisible()
  // Her kayıt tam olarak bir kez görünür ve hiçbiri "bölünmüş" değil.
  for (let i = 0; i < 8; i++) {
    await expect(frame.locator(`[data-item-id="kopya-${i}"]`)).toHaveCount(1)
  }
  await expect(frame.locator('.is-split')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('önizlemede kayda tıklayınca sağ panel o kayda gider', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await preview(page).getByText('Kampüs Etkinlik Takvimi').click()
  const card = page.locator('[id^="item-"]', { hasText: 'Kampüs Etkinlik Takvimi' }).first()
  await expect(card).toBeInViewport()
})

test('örnek öneri: işaretlenir, toplu kabul edilir, tek adımda geri alınır', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     exp.items[0].description = '<ul><li>birinci madde</li><li>ikinci madde</li></ul>';`,
  )
  await page.reload()
  await page.getByLabel('Yapay zekâdan iste').fill('Maddeleri düzelt')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toBeVisible({ timeout: 5000 })
  await expect(preview(page).locator('.sg').first()).toBeVisible()
  // Öneri beklerken PDF alınmaz.
  await page.getByRole('button', { name: /^PDF al$/ }).click()
  await expect(page.getByText('Önce bekleyen önerileri kabul et ya da reddet.')).toBeVisible()
  await page.getByRole('button', { name: 'Tümünü kabul et' }).click()
  await expect(preview(page).locator('.sg')).toHaveCount(0)
  await expect(preview(page).getByText('Birinci madde')).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(preview(page).getByText('birinci madde')).toBeVisible()
})

test('CV silme sayfa içi onay ister ve geri alınabilir', async ({ page }) => {
  await createCv(page, { name: 'Silinecek' })
  await page.goto('/cvler')
  await page.getByRole('button', { name: 'Silinecek için işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Sil' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sil' }).click()
  await expect(page.getByRole('heading', { name: 'Silinecek' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al' }).click()
  await expect(page.getByRole('heading', { name: 'Silinecek' })).toBeVisible()
})

test('yedek al ve başka tarayıcıya geri yükle', async ({ page, browser }) => {
  await createCv(page, { name: 'Yedeklenen', start: 'sample' })
  await page.goto('/ayarlar')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /1 CV'yi yedekle/ }).click()
  const download = await downloadPromise
  const file = await download.path()
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  expect(backup.app).toBe('cveditor')
  expect(backup.cvs).toHaveLength(1)

  // Temiz bir tarayıcı bağlamı = başka bilgisayar.
  const other = await browser.newContext()
  const page2 = await other.newPage()
  await page2.goto('/ayarlar')
  await page2.locator('input[type="file"][accept*="json"]').setInputFiles(file)
  await expect(page2.getByRole('dialog')).toContainText('Dosyada 1 CV bulundu')
  await page2.getByRole('button', { name: 'Geri yükle' }).click()
  await expect(page2.getByText('1 CV eklendi, 0 CV güncellendi')).toBeVisible()
  await page2.goto('/cvler')
  await expect(page2.getByRole('heading', { name: 'Yedeklenen' })).toBeVisible()
  await other.close()
})

test('kaydı başka CV\'ye ekler (aynı çeviri grubuyla)', async ({ page }) => {
  await createCv(page, { name: 'Hedef EN', language: 'İngilizce' })
  await createCv(page, { name: 'Kaynak TR', start: 'sample' })
  const card = page.locator('[id^="item-"]', { hasText: 'Rota' }).first()
  await card.getByRole('button', { name: /için işlemler/ }).click()
  await page.getByRole('menuitem', { name: "Başka CV'ye ekle…" }).click()
  await page.getByRole('dialog').getByRole('radio', { name: 'Olduğu gibi ekle' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Ekle' }).click()
  await expect(page.getByText('"Hedef EN" CV\'sine eklendi')).toBeVisible()
})

test('boş CV önizlemesinde ipucu görünür, içerik girilince kaybolur', async ({ page }) => {
  await createCv(page)
  const hint = preview(page).locator('.ph-hint')
  await expect(hint).toBeVisible()
  await page.getByLabel('Pozisyon').first().fill('Stajyer')
  await expect(hint).toHaveCount(0)
})

test('bölüm sırası sürüklenerek değişir, önizlemeye yansır, geri alınır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const titles = async () => (await preview(page).locator('.section-title').allInnerTexts()).slice(0, 2)
  expect(await titles()).toEqual(['ÖZET', 'DENEYİM'])
  const handles = page.getByRole('button', { name: 'Bölümü sürükleyerek sırala' })
  await handles.first().scrollIntoViewIfNeeded()
  const from = (await handles.first().boundingBox())!
  const to = (await handles.nth(1).boundingBox())!
  const live = (text: string) => page.locator('[id^="DndLiveRegion"]').filter({ hasText: text })
  const x = from.x + from.width / 2
  const y = from.y + from.height / 2
  // Ara adımlı hareket: aralıksız tek sıçrama dnd-kit'te kaydolmayabilir. Önce eşik (4px)
  // aşılır ve sürüklemenin başladığı duyuruyla doğrulanır, sonra hedefe yürünür.
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 12, { steps: 4 })
  await expect(live('Tuttun: Özet')).toHaveCount(1)
  await page.mouse.move(x, y + (to.y - from.y) + 60, { steps: 20 })
  await expect(live('Özet: sıra 2 /')).toHaveCount(1)
  await page.mouse.up()
  await expect(live('Bıraktın: Özet')).toHaveCount(1)
  await expect.poll(titles).toEqual(['DENEYİM', 'ÖZET'])
  await page.keyboard.press('Control+z')
  await expect.poll(titles).toEqual(['ÖZET', 'DENEYİM'])
})

test('yeni kayıt eklenince ilk alana imleç gelir', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.getByRole('button', { name: 'Proje ekle' }).click()
  await expect(page.getByLabel('Proje adı').last()).toBeFocused()
  await page.keyboard.type('Yeni Proje')
  await expect(preview(page).getByText('Yeni Proje')).toBeVisible()
})

test('CV adındaki HTML küçük resimde çalışmaz (XSS)', async ({ page }) => {
  const evil = '</title><img src=x onerror="window.top.__xss=1">'
  await createCv(page, { name: evil })
  await page.goto('/cvler')
  await expect(page.getByRole('heading', { name: evil })).toBeVisible()
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

test('küçük resim gerçek sayfalamayı kullanır (uyarı çerçevesi yok)', async ({ page }) => {
  const id = await createCv(page, { name: 'Uzun', start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     const base = exp.items[0];
     for (let i = 0; i < 6; i++) exp.items.push({ ...base, id: 'k-' + i, translationGroupId: 'g-' + i });`,
  )
  await page.goto('/cvler')
  const thumb = page.frameLocator('iframe[title="Uzun"]')
  await expect(thumb.locator('.page').first()).toBeVisible()
  await expect(thumb.locator('.overflow-warning')).toHaveCount(0)
})

test('PDF al, korumalı önizlemede yazdırmayı başlatır', async ({ page }) => {
  const messages: string[] = []
  page.on('console', (msg) => messages.push(msg.text()))
  await createCv(page, { start: 'sample' })
  await page.getByRole('button', { name: /^PDF al$/ }).click()
  await page.waitForTimeout(800)
  expect(messages.filter((t) => /Ignored call to 'print\(\)'/.test(t))).toEqual([])
})

test('telefonda editör yerine önizleme ve not görünür', async ({ page }) => {
  await createCv(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Düzenlemek için CV\'yi bilgisayardan aç.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Ad soyad')).toHaveCount(0)
})
