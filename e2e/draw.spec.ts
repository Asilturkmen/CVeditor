import { expect, test, type Page } from '@playwright/test'
import { pdfText, squash } from './pdf.ts'

/**
 * Çizim motoru gerçek Chromium'da (src/render/drawDocument.ts, paginate.ts, pageScript.ts):
 * - Sunucunun yolu (iskelet + enjekte edilen betik + `window.__cvDraw`) önizlemenin yoluyla
 *   (modül olarak `drawDocument` + `paginate`, betiksiz iframe) aynı sayfaları çizer.
 * - Ölçüm animasyondan etkilenmez: `.sg-added` ve yeni sayfanın belirme dönüşümü ölçülen kutuyu kaydırmaz.
 * Modüller geliştirme sunucusundan (Vite) içe aktarılır: fonksiyon gövdeleri derlenmiş hâlleriyle
 * `toString()` edilip sınanır.
 */

interface DrawInput {
  lang: string
  styles: string
  html: string
  fontQueries: string[]
  previousPageCount?: number
}

interface Built {
  shell: string
  script: string
  input: DrawInput
}

const NBSP_NAME = 'Ayşe Yılmaz'

/** Örnek CV + 8 ek deneyim kaydı (2+ sayfa); ad bölünmez boşlukla yapıştırılmış gibi. */
async function build(page: Page, templateId: string, options: { added?: boolean } = {}): Promise<Built> {
  await page.goto('/sablonlar')
  return page.evaluate(
    async ({ templateId, name, added }) => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const [factory, sample, templates, renderCv, fonts, pageScript] = await Promise.all([
        load('/src/cv/factory.ts'),
        load('/src/cv/sample.ts'),
        load('/src/render/templates.ts'),
        load('/src/render/renderCv.ts'),
        load('/src/render/fonts.ts'),
        load('/src/render/pageScript.ts'),
      ])
      const sections = sample.sampleSections('tr')
      const exp = sections.find((s: { type: string }) => s.type === 'experience')
      for (let i = 1; i <= 8; i++) {
        exp.items.push({
          ...structuredClone(exp.items[0]),
          id: `ek-kayit-${i}`,
          translationGroupId: `ek-grup-${i}`,
          position: `Ek Görev ${i}`,
          company: `Örnek Şirket ${i}`,
          description: `<ul>${[1, 2, 3].map((k) => `<li>Görev ${i} maddesi ${k} ölçülebilir bir sonucu kısaca anlatır.</li>`).join('')}</ul>`,
        })
      }
      const cv = factory.createCv({
        name: 'Çizim',
        language: 'tr',
        templateId,
        template: templates.templateSettingsFor(templateId, sections),
        personal: { ...sample.samplePersonal('tr'), fullName: name },
        sections,
      })
      let html: string = renderCv.renderCvSource(cv)
      if (added) {
        // Öneriyle eklenmiş kayıt görünümü (CvMarkup'ın .sg-added sınıfı; giriş animasyonu taşır).
        const doc = new DOMParser().parseFromString(html, 'text/html')
        doc.querySelectorAll('.entry').forEach((el) => el.classList.add('sg', 'sg-added'))
        html = doc.body.innerHTML
      }
      const fontQueries = Object.values(renderCv.cvFonts(templates.getTemplate(templateId), cv.template)).flatMap(
        (def) => fonts.fontLoadQueries(def) as string[],
      )
      return {
        shell: renderCv.documentShell({ lang: 'tr', fontBase: `${location.origin}/fonts/` }) as string,
        script: pageScript.pageDrawScript() as string,
        input: { lang: 'tr', styles: renderCv.cvStyles(cv) as string, html, fontQueries },
      }
    },
    { templateId, name: NBSP_NAME, added: options.added ?? false },
  )
}

/** Sunucunun yapacağı gibi: boş sekme, iskelet, betik, `__cvDraw`. Sayfa açık döner (PDF için). */
async function drawLikeServer(page: Page, built: Built) {
  const server = await page.context().newPage()
  // Aynı köken: yazı tipi adresleri çözülsün (sunucuda kendi statik yolu).
  await server.goto('/fonts/README.txt')
  await server.setContent(built.shell, { waitUntil: 'load' })
  await server.addScriptTag({ content: built.script })
  return server
}

const pageTexts = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll('#cv-pages > .page')).map((p) => (p as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))

