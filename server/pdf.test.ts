import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createApp } from './app'
import { cvRenderInput, RENDER_ORIGIN } from './pdf/render'
import { jsonPost, oversizedCv, sampleCv, testConfig } from './testUtils'

/**
 * /api/pdf gerçek Chromium'la (playwright-core; e2e'nin kullandığı tarayıcı): örnek CV → PDF,
 * PDF metni pdf.js ile okunur. Sayfa dış ağa hiç istek atmamalı.
 */

async function pdfPages(data: ArrayBuffer): Promise<string[]> {
  const task = getDocument({ data: new Uint8Array(data) })
  const doc = await task.promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
  }
  await task.destroy()
  return pages
}

const squash = (text: string) => text.replace(/\s+/g, '')

describe('/api/pdf gerçek Chromium ile', () => {
  const requests: { url: string; allowed: boolean }[] = []
  const { app, browser } = createApp({ config: testConfig(), onRenderRequest: (url, allowed) => requests.push({ url, allowed }) })
  afterAll(() => browser.close())

  it('örnek CV → A4 PDF: ad, bölüm başlıkları ve Türkçe karakterler metinde; dış istek yok', async () => {
    const cv = sampleCv()
    // Taban ve şablon CSS'i (?raw) gerçekten yüklü: PDF şablonla basılıyor.
    expect(cvRenderInput(cv).styles).toContain('@page')
    const res = await app.request('/api/pdf', jsonPost(cv))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    // Dosya adı yazdır yoluyla aynı (`pdfBaseName`): "Ad_Soyad_CV_<dil>.pdf".
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="Deniz_Aksoy_CV_tr.pdf"; filename*=UTF-8''Deniz_Aksoy_CV_tr.pdf`,
    )
    const data = await res.arrayBuffer()
    expect(new TextDecoder().decode(data.slice(0, 5))).toBe('%PDF-')

    const task = getDocument({ data: new Uint8Array(data.slice(0)) })
    const { view } = await (await task.promise).getPage(1)
    // A4: 595 × 842 pt
    expect(Math.round(view[2])).toBe(595)
    expect(Math.round(view[3])).toBe(842)
    await task.destroy()

    const pages = await pdfPages(data)
    expect(pages.length).toBe(Number(res.headers.get('x-cv-pages')))
    const all = squash(pages.join(''))
    expect(all).toContain('DenizAksoy')
    for (const title of ['Deneyim', 'Eğitim']) expect(all.toLocaleLowerCase('tr')).toContain(title.toLocaleLowerCase('tr'))
    expect(all).toMatch(/[ğüşıöçİ]/)

    expect(requests.length).toBeGreaterThan(2)
    expect(requests.filter((r) => !r.allowed)).toEqual([])
    expect(requests.every((r) => r.url.startsWith(`${RENDER_ORIGIN}/`))).toBe(true)
    expect(requests.some((r) => r.url.endsWith('.woff2'))).toBe(true)
  })

  it('bir sayfadan uzun kayıt: onaysız 409 + kayıt etiketi; ?allowSplit=1 ile çok sayfalı PDF, metin kaybolmaz', async () => {
    const cv = oversizedCv()
    const refused = await app.request('/api/pdf', jsonPost(cv))
    expect(refused.status).toBe(409)
    const body = (await refused.json()) as { error: string; items: { sectionId: string; itemId: string; label: string }[] }
    const exp = cv.sections.find((s) => s.type === 'experience')!
    expect(body.error).toBe('oversized')
    expect(body.items).toEqual([{ sectionId: exp.id, itemId: exp.items[0].id, label: expect.any(String) }])

    const res = await app.request('/api/pdf?allowSplit=1', jsonPost(cv))
    expect(res.status).toBe(200)
    const pages = await pdfPages(await res.arrayBuffer())
    expect(pages.length).toBeGreaterThanOrEqual(2)
    const all = squash(pages.join(''))
    expect(all).toContain('Madde1ölçülebilir')
    expect(all).toContain('Madde70ölçülebilir')
  })

  it('zengin metne gömülü dış kaynak süzülür; CV içeriği betik çalıştıramaz', async () => {
    const cv = sampleCv('Saldırı')
    const exp = cv.sections.find((s) => s.type === 'experience')!
    const item = exp.items[0] as { description: string }
    item.description = '<p>Güvenli metin<img src="https://example.com/x.png"><script>fetch("https://example.com")</script></p><style>@import url(https://example.com/a.css)</style>'
    requests.length = 0
    const res = await app.request('/api/pdf', jsonPost(cv))
    expect(res.status).toBe(200)
    expect(squash((await pdfPages(await res.arrayBuffer())).join(''))).toContain('Güvenlimetin')
    expect(requests.filter((r) => !r.url.startsWith(`${RENDER_ORIGIN}/`))).toEqual([])
  })

  it('eski şema sürümündeki CV göçle yükseltilip basılır', async () => {
    const cv = sampleCv('Eski') as unknown as Record<string, unknown>
    const old = { ...cv, schemaVersion: 1, templateId: 'klasik' }
    const res = await app.request('/api/pdf', jsonPost(old))
    expect(res.status).toBe(200)
  })

  it('yazı tipi dosyası bulunamazsa yedek yazı tipiyle basılmaz: 500', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'cveditor-fonts-'))
    const other = createApp({ config: testConfig({ FONTS_DIR: empty }), browser })
    const res = await other.app.request('/api/pdf', jsonPost(sampleCv()))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'render_failed' })
  })

  it('tarayıcı çökerse sonraki istekte yeniden açılır', async () => {
    const first = await browser.get()
    await first.close()
    const res = await app.request('/api/pdf', jsonPost(sampleCv()))
    expect(res.status).toBe(200)
    expect(await browser.get()).not.toBe(first)
  })
})
