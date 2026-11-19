import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { createCv, patchCv, preview } from './helpers.ts'

/**
 * Veri çekirdeği: iki sekme, kayıt hatası, çıkış koruması, kısayollar, odak. CV yalnız tarayıcıda
 * durur; buradaki her test "değişiklik sessizce kaybolmaz" sözünün bir yolunu denetler.
 * İki sekme = aynı tarayıcı bağlamında iki sayfa (aynı IndexedDB; Dexie sekmeler arası bildirir).
 */

type TestDb = {
  cvs: {
    get: (id: string) => Promise<Record<string, unknown> & { personal: Record<string, unknown> }>
    put: (cv: unknown) => Promise<unknown>
    delete: (id: string) => Promise<void>
    __put?: (cv: unknown) => Promise<unknown>
  }
}

/** Bu sekmede veritabanına yazmayı bozar (depolama dolu gibi) ya da düzeltir. */
async function setSavesBroken(page: Page, broken: boolean) {
  await page.waitForFunction(() => '__cveditorDb' in window)
  await page.evaluate((broken) => {
    const db = (window as unknown as { __cveditorDb: TestDb }).__cveditorDb
    if (broken) {
      db.cvs.__put ??= db.cvs.put
      db.cvs.put = () => Promise.reject(new DOMException('Depolama dolu', 'QuotaExceededError'))
    } else if (db.cvs.__put) {
      db.cvs.put = db.cvs.__put
      delete db.cvs.__put
    }
  }, broken)
}

async function storedPersonal(page: Page, cvId: string) {
  return page.evaluate(async (id) => {
    const db = (window as unknown as { __cveditorDb: TestDb }).__cveditorDb
    return (await db.cvs.get(id))?.personal
  }, cvId)
}

const saveStatus = (page: Page) => page.locator('[data-save-state]')

async function openSecondTab(page: Page, cvId: string) {
  const other = await page.context().newPage()
  await other.goto(`/editor/${cvId}`)
  await expect(preview(other).locator('.page').first()).toBeVisible()
  return other
}

test('iki sekme: bekleyen değişiklik yokken diğer sekmenin değişikliği kendiliğinden yüklenir', async ({ page }) => {
  const cvId = await createCv(page)
  await page.getByLabel('Unvan').fill('Birinci')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')

  const other = await openSecondTab(page, cvId)
  await expect(other.getByLabel('Unvan')).toHaveValue('Birinci')
  await other.getByLabel('Unvan').fill('İkinci sekmeden')
  await expect(saveStatus(other)).toHaveAttribute('data-save-state', 'saved')

  await expect(page.getByLabel('Unvan')).toHaveValue('İkinci sekmeden')
  await expect(page.getByText('Başka sekmedeki değişiklikler yüklendi')).toBeVisible()
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')
  await expect(page.locator('[data-save-conflict]')).toHaveCount(0)
})

test('iki sekme: kaydedilemeyen değişiklik diğerinin yazdığını ezmez; "Benimkini kaydet" açık seçimle yazar', async ({ page }) => {
  const cvId = await createCv(page)
  const other = await openSecondTab(page, cvId)

  await setSavesBroken(page, true)
  await page.getByLabel('Ad soyad').fill('Deniz Aksoy')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'error')
  await expect(saveStatus(page)).toHaveText('Kaydedilemedi')
  await expect(page.locator('[data-save-retry]')).toBeVisible()

  await other.getByLabel('Unvan').fill('Diğer sekmenin unvanı')
  await expect(saveStatus(other)).toHaveAttribute('data-save-state', 'saved')

  // Bu sekme çakışmayı görür; diğerinin yazdığı veritabanında durur.
  const banner = page.locator('[data-save-conflict="changed"]')
  await expect(banner).toContainText('Bu CV başka bir sekmede değişti')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'conflict')
  await setSavesBroken(page, false)
  expect(await storedPersonal(page, cvId)).toMatchObject({ fullName: '', headline: 'Diğer sekmenin unvanı' })
  await expect(page.getByLabel('Ad soyad')).toHaveValue('Deniz Aksoy')

  await banner.getByRole('button', { name: 'Benimkini kaydet (üzerine yaz)' }).click()
  await expect(banner).toHaveCount(0)
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')
  expect(await storedPersonal(page, cvId)).toMatchObject({ fullName: 'Deniz Aksoy', headline: '' })
  // Diğer sekmede bekleyen değişiklik yok: seçilen sürüm orada da kendiliğinden yüklenir.
  await expect(other.getByLabel('Ad soyad')).toHaveValue('Deniz Aksoy')
})