for (const templateId of ['zarif', 'panel']) {
  test(`${templateId}: sunucu yolu (enjekte betik) önizleme yoluyla aynı sayfaları çizer; PDF aynı sayıda sayfa`, async ({ page }) => {
    const built = await build(page, templateId)
    expect(built.script).not.toMatch(/\bimport\b|__vite|__name\(/)

    // Önizleme yolu: betiksiz iframe, modüllerden drawDocument + paginate (CvFrame'in yaptığı gibi).
    const viaPreview = await page.evaluate(async ({ shell, input, modules }) => {
      const [{ drawDocument }, { paginate }] = await Promise.all(modules.map((path) => import(/* @vite-ignore */ path)))
      const iframe = document.createElement('iframe')
      iframe.setAttribute('sandbox', 'allow-same-origin allow-modals')
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;border:0'
      const loaded = new Promise((resolve) => iframe.addEventListener('load', resolve, { once: true }))
      iframe.srcdoc = shell
      document.body.append(iframe)
      await loaded
      const doc = iframe.contentDocument!
      const result = await drawDocument(doc, input, { paginate })
      const texts = Array.from(doc.querySelectorAll('#cv-pages > .page')).map((p) => (p as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
      return { result, texts, name: doc.querySelector('.cv-name')?.textContent ?? null }
    }, { ...built, modules: ['/src/render/drawDocument.ts', '/src/render/paginate.ts'] })

    const server = await drawLikeServer(page, built)
    try {
      const viaServer = await server.evaluate((input) => (window as unknown as { __cvDraw: (i: unknown) => Promise<Record<string, unknown>> }).__cvDraw(input), built.input)
      const serverTexts = await pageTexts(server)

      const { contentHeight: _a, ...previewResult } = viaPreview.result as Record<string, unknown>
      const { contentHeight: _b, ...serverResult } = viaServer
      expect(serverResult).toEqual(previewResult)
      expect(serverResult).toMatchObject({ clipped: false, headerClipped: false, fontsTimedOut: false })
      expect(viaServer.pageCount as number).toBeGreaterThanOrEqual(2)
      expect(serverTexts).toEqual(viaPreview.texts)
      // Bölünmez boşluklu ad düz boşlukla çizilir (kelime aralarından kırılabilir, ATS ad-soyad ayırır).
      expect(viaPreview.name).toBe('Ayşe Yılmaz')
      expect(await server.locator('.cv-name').textContent()).toBe('Ayşe Yılmaz')

      await server.emulateMedia({ media: 'print' })
      const pdf = await server.pdf({ preferCSSPageSize: true, printBackground: true })
      const pages = await pdfText(pdf)
      expect(pages).toHaveLength(viaServer.pageCount as number)
      expect(squash(pages[0].items.map((i) => i.str).join(''))).toContain('AyşeYılmaz')
      expect(squash(pages.at(-1)!.items.map((i) => i.str).join(''))).not.toBe('')
    } finally {
      await server.close()
    }
  })
}

test('ölçüm sırasında animasyon yok: .sg-added ve yeni sayfanın dönüşümü ölçülen kutuları kaydırmaz', async ({ page }) => {
  const built = await build(page, 'zarif', { added: true })
  const server = await drawLikeServer(page, built)
  try {
    const report = await server.evaluate(async (input) => {
      // Sayfalamanın her ölçümünde, ölçülen kutunun ve atalarının o anki dönüşümü kaydedilir.
      const measured: string[] = []
      const record = (target: Element) => {
        const pages = document.getElementById('cv-pages')!
        for (let el: Element | null = target; el && el !== pages; el = el.parentElement) {
          const transform = getComputedStyle(el).transform
          if (transform !== 'none') measured.push(`${el.className}: ${transform}`)
        }
      }
      const original = Element.prototype.getBoundingClientRect
      Element.prototype.getBoundingClientRect = function (this: Element) {
        record(this)
        return original.call(this)
      }
      const draw = (window as unknown as { __cvDraw: (i: unknown) => Promise<{ pageCount: number }> }).__cvDraw
      // previousPageCount 1: 2. ve sonraki sayfalar .page-enter (belirme animasyonu) alır.
      const result = await draw({ ...input, previousPageCount: 1 })
      Element.prototype.getBoundingClientRect = original
      const added = document.querySelector<HTMLElement>('#cv-pages .sg-added')!
      const style = getComputedStyle(added)
      return {
        pageCount: result.pageCount,
        measuredAdded: document.querySelectorAll('#cv-pages .sg-added').length,
        transformed: measured,
        measuring: document.getElementById('cv-pages')!.hasAttribute('data-measuring'),
        // Ölçüm bitince animasyon başlar: ilk karede kayma var (ölçüm açık olsaydı sayılırdı).
        animationAfter: style.animationName,
        transformAfter: style.transform,
        enter: document.querySelectorAll('#cv-pages > .page.page-enter').length,
      }
    }, built.input)
    expect(report.pageCount).toBeGreaterThanOrEqual(2)
    expect(report.measuredAdded).toBeGreaterThan(3)
    expect(report.enter).toBe(report.pageCount - 1)
    expect(report.transformed).toEqual([])
    expect(report.measuring).toBe(false)
    expect(report.animationAfter).toBe('sg-add-in')
    expect(report.transformAfter).not.toBe('none')
  } finally {
    await server.close()
  }
})
