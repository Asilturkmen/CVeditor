import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { createCv, patchCv, preview } from './helpers.ts'
import {
  flowText,
  fontReport,
  joinItems,
  orderProblem,
  pdfText,
  renderPreviewPdf,
  settledPageCount,
  squash,
  ySortedText,
  type PdfItem,
  type PdfPage,
} from './pdf.ts'

/**
 * ATS uyumu: önizlemenin HTML'i Chromium'da PDF'e basılır (sunucu yok) ve
 * pdf.js ile metin çıkarılır. Okuma sırası hem içerik akışında (çoğu ATS)
 * hem de y'ye göre sıralı okumada (sütun sütun) doğru olmalı.
 */

interface Layout {
  label: string
  /** Şablonun kimliği (src/render/templates.ts) */
  id: string
  /** Arayüzdeki (Türkçe) adı; şablon seçme düğmesi bununla bulunur */
  template: string
  columns: number
}

/*
 * Matris = her şablon × şemanın izin verdiği her sütun sayısı. Liste kaynaktan okunur
 * (templates.ts'teki TEMPLATE_LIST, schema.ts'teki columns birleşimi); yeni şablon ya da
 * sütun seçeneği kendiliğinden kapsanır. Okumanın doğruluğu aşağıda tarayıcıdaki gerçek
 * modüllerle karşılaştırılır ("matris kaynakla eşleşiyor").
 */
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function parsedTemplateIds(): string[] {
  const list = /TEMPLATE_LIST\b[^=]*=\s*\[([^\]]*)\]/.exec(source('src/render/templates.ts'))
  const ids = [...(list?.[1] ?? '').matchAll(/TEMPLATES\.(\w+)/g)].map((m) => m[1])
  if (ids.length === 0) throw new Error('templates.ts içinde TEMPLATE_LIST okunamadı; ats.spec.ts ayrıştırıcısını güncelle')
  return ids
}

function parsedColumnOptions(): number[] {
  const union = /columns:\s*z\.union\(\[([^\]]*)\]\)/.exec(source('src/cv/schema.ts'))
  const options = [...(union?.[1] ?? '').matchAll(/z\.literal\((\d+)\)/g)].map((m) => Number(m[1]))
  if (options.length === 0) throw new Error('schema.ts içinde columns seçenekleri okunamadı; ats.spec.ts ayrıştırıcısını güncelle')
  return options
}

const TR_MESSAGES = JSON.parse(source('messages/tr.json')) as Record<string, string>
const TEMPLATE_IDS = parsedTemplateIds()
const COLUMN_OPTIONS = parsedColumnOptions()
const COLUMN_LABEL: Record<number, string> = { 1: 'tek sütun', 2: 'iki sütun' }

const LAYOUTS: Layout[] = TEMPLATE_IDS.flatMap((id) => {
  const template = TR_MESSAGES[`template_${id}_name`]
  if (!template) throw new Error(`messages/tr.json içinde template_${id}_name yok`)
  return COLUMN_OPTIONS.map((columns) => ({
    label: `${template} ${COLUMN_LABEL[columns] ?? `${columns} sütun`}`,
    id,
    template,
    columns,
  }))
})

const POSITIONS = [
  ['Frontend Geliştirici', 'Şub 2024 – Günümüz', 'Lacivert Yazılım · İzmir'],
  ['Yazılım Stajyeri', 'Haz 2023 – Eyl 2023', 'Martı Teknoloji · İstanbul'],
  ['Serbest Web Geliştirici', 'Eyl 2021 – May 2023', 'Serbest · Uzaktan'],
]

const HEADER = ['Deniz Aksoy', 'Frontend Geliştirici']
const CONTACT = [
  'deniz.aksoy@example.com',
  '+90 555 000 00 00',
  'İzmir, Türkiye',
  'denizaksoy.example.com',
  'linkedin.com/in/deniz-aksoy-ornek',
  'github.com/deniz-aksoy-ornek',
]
const MAIN = [
  'ÖZET',
  'Erişilebilir ve hızlı web arayüzleri',
  'DENEYİM',
  ...POSITIONS.flat(),
  'EĞİTİM',
  'Ege Üniversitesi',
  'Eyl 2020 – Haz 2024',
  'Lisans, Bilgisayar Mühendisliği',
  'PROJELER',
  'Rota',
  'Kurucu geliştirici',
  'Kampüs Etkinlik Takvimi',
  'Ekip lideri',
]
const SIDE_SECTIONS = [
  'BECERİLER',
  'Diller:',
  'TypeScript, JavaScript, HTML, CSS, SQL',
  'Çatılar:',
  'Araçlar:',
  'DİLLER',
  'Türkçe',
  'Ana dil',
  'İngilizce',
  'İleri (C1)',
  'SERTİFİKALAR',
  'Web Erişilebilirliği Temelleri',
  'Kas 2023',
  'Örnek Akademi',
]

