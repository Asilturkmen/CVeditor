import { expect, test, type Page } from '@playwright/test'
import { trCvPdf, enCvPdf } from './fixtures/pdfs.ts'
import { createCv } from './helpers.ts'

/**
 * Yapay zekâ arayüzü, örnek sağlayıcıyla: CV İnceleme yorumu, ilanla anlamına
 * göre karşılaştırma, parola penceresi ve hata iletileri. Parola ve hata,
 * örnek sağlayıcının deneme bayrağıyla (localStorage `cveditor:mockAi`) üretilir.
 */

async function seedCv(page: Page) {
  await page.goto('/cvler')
  await page.waitForFunction(() => '__cveditorDb' in window)
  return page.evaluate(async () => {
    const factory = await import('/src/cv/factory.ts' as string)
    const sample = await import('/src/cv/sample.ts' as string)
    const templates = await import('/src/render/templates.ts' as string)
    const sections = sample.sampleSections('tr')
    const cv = factory.createCv({
      name: 'Yorumlanacak CV',
      language: 'tr',
      templateId: 'klasik',
      template: templates.templateSettingsFor('klasik', sections),
      personal: sample.samplePersonal('tr'),
      sections,
    })
    const db = (window as unknown as { __cveditorDb: { cvs: { put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
    await db.cvs.put(cv)
    return cv.id as string
  })
}

const mockFlags = (page: Page, flags: Record<string, string>) =>
  page.addInitScript((value) => localStorage.setItem('cveditor:mockAi', value), JSON.stringify(flags))

const aiCard = (page: Page) => page.getByTestId('review-ai')

test('yapay zekâ yorumu düğmeyle istenir; Örnek rozeti, Düzenle ve "Ne gönderilir?"', async ({ page }) => {
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  const card = aiCard(page)
  await expect(card.getByRole('heading', { name: 'Yapay zekâ yorumu' })).toBeVisible()
  await expect(card.getByText('Şimdilik örnek yorum gösterilir')).toBeVisible()
  // İstek yalnız düğmeyle gider: önce yorum yok.
  await expect(card.getByRole('list', { name: 'Yapay zekâ yorumları' })).toHaveCount(0)

  // "Ne gönderilir?": ad ve iletişim bilgileri yok.
  await card.getByRole('button', { name: 'Ne gönderilir?' }).click()
  const payload = page.getByRole('dialog').getByTestId('ai-payload')
  await expect(payload).toContainText('Frontend Geliştirici')
  await expect(payload).not.toContainText('Deniz Aksoy')
  await expect(payload).not.toContainText('deniz.aksoy@example.com')
  await page.keyboard.press('Escape')

  await card.getByRole('button', { name: 'Yorum iste' }).click()
  await expect(card.getByText('Yorum hazırlanıyor')).toBeVisible()
  const list = card.getByRole('list', { name: 'Yapay zekâ yorumları' })
  await expect(list).toBeVisible({ timeout: 5000 })
  await expect(card.getByText('Örnek', { exact: true })).toBeVisible()
  await expect(list.locator('[data-ai-comment="improve"]').first()).toBeVisible()
  await expect(list).not.toContainText('%')
  await expect(card.getByRole('button', { name: 'Yeniden iste' })).toBeVisible()

  // Hedefli yorumun Düzenle bağlantısı editörü açar.
  await list.getByRole('button', { name: /Düzenle/ }).first().click()
  await page.waitForURL(/\/editor\//)
})

test('kaynak değişince yapay zekâ sonuçları ekranda kalmaz: başka CV, aynı adla yeni PDF', async ({ page, browser }) => {
  const first = await seedCv(page)
  const second = await seedCv(page)
  await page.goto(`/inceleme?cv=${first}`)
  const card = aiCard(page)
  const list = card.getByRole('list', { name: 'Yapay zekâ yorumları' })
  await card.getByRole('button', { name: 'Yorum iste' }).click()
  await expect(list).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /İş ilanı/ }).click()
  await page.getByLabel('İlan metni').fill('PostgreSQL ve Go bilen, JS ile React uygulamaları geliştiren bir yazılımcı arıyoruz.')
  const kw = page.getByTestId('keyword-ai')
  await kw.getByRole('button', { name: 'Anlamına göre karşılaştır' }).click()
  await expect(kw.getByRole('list', { name: 'Başka adla var' })).toBeVisible({ timeout: 5000 })

  // Başka CV: önceki CV'nin yorumları ve karşılaştırması (ve Düzenle hedefleri) gider.
  await page.getByRole('combobox', { name: 'CV' }).selectOption(second)
  await page.waitForURL(new RegExp(`cv=${second}`))
  await expect(card.getByRole('button', { name: 'Yorum iste' })).toBeVisible()
  await expect(list).toHaveCount(0)
  await expect(card.getByRole('button', { name: /Düzenle/ })).toHaveCount(0)
  await expect(kw.getByRole('button', { name: 'Anlamına göre karşılaştır' })).toBeVisible()
  await expect(kw.getByRole('list', { name: 'Başka adla var' })).toHaveCount(0)

  // PDF: aynı adla başka dosya yüklenince önceki dosyanın yorumları kalmaz.
  await page.getByRole('radio', { name: 'PDF yükle' }).click()
  const fileInput = page.locator('input[type=file]')
  await fileInput.setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: await trCvPdf(browser) })
  await expect(card.getByRole('button', { name: 'Yorum iste' })).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Yorum iste' }).click()
  await expect(list).toBeVisible({ timeout: 5000 })
  await fileInput.setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: await enCvPdf(browser) })
  await expect(card.getByRole('button', { name: 'Yorum iste' })).toBeVisible({ timeout: 20_000 })
  await expect(list).toHaveCount(0)
})