test('iki sekme: "Diğer sürümü yükle" veritabanındakini alır', async ({ page }) => {
  const cvId = await createCv(page)
  const other = await openSecondTab(page, cvId)
  await setSavesBroken(page, true)
  await page.getByLabel('Ad soyad').fill('Bu sekmede kalacak')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'error')
  await other.getByLabel('Unvan').fill('Kalan sürüm')
  await expect(saveStatus(other)).toHaveAttribute('data-save-state', 'saved')
  await setSavesBroken(page, false)

  const banner = page.locator('[data-save-conflict="changed"]')
  await banner.getByRole('button', { name: 'Diğer sürümü yükle' }).click()
  await expect(banner).toHaveCount(0)
  await expect(page.getByLabel('Unvan')).toHaveValue('Kalan sürüm')
  await expect(page.getByLabel('Ad soyad')).toHaveValue('')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')
  expect(await storedPersonal(page, cvId)).toMatchObject({ fullName: '', headline: 'Kalan sürüm' })
})

test('iki sekme: başka sekmede silinen CV "Yeniden kaydet" ile geri gelir', async ({ page }) => {
  const cvId = await createCv(page, { name: 'Silinip dönen' })
  await page.getByLabel('Unvan').fill('Korunacak')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')

  const list = await page.context().newPage()
  await list.goto('/cvler')
  await list.getByRole('button', { name: 'Silinip dönen için işlemler' }).click()
  await list.getByRole('menuitem', { name: 'Sil' }).click()
  await list.getByRole('dialog').getByRole('button', { name: 'Sil' }).click()
  await expect(list.getByRole('heading', { name: 'Silinip dönen' })).toHaveCount(0)

  const banner = page.locator('[data-save-conflict="deleted"]')
  await expect(banner).toContainText('Bu CV başka sekmede silindi')
  await expect(banner.getByRole('button', { name: "CV'lerime dön" })).toBeVisible()
  await banner.getByRole('button', { name: 'Yeniden kaydet' }).click()
  await expect(banner).toHaveCount(0)
  await expect(list.getByRole('heading', { name: 'Silinip dönen' })).toBeVisible()
  expect(await storedPersonal(page, cvId)).toMatchObject({ headline: 'Korunacak' })
})