/**
 * DOM (= mantıksal okuma) sırası. Başlık (ad, unvan, iletişim) her düzende tam
 * genişlikte en üsttedir; tek sütunda yan bölümler ana akışın sonundadır.
 */
function expectedOrder(layout: Layout) {
  if (layout.columns === 1) return { header: [...HEADER, ...CONTACT], side: [], main: [...MAIN, ...SIDE_SECTIONS] }
  return { header: [...HEADER, ...CONTACT], side: SIDE_SECTIONS, main: MAIN }
}

/** Kaydedilmiş CV'deki sütun sayısı (geliştirme sunucusundaki veritabanından). */
async function storedColumns(page: Page, id: string) {
  return page.evaluate(async (cvId) => {
    const db = (window as unknown as { __cveditorDb: { cvs: { get: (id: string) => Promise<{ template: { columns: number } } | undefined> } } }).__cveditorDb
    return (await db.cvs.get(cvId))?.template.columns
  }, id)
}

/** Görünüm sekmesinden sütun sayısını değiştirir (canlı önizleme, yeniden yüklemeden). */
async function switchColumns(page: Page, columns: number) {
  const radio = { 1: 'Tek sütun', 2: 'İki sütun' }[columns]
  if (!radio) throw new Error(`${columns} sütun için Görünüm sekmesindeki seçenek adı ats.spec.ts'e eklenmeli`)
  await page.getByRole('radio', { name: 'Görünüm' }).click()
  await page.getByRole('radio', { name: radio, exact: true }).click()
}

async function openSample(page: Page, layout: Layout, patch?: string): Promise<string> {
  const id = await createCv(page, { template: layout.template, start: 'sample' })
  if (patch) {
    await patchCv(page, id, patch)
    await page.reload()
  }
  await page.waitForFunction(() => '__cveditorDb' in window)
  if ((await storedColumns(page, id)) !== layout.columns) {
    await switchColumns(page, layout.columns)
    // Düzen testleri geçiş animasyonundan bağımsız olsun: kaydedilince temiz yükle
    // (geçişin kendisi aşağıda ayrı testte).
    await page.waitForFunction(() => '__cveditorDb' in window)
    await expect.poll(() => storedColumns(page, id)).toBe(layout.columns)
    await page.reload()
  }
  await settledPageCount(page)
  await expect(preview(page).locator('#cv-pages > .page').first().locator('.col-side')).toHaveCount(layout.columns > 1 ? 1 : 0)
  await expect(preview(page).locator('#cv-pages')).toHaveClass(new RegExp(`\\btpl-${layout.id}\\b.*\\bcols-${layout.columns}\\b`))
  return id
}

async function printed(page: Page) {
  const previewPages = await settledPageCount(page)
  const pdf = await renderPreviewPdf(page)
  const pages = await pdfText(pdf)
  return { pdf, pages, previewPages }
}

/** Yan sütun: sayfanın soldaki ~%34'ü (2 sütunda ana sütun metni bunun sağında başlar). */
const inSide = (item: PdfItem, page: PdfPage) => item.x < page.width * 0.34

/**
 * İlk sayfadaki tam genişlik başlığın alt sınırı: sütunların ilk bölüm başlıklarının
 * (ÖZET / BECERİLER) en üstteki satırı. Bunun üstündeki metin başlığa aittir.
 */
function headerBottom(pages: PdfPage[]) {
  const tops = pages[0].items.filter((i) => /^(ÖZET|BECER)/.test(i.str)).map((i) => i.y)
  expect(tops.length, 'ilk sayfada sütun başlığı bulunamadı').toBeGreaterThan(0)
  return Math.max(...tops) + 1.5
}

