import { expect, test, type Page } from '@playwright/test'
import { preview } from './helpers.ts'

/**
 * Çeviri akışları (örnek çevirmenle). Örnek CV'ler geliştirme sunucusunun
 * modülleriyle doğrudan veritabanına yazılır; içe aktarma ekranına bağlı değil.
 */
async function seedSampleCv(page: Page, name: string, language: 'tr' | 'en'): Promise<string> {
  if (!page.url().startsWith('http')) await page.goto('/cvler')
  await page.waitForFunction(() => '__cveditorDb' in window)
  return page.evaluate(`(async () => {
    const { createCv } = await import('/src/cv/factory.ts')
    const { samplePersonal, sampleSections } = await import('/src/cv/sample.ts')
    const { templateSettingsFor } = await import('/src/render/templates.ts')
    const sections = sampleSections(${JSON.stringify(language)})
    const cv = createCv({
      name: ${JSON.stringify(name)},
      language: ${JSON.stringify(language)},
      templateId: 'zarif',
      template: templateSettingsFor('zarif', sections),
      personal: samplePersonal(${JSON.stringify(language)}),
      sections,
    })
    await window.__cveditorDb.cvs.put(cv)
    return cv.id
  })()`) as Promise<string>
}

type Item = Record<string, string>
async function readCv(page: Page, id: string) {
  return page.evaluate(`window.__cveditorDb.cvs.get(${JSON.stringify(id)})`) as Promise<{
    name: string
    language: string
    personal: Item
    sections: { type: string; items: Item[] }[]
  }>
}

async function openEditor(page: Page, id: string) {
  await page.goto(`/editor/${id}`)
  await expect(preview(page).locator('.page').first()).toBeVisible()
}