test('kayıt hatası: Ctrl+S dürüst, çıkış onay ister, yedek iner, yeniden deneyince çıkar', async ({ page }) => {
  const cvId = await createCv(page)
  await setSavesBroken(page, true)
  await page.getByLabel('Unvan').fill('Kaybolmasın')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'error')

  // Ctrl+S "Kaydedildi" demez.
  await page.keyboard.press('Control+s')
  await expect(page.getByText('Kaydedilemedi. Değişikliklerin bu sekmede duruyor')).toBeVisible()

  // Çıkış durur, sayfa içi onay açılır.
  await page.getByRole('link', { name: "CV'lerime dön" }).click()
  const dialog = page.getByRole('dialog', { name: 'Değişikliklerin kaydedilemedi' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/editor/${cvId}$`))

  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Yedeğini indir' }).click()
  const backup = JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8'))
  expect(backup.cvs[0].personal.headline).toBe('Kaybolmasın')

  await setSavesBroken(page, false)
  await dialog.getByRole('button', { name: 'Yeniden dene' }).click()
  await expect(page).toHaveURL(/\/cvler$/)
  expect(await storedPersonal(page, cvId)).toMatchObject({ headline: 'Kaybolmasın' })

  // Yazılabildiğinde Ctrl+S "Kaydedildi" der.
  await page.goto(`/editor/${cvId}`)
  await page.getByLabel('Unvan').fill('Sonraki')
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('status').filter({ hasText: /^Kaydedildi$/ }).first()).toBeVisible()
  expect(await storedPersonal(page, cvId)).toMatchObject({ headline: 'Sonraki' })
})

test('kayıt hatası: "Yine de çık" bilerek bırakır; üst çubuktaki "Yeniden dene" yazar', async ({ page }) => {
  const cvId = await createCv(page)
  await setSavesBroken(page, true)
  await page.getByLabel('Unvan').fill('Yeniden denenecek')
  await expect(page.locator('[data-save-retry]')).toBeVisible()
  await setSavesBroken(page, false)
  await page.locator('[data-save-retry]').click()
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')
  expect(await storedPersonal(page, cvId)).toMatchObject({ headline: 'Yeniden denenecek' })

  await setSavesBroken(page, true)
  await page.getByLabel('Unvan').fill('Bırakılacak')
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'error')
  await page.getByRole('link', { name: "CV'lerime dön" }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Yine de çık' }).click()
  await expect(page).toHaveURL(/\/cvler$/)
  await setSavesBroken(page, false)
  expect(await storedPersonal(page, cvId)).toMatchObject({ headline: 'Yeniden denenecek' })
})

test('Ctrl+Z: CV dışındaki metin kutusunda tarayıcınındır; AltGr kısayol değildir', async ({ page }) => {
  await createCv(page)
  const headline = page.getByLabel('Unvan')
  await headline.fill('Bir')
  const prompt = page.getByLabel('Yapay zekâdan iste')
  await prompt.click()
  await page.keyboard.type('merhaba')
  await page.keyboard.press('Control+z')
  await expect(headline).toHaveValue('Bir')

  // AltGr (Ctrl+Alt) ile yazılan karakter kısayol sayılmaz: CV geri alınmaz.
  await headline.click()
  await page.keyboard.press('Control+Alt+z')
  await expect(headline).toHaveValue('Bir')
  await page.keyboard.press('Control+z')
  await expect(headline).toHaveValue('')
})

test('bölüm adı kutusunda Ctrl+Z kutunundur; Enter sonrası odak başlığa döner', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  const headline = page.getByLabel('Unvan')
  await headline.fill('Geri alınmamalı')
  const title = page.locator('[data-section-title]').first()
  await title.click()
  const input = page.getByLabel('Bölüm başlığı', { exact: true })
  await input.fill('Yeni başlık')
  await page.keyboard.press('Control+z')
  // CV'nin son adımı (unvan) geri alınmadı; kutu açık kaldı.
  await expect(headline).toHaveValue('Geri alınmamalı')
  await expect(input).toBeVisible()
  await input.fill('Yeni başlık')
  await page.keyboard.press('Enter')
  await expect(title).toHaveText('Yeni başlık')
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-section-title'))).toBe(true)
})

test('kayıt silinince odak komşu kayda gider; "Geri al" bildirimi fare üstündeyken kapanmaz', async ({ page }) => {
  await createCv(page, { start: 'sample' })
  // İki ya da daha çok kaydı olan ilk bölümün ilk iki kaydı
  const [firstId, nextId] = await page.evaluate(() => {
    for (const section of document.querySelectorAll('[data-section-id]')) {
      const items = [...section.querySelectorAll('[id^="item-"]')].map((el) => el.id)
      if (items.length >= 2) return items
    }
    return []
  })
  expect(nextId).toBeTruthy()
  await page.locator(`[id="${firstId}"] [data-item-actions]`).click()
  await page.getByRole('menuitem', { name: 'Sil' }).click()
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[id^="item-"]')?.id))
    .toBe(nextId)
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-item-actions'))).toBe(true)

  const toastEl = page.locator('[data-toast]', { hasText: 'silindi' })
  await expect(toastEl).toBeVisible()
  await toastEl.hover()
  await expect(toastEl).toHaveAttribute('data-paused', '')
  await page.waitForTimeout(7_600)
  await expect(toastEl).toBeVisible()
  await toastEl.locator('[data-toast-action]').click()
  await expect(page.locator(`[id="${firstId}"]`)).toBeVisible()
})

test('CV listesinde yeniden adlandırınca odak kartın işlem düğmesine döner', async ({ page }) => {
  await createCv(page, { name: 'Adı değişecek' })
  await page.goto('/cvler')
  await page.getByRole('button', { name: 'Adı değişecek için işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Yeniden adlandır' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('Yeni ad')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Yeni ad' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
    .toBe('Yeni ad için işlemler')
})

test('form ayrıntıları: e-posta alanı, ayırıcının değeri, okunamayan CV\'nin ham verisi', async ({ page }) => {
  const cvId = await createCv(page)
  const email = page.getByLabel('E-posta')
  await expect(email).toHaveAttribute('type', 'text')
  await expect(email).toHaveAttribute('inputmode', 'email')
  await expect(email).toHaveAttribute('autocomplete', 'email')
  // IDN alan adı punycode'a çevrilmez.
  await email.fill('deniz@örnek.com.tr')
  await expect(email).toHaveValue('deniz@örnek.com.tr')

  const splitter = page.getByRole('separator', { name: 'Panel genişliği' })
  const now = Number(await splitter.getAttribute('aria-valuenow'))
  expect(now).toBeGreaterThan(0)
  expect(Number(await splitter.getAttribute('aria-valuemin'))).toBeLessThanOrEqual(now)
  expect(Number(await splitter.getAttribute('aria-valuemax'))).toBeGreaterThanOrEqual(now)
  await splitter.focus()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => Number(await splitter.getAttribute('aria-valuenow'))).toBeGreaterThan(now)

  // Okunamayan kayıt: kısa açıklama ve ham verinin indirilmesi.
  await expect(saveStatus(page)).toHaveAttribute('data-save-state', 'saved')
  await patchCv(page, cvId, 'cv.personal.fullName = 5; cv.name = "Bozuk kayıt"')
  await page.reload()
  await expect(page.locator('[data-editor-status="broken"]')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ham veriyi indir' }).click()
  const raw = JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8'))
  expect(raw.name).toBe('Bozuk kayıt')
  expect(raw.personal.fullName).toBe(5)
})

test('yeni CV\'nin dili arayüz dilini izler', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'))
  await page.goto('/sablonlar')
  await page.getByRole('button', { name: /Choose the .+ template/ }).first().click()
  await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('CV name')).toHaveValue(/EN/)
})
