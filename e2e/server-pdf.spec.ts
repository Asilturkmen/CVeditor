import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { createCv, patchCv } from './helpers.ts'
import { fontReport, pdfText, squash } from './pdf.ts'

/**
 * Tek tuşla PDF, gerçek sunucuyla: sunucu paketi (vite.server.config.ts) derlenir ve ayrı bir
 * portta açılır; test sayfasının /api istekleri ona iletilir (e2e'nin Vite sunucusu sunucusuzdur).
 * "PDF al" yazdır penceresi değil, sunucunun bastığı PDF'i indirir.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = 'node_modules/.tmp/e2e-server'
const APP_ORIGIN = 'http://localhost:5174'

// Tek işçi: sunucu bir kez derlenip açılır (aynı çıktı klasörüne iki derleme yazmasın).
test.describe.configure({ mode: 'serial' })

let server: ChildProcess | null = null
let api = ''

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolve(port))
    })
  })
}

test.beforeAll(async () => {
  test.setTimeout(120_000)
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '-c', 'vite.server.config.ts', '--logLevel', 'error'], {
    cwd: ROOT,
    env: { ...process.env, SERVER_OUT_DIR: OUT_DIR },
    stdio: 'inherit',
  })
  const port = await freePort()
  api = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [`${OUT_DIR}/index.js`], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SERVE_STATIC: '0', FONTS_DIR: 'public/fonts', PUBLIC_ORIGIN: APP_ORIGIN },
    stdio: 'inherit',
  })
  await expect.poll(async () => (await fetch(`${api}/api/health`).catch(() => null))?.status, { timeout: 20_000 }).toBe(200)
})

test.afterAll(() => {
  server?.kill()
})

/** Sayfanın /api isteklerini test sunucusuna iletir; gidenleri kaydeder. */
async function useServer(page: Page) {
  const calls: string[] = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    calls.push(`${route.request().method()} ${url.pathname}${url.search}`)
    const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  return calls
}

test('PDF al: sunucu varken gerçek PDF iner (Ad_Soyad_CV_dil adıyla), yazdır penceresi açılmaz', async ({ page }) => {
  test.setTimeout(60_000)
  const calls = await useServer(page)
  await createCv(page, { start: 'sample', name: 'Yazılım TR' })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: /^PDF al$/ }).first().click()
  const download = await downloading
  // Yazdır penceresiyle aynı ad (vault kararı: "CV_tr / CV_en"); örnek kişi Deniz Aksoy, CV dili Türkçe.
  expect(download.suggestedFilename()).toBe('Deniz_Aksoy_CV_tr.pdf')
  const pdf = readFileSync(await download.path())
  const pages = await pdfText(pdf)
  const text = squash(pages.map((p) => p.items.map((i) => i.str).join('')).join(''))
  expect(text).toContain('DenizAksoy')
  expect(text).toMatch(/[ğüşıİ]/)
  // Önizlemenin yazı tipleri gömülü (Zarif: EB Garamond); sistem yedeği yok, Type3 yok.
  const baseFonts = [...pdf.toString('latin1').matchAll(/\/BaseFont\s*\/[A-Z]{6}\+([\w-]+)/g)].map((m) => m[1])
  expect(baseFonts.length).toBeGreaterThan(0)
  expect(baseFonts.every((name) => name.startsWith('EBGaramond'))).toBe(true)
  expect(fontReport(pdf)).toMatchObject({ type3: 0, notEmbedded: 0 })
  expect(calls).toEqual(['GET /api/health', 'POST /api/pdf'])
})

test('uzun kayıt: önizlemenin onay penceresi, onaydan sonra sunucuya allowSplit=1 gider', async ({ page }) => {
  test.setTimeout(60_000)
  const calls = await useServer(page)
  const id = await createCv(page, { start: 'sample' })
  await patchCv(
    page,
    id,
    `const exp = cv.sections.find((s) => s.type === 'experience');
     exp.items[1].description = '<ul>' + Array.from({ length: 70 }, (_, i) => '<li>Madde ' + (i + 1) + ' sonucu ölçülebilir biçimde anlatır.</li>').join('') + '</ul>';`,
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
  await page.getByRole('button', { name: /^PDF al$/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Bir sayfadan uzun kayıt var')
  await dialog.getByRole('checkbox').check()
  const downloading = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'PDF al' }).click()
  const pdf = readFileSync(await (await downloading).path())
  const text = squash((await pdfText(pdf)).map((p) => p.items.map((i) => i.str).join('')).join(''))
  expect(text).toContain('Madde1sonucu')
  expect(text).toContain('Madde70sonucu')
  expect(calls).toContain('POST /api/pdf?allowSplit=1')
})

test('sunucu uzun kayıt bildirirse (409) aynı onay penceresi o kayıtla açılır', async ({ page }) => {
  test.setTimeout(60_000)
  const calls = await useServer(page)
  const id = await createCv(page, { start: 'sample' })
  // Önizleme uzun kayıt görmedi ama sunucu 409 döndü (ör. farklı tarayıcıda farklı satır kırılımı).
  await page.route('**/api/pdf', async (route) => {
    if (route.request().url().includes('allowSplit=1')) return route.fallback()
    const cv = route.request().postDataJSON() as { sections: { id: string; type: string; items: { id: string }[] }[] }
    const exp = cv.sections.find((s) => s.type === 'experience')!
    calls.push('409')
    await route.fulfill({ status: 409, json: { error: 'oversized', items: [{ sectionId: exp.id, itemId: exp.items[0].id, label: null }] } })
  })
  expect(id).toBeTruthy()
  await page.getByRole('button', { name: /^PDF al$/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Bir sayfadan uzun kayıt var')
  await expect(dialog).toContainText('Frontend Geliştirici')
  await dialog.getByRole('checkbox').check()
  const downloading = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'PDF al' }).click()
  await downloading
  expect(calls).toContain('409')
  expect(calls).toContain('POST /api/pdf?allowSplit=1')
})