/**
 * Çizilmiş CV'nin (önizleme iframe'indeki #cv-pages) hesaplanmış stillerini ATS kurallarına
 * göre tarar: harf aralığı ≤ 0.05em, `order` yok, `*-reverse` yok, metin taşıyan öğe
 * `position:absolute/fixed` değil, ::before/::after harf/rakam üretmiyor.
 */
async function styleAudit(page: Page) {
  return preview(page)
    .locator('html')
    .evaluate((html) => {
      const doc = html.ownerDocument
      const win = doc.defaultView!
      const root = doc.getElementById('cv-pages')!
      const describe = (el: Element) =>
        `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join('')} "${(el.textContent ?? '').trim().slice(0, 40)}"`
      const ownText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
      const problems = { letterSpacing: [] as string[], order: [] as string[], reverse: [] as string[], absolute: [] as string[], pseudoText: [] as string[] }
      let textElements = 0
      let maxSpacingEm = -Infinity
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const cs = win.getComputedStyle(el)
        if (ownText(el)) {
          textElements++
          const fontSize = parseFloat(cs.fontSize)
          const spacing = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing)
          const em = spacing / fontSize
          maxSpacingEm = Math.max(maxSpacingEm, em)
          // Hesaplanmış px değeri yuvarlanabilir: 0.05em'e küçük pay.
          if (!(em <= 0.0505)) problems.letterSpacing.push(`${describe(el)}: ${cs.letterSpacing} / ${cs.fontSize} = ${em.toFixed(4)}em`)
        }
        if (cs.order !== '0') problems.order.push(`${describe(el)}: order ${cs.order}`)
        if (/reverse/.test(cs.flexDirection) || /reverse/.test(cs.flexWrap)) {
          problems.reverse.push(`${describe(el)}: ${cs.flexDirection} ${cs.flexWrap}`)
        }
        if ((cs.position === 'absolute' || cs.position === 'fixed') && (el.textContent ?? '').trim()) {
          problems.absolute.push(`${describe(el)}: position ${cs.position}`)
        }
        for (const pseudo of ['::before', '::after']) {
          const content = win.getComputedStyle(el, pseudo).content
          if (content && content !== 'none' && content !== 'normal' && /[\p{L}\p{N}]/u.test(content)) {
            problems.pseudoText.push(`${describe(el)}${pseudo}: ${content}`)
          }
        }
      }
      return { textElements, maxSpacingEm, problems }
    })
}

/**
 * Her önizleme sayfasındaki işaret metinleri DOM sırasıyla (kayıt başlıkları, satır
 * etiketleri, maddeler, bölüm başlıkları) ve sayfanın görünen metni (innerText: CSS büyük
 * harfi uygulanmış, gizli öğeler hariç).
 */
async function previewPagesContent(page: Page) {
  return preview(page)
    .locator('html')
    .evaluate((html) =>
      [...html.ownerDocument.querySelectorAll<HTMLElement>('#cv-pages > .page')].map((p) => ({
        markers: [...p.querySelectorAll<HTMLElement>('.section-title, .entry-title, .line-label, .rich li')]
          .map((el) => el.innerText.replace(/\s+/g, ' ').trim())
          .filter(Boolean),
        text: p.innerText,
        splitParts: p.querySelectorAll('.entry.is-split').length,
        continuedParts: p.querySelectorAll('.entry.is-continued').length,
      })),
    )
}

/**
 * Önizleme = PDF, sayfa sayfa: PDF'in i. sayfasında önizlemenin i. sayfasındaki işaretler
 * aynı sırayla var; hiçbir işaret önizlemede bulunmadığı sayfada PDF'te belirmiyor (ve tersi).
 */
