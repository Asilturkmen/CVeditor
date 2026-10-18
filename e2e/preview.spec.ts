import { expect, test, type Page } from '@playwright/test'
import { createCv, patchCv, preview } from './helpers.ts'
import { flowText, pdfText, renderPreviewPdf, settledPageCount } from './pdf.ts'

/**
 * Canlı önizleme her ekranda 1. sayfayı bütünüyle gösterir (Sığdır = min(enine, boyuna)),
 * kısayollar önizlemede de çalışır, tarayıcı menüsünden yazdırma yalnız CV'yi basar.
 */

/** 1. sayfanın kaydırma alanına göre boşlukları (px). Negatif = taşıyor. */
async function pageOneMargins(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-preview-scroll]')!
    const iframe = scroller.querySelector('iframe')!
    const s = scroller.getBoundingClientRect()
    const f = iframe.getBoundingClientRect()
    const scale = f.width / iframe.offsetWidth
    const sheet = iframe.contentDocument!.querySelector<HTMLElement>('#cv-pages > .page')!
    const top = f.top + sheet.offsetTop * scale
    const bottom = top + sheet.offsetHeight * scale
    // Kaydırma çubuğu yeri iki yanda ayrılır: iç alan clientLeft'ten başlar, clientWidth kadar.
    const gutter = (scroller.offsetWidth - scroller.clientWidth) / 2
    const innerLeft = s.left + gutter
    return {
      top: top - s.top,
      bottom: s.top + scroller.clientHeight - bottom,
      left: f.left - innerLeft,
      right: innerLeft + scroller.clientWidth - f.right,
      scrollTop: scroller.scrollTop,
    }
  })
}

async function expectPageOneFits(page: Page) {
  await expect
    .poll(async () => {
      const m = await pageOneMargins(page)
      return m.top >= 20 && m.bottom >= 20 && m.left >= 20 && m.right >= 20 && m.scrollTop === 0
    })
    .toBe(true)
}

const zoomLabel = (page: Page) => page.getByRole('group', { name: 'Yakınlaştırma' }).getByRole('button', { name: /%$/ })

for (const size of [
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
]) {
  test(`${size.width}x${size.height}: 1. sayfa kaydırmadan, üstte ve altta boşlukla görünür`, async ({ page }) => {
    await page.setViewportSize(size)
    await createCv(page, { start: 'sample' })
    expect(await settledPageCount(page)).toBeGreaterThan(1)
    await expectPageOneFits(page)
    const m = await pageOneMargins(page)
    // Üst ve alt boşluk dengeli (yalnız yuvarlama farkı).
    expect(Math.abs(m.top - m.bottom)).toBeLessThan(4)
  })
}

test('bölücü sürüklenince ve pencere değişince yeniden sığar; elle yakınlaştırma korunur', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await createCv(page, { start: 'sample' })
  await expectPageOneFits(page)

  // Paneli genişlet (önizleme daralır).
  const splitter = page.getByRole('separator', { name: 'Panel genişliği' })
  const box = (await splitter.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x - 300, box.y + 200, { steps: 12 })
  await page.mouse.up()
  await expectPageOneFits(page)

  await page.setViewportSize({ width: 1366, height: 600 })
  await expectPageOneFits(page)

  // Elle yakınlaştırınca boyut değişimi ölçeği ezmez; Sığdır geri getirir.
  await page.getByRole('button', { name: 'Yakınlaştır' }).click()
  const manual = await zoomLabel(page).innerText()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(zoomLabel(page)).toHaveText(manual)
  await page.getByRole('button', { name: 'Sığdır' }).click()
  await expect(page.getByRole('button', { name: 'Sığdır' })).toHaveAttribute('aria-pressed', 'true')
  await expectPageOneFits(page)
})