test('"Ne gönderilir?" ilanın son hâlini gösterir (gönderilecek olanla aynı)', async ({ page }) => {
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  await page.getByRole('button', { name: /İş ilanı/ }).click()
  const ad = page.getByLabel('İlan metni')
  await ad.fill('Kubernetes bilen bir yazılımcı arıyoruz.')
  await ad.pressSequentially(' Rust da bilmeli.', { delay: 0 })
  await aiCard(page).getByRole('button', { name: 'Ne gönderilir?' }).click()
  const payload = page.getByRole('dialog').getByTestId('ai-payload')
  await expect(payload).toContainText('Rust da bilmeli.')
  // Pencere açıkken girdiler değişirse (CV başka sekmede düzenlendi) gösterilen de güncellenir.
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ personal: { headline: string } }>; put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
    const cv = await db.cvs.get(id)
    cv.personal.headline = 'Platform Mühendisi'
    await db.cvs.put(cv)
  }, cvId)
  await expect(payload).toContainText('Platform Mühendisi')
})

test('yorum isteği Durdur ile iptal edilir', async ({ page }) => {
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  const card = aiCard(page)
  await card.getByRole('button', { name: 'Yorum iste' }).click()
  await card.getByRole('button', { name: 'Durdur' }).click()
  await expect(card.getByRole('button', { name: 'Yorum iste' })).toBeVisible()
  await page.waitForTimeout(1200)
  await expect(card.getByRole('list', { name: 'Yapay zekâ yorumları' })).toHaveCount(0)
})

test('ilanla anlamına göre karşılaştırma eş anlamlıları ayrıca gösterir', async ({ page }) => {
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  await page.getByRole('button', { name: /İş ilanı/ }).click()
  await page.getByLabel('İlan metni').fill('PostgreSQL ve Go bilen, JS ile React uygulamaları geliştiren bir yazılımcı arıyoruz. PostgreSQL deneyimi şart.')
  const kw = page.getByTestId('keyword-ai')
  await expect(kw.getByRole('heading', { name: 'Anlamına göre karşılaştırma' })).toBeVisible()
  await kw.getByRole('button', { name: 'Anlamına göre karşılaştır' }).click()
  const related = kw.getByRole('list', { name: 'Başka adla var' })
  await expect(related).toBeVisible({ timeout: 5000 })
  await expect(related.getByLabel('İlanda “PostgreSQL”, CV\'nde “SQL”')).toBeVisible()
  await expect(kw.getByText('Örnek', { exact: true })).toBeVisible()
  await expect(kw.getByRole('list', { name: 'Eksik' })).toContainText('Go')

  // İlan değişince sonuç bayatlar.
  await page.getByLabel('İlan metni').fill('Go ve Rust bilen bir yazılımcı arıyoruz.')
  await expect(kw.getByText('İlan değişti; güncel karşılaştırma için yeniden çalıştır.')).toBeVisible()
})

test('parola istenirse sayfa içi pencere açılır; doğru parolayla istek sürer', async ({ page }) => {
  await mockFlags(page, { password: 'deneme' })
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  const card = aiCard(page)
  await card.getByRole('button', { name: 'Yorum iste' }).click()

  const dialog = page.getByRole('dialog', { name: 'Parola gerekli' })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  const input = dialog.getByLabel('Parola')
  await expect(input).toBeFocused()
  await input.fill('yanlis')
  await dialog.getByRole('button', { name: 'Devam et' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Parola yanlış. Yeniden dene.')

  await input.fill('deneme')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(card.getByRole('list', { name: 'Yapay zekâ yorumları' })).toBeVisible({ timeout: 5000 })
})

test('parola penceresinden vazgeçilirse istek gönderilmez ve nedeni yazılır', async ({ page }) => {
  await mockFlags(page, { password: 'deneme' })
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  const card = aiCard(page)
  await card.getByRole('button', { name: 'Yorum iste' }).click()
  const dialog = page.getByRole('dialog', { name: 'Parola gerekli' })
  await dialog.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(dialog).toBeHidden()
  await expect(card.getByRole('alert')).toHaveText('Parola girilmediği için istek gönderilmedi. Yeniden denersen parola sorulur.')
})

test('inceleme yorumu hız sınırı hatasını kendi iletisiyle gösterir', async ({ page }) => {
  await mockFlags(page, { fail: 'rate_limited' })
  const cvId = await seedCv(page)
  await page.goto(`/inceleme?cv=${cvId}`)
  const card = aiCard(page)
  await card.getByRole('button', { name: 'Yorum iste' }).click()
  await expect(card.getByRole('alert')).toHaveText('Kısa sürede çok istek gönderildi. Biraz bekleyip yeniden dene.', { timeout: 5000 })
})

test('prompt kutusu ağ hatasını kendi iletisiyle gösterir', async ({ page }) => {
  await mockFlags(page, { fail: 'network' })
  await createCv(page, { start: 'sample' })
  await page.getByLabel('Yapay zekâdan iste').fill('Özeti kısalt')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Bağlantı kurulamadı. İnternetini kontrol edip yeniden dene.')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Tümünü kabul et' })).toHaveCount(0)
})