async function expectPagesMatch(page: Page) {
  const previewCount = await settledPageCount(page)
  const content = await previewPagesContent(page)
  expect(content).toHaveLength(previewCount)
  const pdfPages = await pdfText(await renderPreviewPdf(page))
  expect(pdfPages, 'PDF sayfa sayısı önizlemeyle aynı').toHaveLength(content.length)
  const pdfTexts = pdfPages.map((p) => squash(joinItems(p.items)))
  const all = [...new Set(content.flatMap((c) => c.markers.map(squash)))]
  for (const [i, c] of content.entries()) {
    expect(c.markers.length, `önizleme sayfası ${i + 1}'de işaret yok`).toBeGreaterThan(0)
    expect(orderProblem(pdfTexts[i], c.markers.map(squash)), `PDF sayfa ${i + 1}: önizleme sayfasının sırası`).toBeNull()
    const previewText = squash(c.text)
    for (const marker of all) {
      expect(pdfTexts[i].includes(marker), `"${marker}" önizleme sayfası ${i + 1}'de ${previewText.includes(marker) ? 'var' : 'yok'}, PDF'te tersi`).toBe(
        previewText.includes(marker),
      )
    }
  }
  return content
}

/** Örnek CV'ye 8 ek deneyim kaydı (her biri 3 madde): 2-3 sayfa. */
const LONG_CV = `const exp = cv.sections.find((s) => s.type === 'experience');
  const base = exp.items[0];
  for (let i = 1; i <= 8; i++) {
    const n = String(i).padStart(2, '0');
    exp.items.push({
      ...structuredClone(base),
      id: 'ek-kayit-' + n,
      translationGroupId: 'ek-grup-' + n,
      position: 'Ek Görev ' + n,
      company: 'Örnek Şirket ' + n,
      description: '<ul>' + [1, 2, 3].map((k) => '<li>Görev ' + n + ' maddesi ' + k + ' ölçülebilir bir sonucu kısaca anlatır.</li>').join('') + '</ul>',
    });
  }`

const OVERSIZED_BULLETS = Array.from({ length: 70 }, (_, i) => `Madde ${i + 1} sonucu ölçülebilir biçimde anlatır.`)
/** Stajyer kaydı bir sayfadan uzun (70 madde): maddeler arasından bölünür. */
const OVERSIZED_CV = `const exp = cv.sections.find((s) => s.type === 'experience');
  exp.items[1].description = '<ul>' + ${JSON.stringify(OVERSIZED_BULLETS)}.map((b) => '<li>' + b + '</li>').join('') + '</ul>';`

test('ATS matrisi kaynakla eşleşiyor: her şablon × her sütun seçeneği', async ({ page }) => {
  await page.goto('/sablonlar')
  const live = await page.evaluate(async ([templatesUrl, schemaUrl]) => {
    const templates = await import(/* @vite-ignore */ templatesUrl)
    const schema = await import(/* @vite-ignore */ schemaUrl)
    const columns = schema.TemplateSettingsSchema.shape.columns
    return {
      ids: (templates.TEMPLATE_LIST as { id: string }[]).map((t) => t.id),
      columns: Array.from({ length: 10 }, (_, n) => n).filter((n) => columns.safeParse(n).success),
    }
  }, ['/src/render/templates.ts', '/src/cv/schema.ts'])
  expect(live.ids).toEqual(TEMPLATE_IDS)
  expect(live.columns).toEqual(COLUMN_OPTIONS)
  expect(LAYOUTS).toHaveLength(live.ids.length * live.columns.length)
  // Her şablon galeride seçilebilir (matris bu adlarla CV açar).
  for (const layout of LAYOUTS) await expect(page.getByRole('button', { name: `${layout.template} şablonunu seç` })).toBeVisible()
})

