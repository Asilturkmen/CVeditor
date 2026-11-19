import { expect, type FrameLocator, type Page } from '@playwright/test'

export const preview = (page: Page): FrameLocator => page.frameLocator('iframe[title="CV önizleme"]')

/**
 * Şablon sayfasını açar (Şablonlar → karta tıkla): büyük önizleme + Yeni CV formu tek sayfada.
 * `template`: şablonun arayüzdeki (Türkçe) adı, ör. "Zarif".
 */
export async function openTemplate(page: Page, template = 'Zarif') {
  await page.goto('/sablonlar')
  await page.getByRole('button', { name: new RegExp(`${template} şablonunu seç`) }).click()
  await expect(page.locator('[data-template-sheet]')).toBeVisible()
}

/**
 * Şablon sayfasında "Eski CV'yi içe aktar"ı seçip "Devam: PDF seç" ile içe aktarma penceresini açar
 * (dosya seçimi → bulunan kayıtlar; "CV'yi oluştur" bu pencerede).
 */
export async function continueToImport(page: Page) {
  await page.getByRole('radio', { name: /Eski CV'yi içe aktar/ }).click()
  await page.getByRole('button', { name: 'Devam: PDF seç' }).click()
  await expect(page.getByText("Eski CV'nin PDF'ini seç")).toBeVisible()
}

/**
 * Şablonlar ekranından yeni CV oluşturur ve editörü açar. Akış: şablon kartı → şablon sayfası
 * (ad, dil, başlangıç aynı sayfada) → "Bu şablonla başla"; örnekle başlarken "Devam: PDF seç" →
 * içe aktarma penceresinde "Örnekle göster" → "CV'yi oluştur".
 */
export async function createCv(
  page: Page,
  /** `template`: şablonun arayüzdeki (Türkçe) adı, ör. "Zarif" */
  options: { template?: string; name?: string; language?: 'Türkçe' | 'İngilizce'; start?: 'blank' | 'sample' } = {},
) {
  const { template = 'Zarif', name, language, start = 'blank' } = options
  await openTemplate(page, template)
  if (language) await page.getByRole('radio', { name: language }).click()
  if (name) await page.getByLabel('CV adı').fill(name)
  if (start === 'sample') {
    await continueToImport(page)
    await page.getByRole('button', { name: 'Örnekle göster' }).click()
    await expect(page.getByText('Bulunan kayıtlar (örnek veri)')).toBeVisible()
    await page.getByRole('button', { name: "CV'yi oluştur" }).click()
  } else {
    await page.getByRole('button', { name: 'Bu şablonla başla' }).click()
  }
  await page.waitForURL(/\/editor\//)
  // Yük altında (çok işçi) editörün ilk çizimi 10 sn'yi aşabiliyor: ilk açılışa daha uzun süre tanınır.
  await expect(preview(page).locator('.page').first()).toBeVisible({ timeout: 20_000 })
  await settleViewTransition(page)
  return page.url().split('/').pop()!
}

/**
 * Sayfa geçişi (View Transition, ~250 ms) sürerken tarayıcı bütün tıklamaları belge köküne verir:
 * editör açılır açılmaz yapılan tıklama (önizlemede kayda, panelde satıra) kaybolur. Geçişin bitmesi beklenir.
 */
export async function settleViewTransition(page: Page) {
  await page.waitForFunction(() => !document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition')))
}

/**
 * Sağ paneldeki anahatta bir kaydı açar (kapalıysa). `scope`: kayıt satırını içeren metin ya da
 * locator (ör. bölüm). Kapalı kaydın alanları çizilmez; alana yazmadan önce kayıt açılır.
 */
export async function openRow(page: Page, text: string | RegExp, index = 0) {
  const row = page.locator('[id^="item-"]', { hasText: text }).nth(index)
  const toggle = row.locator('[aria-expanded]').first()
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return row
}

/**
 * Bölümdeki n. kaydı açar (adı olmayan boş kayıtlar için). Bölümde o kadar kayıt yoksa (boş CV'de
 * Deneyim/Eğitim kayıtsız gelir) bölümün "+ … ekle" düğmesiyle yeni kayıt eklenir; yeni kayıt açık gelir.
 */
export async function openRowIn(page: Page, section: string, index = 0) {
  const region = page.getByRole('region', { name: section, exact: true })
  const rows = region.locator('[id^="item-"]')
  if ((await rows.count()) <= index) {
    await region.locator('[data-add-item]').first().click()
    await expect(rows).toHaveCount(index + 1)
  }
  const row = rows.nth(index)
  const toggle = row.locator('[aria-expanded]').first()
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  return row
}

/**
 * CV'yi bilerek birden çok sayfaya uzatır (şablonun yoğunluğundan bağımsız): deneyime `extra` kayıt
 * ekler, sürümü (`updatedAt`) artırır ve sayfayı yeniler. Çok sayfa varsayan testler için.
 */
export async function lengthenCv(page: Page, cvId: string, extra = 6) {
  await patchCv(page, cvId, lengthenScript(extra))
  await page.reload()
  await expect(preview(page).locator('.page').nth(1)).toBeAttached({ timeout: 15_000 })
}

/** `patchCv` gövdesi: deneyime `extra` kayıt ekler ve sürümü (`updatedAt`) artırır. */
export function lengthenScript(extra = 6) {
  return `const exp = cv.sections.find((s) => s.type === 'experience');
    for (let i = 1; i <= ${extra}; i++) {
      exp.items.push({
        ...structuredClone(exp.items[0]),
        id: 'ek-' + i,
        translationGroupId: 'ek-grup-' + i,
        position: 'Ek Görev ' + i,
        description: '<ul>' + [1, 2, 3].map((k) => '<li>Görev ' + i + ' maddesi ' + k + ' ölçülebilir bir sonucu kısaca anlatır.</li>').join('') + '</ul>',
      });
    }
    cv.updatedAt = new Date(Date.parse(cv.updatedAt) + 1000).toISOString();`
}

/** Geliştirme sunucusunda açık olan veritabanı üzerinden CV değiştirir. */
export async function patchCv(page: Page, cvId: string, script: string) {
  await page.waitForFunction(() => '__cveditorDb' in window)
  await page.evaluate(
    async ({ id, body }) => {
      const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<unknown>; put: (cv: unknown) => Promise<unknown> } } }).__cveditorDb
      const cv = await db.cvs.get(id)
      new Function('cv', body)(cv)
      await db.cvs.put(cv)
    },
    { id: cvId, body: script },
  )
}