test('odak önizlemedeyken Ctrl+Z ve Ctrl+P editöre gider', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  await page.getByLabel('Unvan').fill('Geçici unvan')
  await expect(preview(page).getByText('Geçici unvan')).toBeVisible()
  await page.locator('iframe[title="CV önizleme"]').focus()
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('Unvan')).toHaveValue('Frontend Geliştirici')
  // Geri alma kaydedilene kadar bekle: yoksa gecikmeli otomatik kayıt (store.ts, 450 ms) aşağıdaki
  // yamayı ezer. Veritabanı geri alınmış değeri gösterse de (CV'nin ilk hâli) zamanlayıcı henüz
  // çalışmamış olabilir; bu yüzden ayrıca gecikmenin üstünde kısa bir bekleme.
  await expect
    .poll(() =>
      page.evaluate(async (cvId) => {
        const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ personal: { headline: string } } | undefined> } } }).__cveditorDb
        return (await db.cvs.get(cvId))?.personal.headline
      }, id),
    )
    .toBe('Frontend Geliştirici')
  await page.waitForTimeout(800)

  // Ctrl+P aynı yoldan geçer: uzun kayıt varsa önce onay penceresi.
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     exp.items[1].description = '<ul>' + Array.from({ length: 70 }, (_, i) => '<li>Madde ' + (i + 1) + ' sonucu ölçülebilir biçimde anlatır.</li>').join('') + '</ul>';`,
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
  await page.locator('iframe[title="CV önizleme"]').focus()
  await page.keyboard.press('Control+p')
  await expect(page.getByRole('dialog')).toContainText('Bir sayfadan uzun kayıt var')
})

test('tarayıcı menüsünden yazdırma yalnız CV sayfalarını basar', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const count = await settledPageCount(page)
  // page.pdf() tarayıcının kendi baskısı gibi beforeprint/afterprint olaylarını tetikler.
  const pages = await pdfText(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
  expect(pages).toHaveLength(count)
  for (const p of pages) {
    expect(Math.round(p.width)).toBe(595)
    expect(Math.round(p.height)).toBe(842)
  }
  const text = flowText(pages)
  expect(text).toContain('Deniz Aksoy')
  expect(text).not.toContain('Kişisel bilgiler')
  expect(text).not.toContain('Sığdır')
  await expect(page.locator('#cv-print-mirror')).toHaveCount(0)
})

test('menüden yazdırmada büyük harfli başlıklar arayüz dilinden değil CV dilinden: Türkçe arayüz, İngilizce CV', async ({ page }) => {
  await createCv(page, { start: 'sample', language: 'İngilizce' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await settledPageCount(page)
  const text = flowText(await pdfText(await page.pdf({ preferCSSPageSize: true, printBackground: true })))
  expect(text).toContain('EXPERIENCE')
  expect(text).toContain('SKILLS')
  expect(text).not.toMatch(/EXPERİENCE|SKİLLS/)
  // Baskıdan sonra arayüzün dili ve başlığı geri gelir.
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('#cv-print-mirror')).toHaveCount(0)
})

test('menüden yazdırmada büyük harfli başlıklar CV dilinden: İngilizce arayüz, Türkçe CV', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  await page.evaluate(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'))
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.frameLocator('iframe[title="CV preview"]').locator('.page').first()).toBeVisible({ timeout: 15_000 })
  // Ayna son çizimden kısa süre sonra hazırlanır; hazır değilse baskı anında kurulur.
  await page.waitForTimeout(500)
  const text = flowText(await pdfText(await page.pdf({ preferCSSPageSize: true, printBackground: true })))
  expect(text).toContain('DENEYİM')
  expect(text).toContain('EĞİTİM')
  expect(text).not.toMatch(/DENEYIM|EĞITIM/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('menüden yazdırmada fotoğraf basılır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  // 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png })
  await expect(preview(page).locator('#cv-pages img')).toHaveCount(1)
  await settledPageCount(page)
  // Ayna baskıdan önce hazırlanır; baskı anında kopyadaki görsel yüklenmiş olmalı.
  const loaded = await page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      window.addEventListener(
        'beforeprint',
        () => {
          const img = document.getElementById('cv-print-mirror')?.shadowRoot?.querySelector('img')
          resolve(!!img && img.complete && img.naturalWidth > 0)
        },
        { once: true },
      )
      window.dispatchEvent(new Event('beforeprint'))
      window.dispatchEvent(new Event('afterprint'))
    })
  })
  expect(loaded).toBe(true)
  await expect(page.locator('#cv-print-mirror')).toHaveCount(0)
})

test('afterprint gelmezse ayna ve sayfa başlığı ilk etkileşimde temizlenir', async ({ page }) => {
  await createCv(page, { start: 'sample', name: 'Baskı denemesi' })
  await settledPageCount(page)
  const title = await page.title()
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await expect(page.locator('#cv-print-mirror')).toHaveCount(1)
  expect(await page.title()).not.toBe(title)
  await page.keyboard.press('Shift')
  await expect(page.locator('#cv-print-mirror')).toHaveCount(0)
  expect(await page.title()).toBe(title)
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
})

test('uzun kayıt varken menüden yazdırma CV basmaz, onay penceresini açar', async ({ page }) => {
  const id = await createCv(page, { start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     exp.items[1].description = '<ul>' + Array.from({ length: 70 }, (_, i) => '<li>Madde ' + (i + 1) + ' sonucu ölçülebilir biçimde anlatır.</li>').join('') + '</ul>';`,
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
  const pages = await pdfText(await page.pdf({ preferCSSPageSize: true }))
  const text = flowText(pages)
  expect(text).toContain('onaylaman gerekiyor')
  expect(text).not.toContain('Deniz Aksoy')
  await expect(page.getByRole('dialog')).toContainText('Bir sayfadan uzun kayıt var')
})