for (const layout of LAYOUTS) {
  test.describe(`ATS PDF — ${layout.label}`, () => {
    test('harf aralığı her metin öğesinde ≤ 0.05em', async ({ page }) => {
      // pdf.js/pdfminer ~0.1em üstü harf aralığını kelime boşluğu sayar; kural 0.05em.
      await openSample(page, layout, LONG_CV)
      const { textElements, maxSpacingEm, problems } = await styleAudit(page)
      expect(textElements, 'taranan metin öğesi').toBeGreaterThan(40)
      expect(problems.letterSpacing).toEqual([])
      // Tarama boş değil: bölüm başlıklarının 0.05em'i görülüyor.
      expect(maxSpacingEm).toBeGreaterThan(0)
    })

    test('okuma sırasını bozan stil yok: order, *-reverse, metinde position:absolute, ::before/::after metni', async ({ page }) => {
      await openSample(page, layout, LONG_CV)
      const { problems } = await styleAudit(page)
      expect(problems.order, 'CSS order').toEqual([])
      expect(problems.reverse, 'flex *-reverse').toEqual([])
      expect(problems.absolute, 'metin taşıyan öğede position:absolute/fixed').toEqual([])
      expect(problems.pseudoText, '::before/::after ile üretilen metin').toEqual([])
    })

    test('önizleme = PDF sayfa sayfa: her sayfada aynı kayıtlar aynı sırayla (2-3 sayfalık CV)', async ({ page }) => {
      test.slow() // CV aç + yamala + (gerekirse) sütun değiştir + yeniden yükle + PDF bas
      await openSample(page, layout, LONG_CV)
      const content = await expectPagesMatch(page)
      expect(content.length, 'uzun CV 2-3 sayfa olmalı').toBeGreaterThanOrEqual(2)
      expect(content.length, 'uzun CV 2-3 sayfa olmalı').toBeLessThanOrEqual(3)
      // Kayıtlar sığdığı için hiçbiri bölünmedi; her ek kayıt tek sayfada.
      expect(content.reduce((n, c) => n + c.splitParts, 0)).toBe(0)
      for (let i = 1; i <= 8; i++) {
        const title = `Ek Görev ${String(i).padStart(2, '0')}`
        expect(content.filter((c) => c.markers.includes(title)), `"${title}" tam bir sayfada`).toHaveLength(1)
      }
    })

    test('önizleme = PDF sayfa sayfa: maddeler arasından bölünen uzun kayıt', async ({ page }) => {
      test.slow()
      await openSample(page, layout, OVERSIZED_CV)
      await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
      const content = await expectPagesMatch(page)
      expect(content.length).toBeGreaterThan(1)
      // Kayıt gerçekten bölündü: devam parçası var ve maddeler sayfalara dağıldı.
      expect(content.reduce((n, c) => n + c.continuedParts, 0)).toBeGreaterThan(0)
      const bulletPages = content.map((c) => OVERSIZED_BULLETS.filter((b) => c.markers.includes(b)).length)
      expect(bulletPages.filter((n) => n > 0).length, 'maddeler en az iki sayfada').toBeGreaterThan(1)
      expect(bulletPages.reduce((a, b) => a + b, 0), 'her madde tam bir kez').toBe(OVERSIZED_BULLETS.length)
    })

    test('metin seçilebilir; Türkçe karakterler, tarihler ve pozisyonlar doğru çıkar', async ({ page }) => {
      await openSample(page, layout)
      const { pages, pdf } = await printed(page)
      const text = flowText(pages)
      for (const url of CONTACT.filter((c) => c.includes('/'))) {
        expect(text, `PDF metninde "${url}" yok`).toContain(url)
      }
      // Bağlantılar tam adresle PDF bağlantısı olarak da duruyor.
      const raw = pdf.toString('latin1')
      for (const uri of [
        'mailto:deniz.aksoy@example.com',
        'https://linkedin.com/in/deniz-aksoy-ornek',
        'https://github.com/deniz-aksoy-ornek',
      ]) {
        expect(raw, `PDF bağlantısı "${uri}" yok`).toContain(`/URI (${uri})`)
      }
      for (const needle of [
        ...HEADER,
        ...CONTACT.filter((c) => !c.includes('/')),
        ...POSITIONS.flat(),
        'TypeScript, JavaScript, HTML, CSS, SQL',
        'Erişilebilir ve hızlı web arayüzleri',
        'Ege Üniversitesi',
        'Kampüs Etkinlik Takvimi',
        'Örnek Akademi',
        'Çatılar:',
        'İleri (C1)',
      ]) {
        expect(text, `PDF metninde "${needle}" yok`).toContain(needle)
      }
      // Bölüm başlıkları CSS ile büyük harf: Türkçe büyük İ (noktalı) çıkmalı.
      const titles = ['ÖZET', 'DENEYİM', 'EĞİTİM', 'PROJELER', 'BECERİLER', 'DİLLER', 'SERTİFİKALAR']
      for (const title of titles) expect(squash(text), `başlık "${title}" yok`).toContain(title)
      expect(squash(text)).not.toMatch(/DENEYIM|EĞITIM|BECERILER|DILLER/)
      // Bozuk/eşlemesiz glif, bağ (ligatür) ya da özel kullanım alanı karakteri yok.
      const bad = [...text].filter((c) => {
        const n = c.codePointAt(0)!
        return n === 0xfffd || (n >= 0xfb00 && n <= 0xfb06) || (n >= 0xe000 && n <= 0xf8ff)
      })
      expect(bad, 'eşlemesiz glif / ligatür / özel alan karakteri').toEqual([])
    })

    test('iletişim başlıkta; adresler satıra bölünmeden tek parça çıkar', async ({ page }) => {
      // İletişim her düzende tam genişlik başlıkta (dar yan sütunda "…deniz-aksoy- ornek" diye
      // kırılıyordu); her öğe bölünmez birim, liste yalnız öğeler arasında kırılır.
      await openSample(page, layout)
      const { pages } = await printed(page)
      const text = flowText(pages)
      for (const url of CONTACT.filter((c) => c.includes('/'))) expect(text).toContain(url)
      expect(squash(text)).not.toContain('İLETİŞİM')
      const bottom = headerBottom(pages)
      const header = squash(ySortedText([pages[0]], (item) => item.y > bottom))
      for (const c of CONTACT) expect(header, `"${c}" başlıkta değil`).toContain(squash(c))
    })

    test('bölüm başlıkları harf harf ayrılmadan tek kelime olarak çıkar', async ({ page }) => {
      // pdf.js (ve pdfminer gibi ayrıştırıcılar) ~0.1em'den büyük harf aralığını kelime boşluğu
      // sayar ("D E N E Y İ M"); şablonlarda başlık harf aralığı bu yüzden 0.05em.
      await openSample(page, layout)
      const text = flowText((await printed(page)).pages)
      for (const title of ['ÖZET', 'DENEYİM', 'EĞİTİM', 'PROJELER', 'BECERİLER']) {
        expect(text, `"${title}" bitişik değil`).toMatch(new RegExp(`(^| )${title}( |$)`))
      }
    })

    test('PDF sayfa sayısı önizlemedeki sayfa sayısına eşit', async ({ page }) => {
      await openSample(page, layout)
      const { pages, previewPages } = await printed(page)
      expect(previewPages).toBeGreaterThan(0)
      expect(pages).toHaveLength(previewPages)
      for (const p of pages) expect(p.items.length, 'boş PDF sayfası').toBeGreaterThan(0)
    })

    test('içerik akışı sırası mantıksal okuma sırasını izler', async ({ page }) => {
      await openSample(page, layout)
      const text = squash(flowText((await printed(page)).pages))
      const { header, side, main } = expectedOrder(layout)
      // Başlık en önde; iki sütunda yan sütunun tamamı ana sütundan önce gelir (DOM sırası).
      expect(orderProblem(text, [...header, ...side, ...main].map(squash))).toBeNull()
    })

    test('y\'ye göre sıralı okuma her sütunda doğru', async ({ page }) => {
      await openSample(page, layout)
      const { pages } = await printed(page)
      const { header, side, main } = expectedOrder(layout)
      if (layout.columns === 1) {
        expect(orderProblem(squash(ySortedText(pages, () => true)), [...header, ...main].map(squash))).toBeNull()
        return
      }
      // Tam genişlik başlık (ilk sayfanın üstü) ayrı okunur; altında iki sütun.
      const bottom = headerBottom(pages)
      const inHeader = (item: PdfItem, p: PdfPage) => p === pages[0] && item.y > bottom
      const headerText = squash(ySortedText(pages, inHeader))
      const sideText = squash(ySortedText(pages, (i, p) => !inHeader(i, p) && inSide(i, p)))
      const mainText = squash(ySortedText(pages, (i, p) => !inHeader(i, p) && !inSide(i, p)))
      expect(orderProblem(headerText, header.map(squash))).toBeNull()
      expect(orderProblem(sideText, side.map(squash))).toBeNull()
      expect(orderProblem(mainText, main.map(squash))).toBeNull()
      // Sütunlar birbirine karışmıyor: ana sütun metni yan sütunda yok (ve tersi).
      for (const needle of ['DENEYİM', 'YazılımStajyeri', 'EgeÜniversitesi']) expect(sideText).not.toContain(needle)
      for (const needle of ['BECERİLER', 'ÖrnekAkademi']) expect(mainText).not.toContain(needle)
      // İletişim yalnız başlıkta; sütunlara düşmüyor.
      for (const needle of ['deniz.aksoy@example.com', 'linkedin.com']) {
        expect(sideText).not.toContain(needle)
        expect(mainText).not.toContain(needle)
      }
    })

    test('yazı tipleri PDF içinde; hiçbiri gömülmeden anılmıyor ve hepsinde ToUnicode var', async ({ page }) => {
      await openSample(page, layout)
      const report = fontReport((await printed(page)).pdf)
      expect(report.subtypes.length).toBeGreaterThan(0)
      expect(report.notEmbedded, `gömülü olmayan yazı tipi: ${report.subtypes.join(', ')}`).toBe(0)
      expect(report.withoutToUnicode, 'ToUnicode eşlemesi olmayan yazı tipi').toBe(0)
    })

    test('yazı tipleri gerçek TrueType/CFF programı olarak gömülü (Type3 değil)', async ({ page }) => {
      // Chromium/Skia değişken (wght) yazı tiplerini PDF'e Type3 (glif başına çizim) olarak basar;
      // bu yüzden public/fonts ağırlık başına statik woff2 içerir (scripts/copy-fonts.mjs).
      await openSample(page, layout)
      const report = fontReport((await printed(page)).pdf)
      expect(report.type3, `Type3 yazı tipi sayısı (alt türler: ${report.subtypes.join(', ')})`).toBe(0)
      expect(report.fontFiles).toBeGreaterThan(0)
    })
  })
}