test('Türkçe CV İngilizceye çevrilir: önce gösterilir, düzeltilir, yeni CV olarak kaydedilir', async ({ page }) => {
  const id = await seedSampleCv(page, 'Genel TR', 'tr')
  await openEditor(page, id)

  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Diğer dile çevir' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'İngilizceye çevir' })).toBeVisible()
  await expect(dialog.getByText(/Türkçe CV'nin İngilizce kopyası oluşturulur/)).toBeVisible()
  await expect(dialog.getByText('Örnek çeviri.')).toBeVisible()
  await expect(dialog.getByLabel("Yeni CV'nin adı")).toHaveValue('Genel EN')
  await dialog.getByRole('button', { name: 'Çevir' }).click()

  await expect(dialog.getByRole('heading', { name: 'Çeviriyi kontrol et' })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Deneyim' })).toBeVisible()
  await expect(dialog.getByLabel('Unvan çevirisi')).toHaveValue('Frontend Developer')
  await expect(dialog.getByLabel('Derece çevirisi')).toHaveValue("Bachelor's degree")
  // Şirket adı çevrilecekler listesinde yok
  await expect(dialog.getByLabel('Şirket çevirisi')).toHaveCount(0)

  // Bir alanı satır içinde düzelt, birini olduğu gibi bırak
  await dialog.getByLabel('Rol çevirisi').first().fill('Creator')
  await dialog.getByRole('switch', { name: 'Unvan alanını çevirme, olduğu gibi bırak' }).click()
  await expect(dialog.getByText('Olduğu gibi kalacak')).toBeVisible()

  await dialog.getByRole('button', { name: 'Çeviriyi kaydet' }).click()
  await page.waitForURL((url) => !url.pathname.endsWith(id))
  await expect(page.getByText('"Genel EN" oluşturuldu')).toBeVisible()

  const frame = preview(page)
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en')
  await expect(frame.getByText('Experience', { exact: true })).toBeVisible()
  await expect(frame.getByText('Software Intern').first()).toBeVisible()
  await expect(frame.getByText('Martı Teknoloji').first()).toBeVisible()

  const newId = page.url().split('/').pop()!
  const [source, translated] = [await readCv(page, id), await readCv(page, newId)]
  expect(translated.name).toBe('Genel EN')
  expect(translated.language).toBe('en')
  expect(translated.personal.headline).toBe('Frontend Geliştirici')
  const exp = (cv: typeof source) => cv.sections.find((s) => s.type === 'experience')!.items
  expect(exp(translated).map((i) => i.company)).toEqual(exp(source).map((i) => i.company))
  expect(exp(translated)[1].position).toBe('Software Intern')
  expect(exp(translated).map((i) => i.translationGroupId)).toEqual(exp(source).map((i) => i.translationGroupId))
  const projects = translated.sections.find((s) => s.type === 'projects')!.items
  expect(projects[0]).toMatchObject({ name: 'Rota', role: 'Creator' })
  // Kaynak CV değişmedi
  expect(exp(source)[1].position).toBe('Yazılım Stajyeri')

  await page.goto('/cvler')
  await expect(page.getByRole('heading', { name: 'Genel TR' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Genel EN' })).toBeVisible()
})

test('çeviri durdurulabilir', async ({ page }) => {
  const id = await seedSampleCv(page, 'Genel TR', 'tr')
  await openEditor(page, id)
  await page.getByRole('button', { name: 'Diğer işlemler' }).click()
  await page.getByRole('menuitem', { name: 'Diğer dile çevir' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Çevir' }).click()
  await dialog.getByRole('button', { name: 'Durdur' }).click()
  await expect(dialog.getByRole('button', { name: 'Çevir' })).toBeVisible()
  await page.waitForTimeout(900)
  await expect(dialog.getByRole('heading', { name: 'İngilizceye çevir' })).toBeVisible()
})

test('kayıt öbür dildeki CV\'ye çevrilerek eklenir; bağlı kayıt sonra güncellenir', async ({ page }) => {
  const target = await seedSampleCv(page, 'Genel EN', 'en')
  const id = await seedSampleCv(page, 'Genel TR', 'tr')
  await openEditor(page, id)

  const openCopy = async () => {
    const card = page.locator('[id^="item-"]', { hasText: 'Yazılım Stajyeri' }).first()
    await card.getByRole('button', { name: /için işlemler/ }).click()
    await page.getByRole('menuitem', { name: "Başka CV'ye ekle…" }).click()
  }

  await openCopy()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('radio', { name: /Genel EN/ })).toHaveAttribute('aria-checked', 'true')
  await expect(dialog.getByRole('radio', { name: 'Çevirerek ekle' })).toHaveAttribute('aria-checked', 'true')
  await dialog.getByRole('button', { name: 'Çevir' }).click()
  await expect(dialog.getByLabel('Pozisyon çevirisi')).toHaveValue('Software Intern')
  await dialog.getByRole('button', { name: 'Çeviriyle ekle' }).click()
  await expect(page.getByText('"Genel EN" CV\'sine eklendi')).toBeVisible()

  const source = await readCv(page, id)
  const srcItem = source.sections.find((s) => s.type === 'experience')!.items[1]
  let exp = (await readCv(page, target)).sections.find((s) => s.type === 'experience')!.items
  let linked = exp.filter((i) => i.translationGroupId === srcItem.translationGroupId)
  expect(linked).toHaveLength(1)
  expect(linked[0]).toMatchObject({ position: 'Software Intern', company: 'Martı Teknoloji' })

  // İkinci kez: hedefte bağlı kayıt var → güncelle
  await openCopy()
  await expect(dialog.getByRole('radio', { name: /Genel EN/ })).toContainText('Bağlı kaydı var')
  await expect(dialog.getByRole('radio', { name: 'Bağlı kaydı güncelle' })).toHaveAttribute('aria-checked', 'true')
  await dialog.getByRole('radio', { name: 'Olduğu gibi ekle' }).click()
  await dialog.getByRole('button', { name: 'Güncelle' }).click()
  await expect(page.getByText('"Genel EN" CV\'sindeki bağlı kayıt güncellendi')).toBeVisible()

  exp = (await readCv(page, target)).sections.find((s) => s.type === 'experience')!.items
  linked = exp.filter((i) => i.translationGroupId === srcItem.translationGroupId)
  expect(linked).toHaveLength(1)
  expect(linked[0].position).toBe('Yazılım Stajyeri')
})