test('Görünüm sekmesinde bölüm sırası klavyeyle değişir, İçerik ile aynı, tek adımda geri alınır', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const titles = async () => (await preview(page).locator('.section-title').allInnerTexts()).slice(0, 3)
  expect(await titles()).toEqual(['ÖZET', 'DENEYİM', 'EĞİTİM'])
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  const handle = page.getByRole('button', { name: 'Özet bölümünü sürükleyerek sırala' })
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[id^="DndLiveRegion"]').filter({ hasText: 'Tuttun: Özet' })).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[id^="DndLiveRegion"]').filter({ hasText: 'Özet: sıra 2 /' })).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect.poll(titles).toEqual(['DENEYİM', 'ÖZET', 'EĞİTİM'])

  await page.getByRole('radio', { name: 'İçerik' }).click()
  const order = await page.locator('[data-section-list] > section').evaluateAll((els) => els.slice(0, 2).map((el) => el.getAttribute('aria-label')))
  expect(order).toEqual(['Deneyim', 'Özet'])
  await page.keyboard.press('Control+z')
  await expect.poll(titles).toEqual(['ÖZET', 'DENEYİM', 'EĞİTİM'])
})

test('fotoğraf yükleme tek geri alma adımıdır (fotoğraf + gösterim)', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  // Yeni CV'de fotoğraf açık: önce kapat ki yükleme onu da açsın.
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  const photoSwitch = page.getByRole('switch', { name: "Fotoğrafı CV'de göster" })
  await expect(photoSwitch).toBeChecked()
  await photoSwitch.click()
  await expect(preview(page).locator('#cv-pages .ph-photo')).toHaveCount(0)
  await page.getByRole('radio', { name: 'İçerik' }).click()
  // 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByAltText('Yüklenen fotoğraf')).toBeVisible()
  await expect(preview(page).locator('#cv-pages img')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(preview(page).locator('#cv-pages img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Yükle' })).toBeVisible()
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  await expect(photoSwitch).not.toBeChecked()
})

test('fotoğraf yokken önizlemede "Fotoğraf ekle" kutusu; baskıda yer kaplamaz, metne girmez', async ({ page }) => {
  await createCv(page, { template: 'Bant', start: 'sample' })
  const frame = preview(page)
  const box = frame.locator('#cv-pages .cv-header.photo-ph > .ph-photo')
  await expect(box).toHaveText('Fotoğraf ekle')
  // Baskıda kutu gerçekten display:none (şablonun ekrandaki daha güçlü kuralı onu ezmemeli):
  // PDF fotoğrafsız basılır, kutunun yazısı PDF metninde yok.
  await page.emulateMedia({ media: 'print' })
  expect(await box.evaluate((el) => getComputedStyle(el).display), 'baskıda .ph-photo yer kaplamaz').toBe('none')
  await page.emulateMedia({ media: 'screen' })
  const pages = await pdfText(await renderPreviewPdf(page))
  expect(flowText(pages)).toContain('Deniz Aksoy')
  expect(flowText(pages)).not.toContain('Fotoğraf ekle')
  // Fotoğraf yüklenince kutu yerini gerçek fotoğrafa bırakır.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png })
  await expect(frame.locator('#cv-pages img.cv-photo')).toHaveCount(1)
  await expect(frame.locator('#cv-pages .ph-photo')).toHaveCount(0)
})