test('sütun değiştirdikten hemen sonra alınan PDF önizlemeyle aynı (geçiş kopyası kalmaz)', async ({ page }) => {
  // CvFrame şablon geçişinde eski sayfaların kopyasını (#cv-ghost, gölge DOM) koyar ve solunca
  // kaldırır. İframe betiksiz sandbox: zamanlayıcı üst pencereden kurulmazsa hiç çalışmaz, kopya
  // belgede kalır ve yazdırınca eski düzenin yüksekliği kadar boş sayfa eklenir.
  const id = await createCv(page, { template: 'Klasik', start: 'sample' })
  const before = await settledPageCount(page)
  await switchColumns(page, 2)
  await expect.poll(() => storedColumns(page, id)).toBe(2)
  await page.waitForTimeout(1000) // geçiş animasyonu (~260 ms) çoktan bitmiş olmalı
  const { pages, previewPages } = await printed(page)
  expect(previewPages).toBeLessThanOrEqual(before)
  expect(pages).toHaveLength(previewPages)
  expect(flowText(pages).split('Deniz Aksoy').length - 1).toBe(1)
  expect(await preview(page).locator('html').evaluate((html) => !!html.ownerDocument.getElementById('cv-ghost'))).toBe(false)
})

for (const template of ['Klasik', 'Modern'] as const) {
  test(`${template}: bir sayfadan uzun kayıt PDF'te sayfa sınırında metin kaybetmez/çoğaltmaz`, async ({ page }) => {
    const id = await createCv(page, { template, start: 'sample' })
    await patchCv(
      page,
      id,
      `const exp = cv.sections.find((s) => s.type === 'experience');
       exp.items[1].description = '<ul>' + Array.from({ length: 70 }, (_, i) => '<li>Madde ' + (i + 1) + ' sonucu ölçülebilir biçimde anlatır.</li>').join('') + '</ul>';`,
    )
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('1 kayıt bir sayfadan uzun')
    const { pages, previewPages } = await printed(page)
    expect(previewPages).toBeGreaterThan(1)
    expect(pages).toHaveLength(previewPages)
    const text = flowText(pages)
    const bullets = Array.from({ length: 70 }, (_, i) => `Madde ${i + 1} sonucu ölçülebilir biçimde anlatır.`)
    for (const bullet of bullets) {
      expect(text.split(bullet).length - 1, `"${bullet}" PDF'te tam bir kez olmalı`).toBe(1)
    }
    // Maddeler sayfalar boyunca sırayla akar; bölünen kaydın başlığı tek kez yazılır.
    expect(orderProblem(text, bullets)).toBeNull()
    expect(text.split('Yazılım Stajyeri').length - 1).toBe(1)
    expect(orderProblem(squash(text), ['Yazılım Stajyeri', 'Madde 1 sonucu', 'Madde 70 sonucu', 'Serbest Web Geliştirici'].map(squash))).toBeNull()
  })
}
