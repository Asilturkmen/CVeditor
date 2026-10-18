import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { TEMPLATE_META } from '../src/render/templateMeta.ts'
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
  /** Şablonun kimliği (src/render/templateMeta.ts) */
  id: string
  /** Arayüzdeki (Türkçe) adı; şablon seçme düğmesi bununla bulunur */
  template: string
  columns: number
  /** Fotoğraf yüklü mü. Değilse editörde fotoğraf yerinde "Fotoğraf ekle" kutusu durur (PDF'e girmez). */
  photo: boolean
}

/*
 * Matris = her şablon × o şablonun desteklediği her sütun sayısı × fotoğraflı/fotoğrafsız.
 * Kayıt doğrudan kaynaktan okunur: templateMeta.ts bilerek hiçbir şey içe aktarmaz, Node'da
 * olduğu gibi yüklenir (ayrıştırıcı yok). Tarayıcıdaki gerçek modüllerle de karşılaştırılır
 * ("matris kaynakla eşleşiyor"). Süre için her düzende denetimler üç teste toplanır; her test
 * bir CV açar ve tek PDF basar.
 */
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const TR_MESSAGES = JSON.parse(source('messages/tr.json')) as Record<string, string>
const COLUMN_LABEL: Record<number, string> = { 1: 'tek sütun', 2: 'iki sütun' }
const PHOTO_HINT = TR_MESSAGES.preview_photo_hint

const LAYOUTS: Layout[] = TEMPLATE_META.flatMap((meta) => {
  const template = TR_MESSAGES[`template_${meta.id}_name`]
  if (!template) throw new Error(`messages/tr.json içinde template_${meta.id}_name yok`)
  return meta.columns.flatMap((columns) =>
    [false, true].map((photo) => ({
      label: `${template} ${COLUMN_LABEL[columns] ?? `${columns} sütun`}, ${photo ? 'fotoğraflı' : 'fotoğrafsız'}`,
      id: meta.id,
      template,
      columns,
      photo,
    })),
  )
})

/** 1×1 PNG; fotoğraf yerinin boyutuna `object-fit: cover` ile yayılır. */
const PHOTO_PATCH = `cv.personal.photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+v9/PQAJZAPPJCkVjgAAAABJRU5ErkJggg=='; cv.template.showPhoto = true;`

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
function expectedOrder(layout: Layout, T: Titles, header: string[]) {
  const main = MAIN.map(T)
  const side = SIDE_SECTIONS.map(T)
  if (layout.columns === 1) return { header: [...header, ...CONTACT], side: [], main: [...main, ...side] }
  return { header: [...header, ...CONTACT], side, main }
}

/**
 * Ad ve unvan önizlemede göründüğü hâliyle (HEADER sırasıyla); şablon CSS ile büyük harf
 * yazabilir ('FRONTEND GELİŞTİRİCİ'), PDF metnine de öyle geçer. ATS için büyük harf sorun değil.
 */
async function renderedHeader(page: Page): Promise<string[]> {
  const shown = await preview(page)
    .locator('html')
    .evaluate((html) =>
      ['.cv-name', '.cv-headline'].map((sel) => {
        const el = html.ownerDocument.querySelector<HTMLElement>(`#cv-pages ${sel}`)
        return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
      }),
    )
  return HEADER.map((h, i) => (shown[i]?.toLocaleUpperCase('tr') === h.toLocaleUpperCase('tr') ? shown[i] : h))
}

/** Büyük harfli başlık adı ('DENEYİM') → önizlemede görünen hâli; şablon büyük harf kullanmayabilir ('Deneyim'). */
type Titles = (title: string) => string

async function renderedTitles(page: Page): Promise<Titles> {
  const rendered = await preview(page)
    .locator('html')
    .evaluate((html) =>
      [...html.ownerDocument.querySelectorAll<HTMLElement>('#cv-pages .section-title')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
    )
  const map = new Map(rendered.map((r) => [r.toLocaleUpperCase('tr'), r]))
  return (title) => map.get(title) ?? title
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

async function openSample(page: Page, layout: Layout, extraPatch?: string): Promise<string> {
  const id = await createCv(page, { template: layout.template, start: 'sample' })
  const patch = [layout.photo ? PHOTO_PATCH : '', extraPatch ?? ''].filter(Boolean).join('\n')
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
  // Fotoğraf yeri: yüklüyse gerçek fotoğraf, değilse editördeki kesikli kutu.
  const header = preview(page).locator('#cv-pages .cv-header')
  if (layout.photo) await expect(header.locator('img.cv-photo')).toHaveCount(1)
  else await expect(header.locator('.ph-photo')).toHaveText(PHOTO_HINT)
  return id
}

async function printed(page: Page) {
  const previewPages = await settledPageCount(page)
  const pdf = await renderPreviewPdf(page)
  const pages = await pdfText(pdf)
  return { pdf, pages, previewPages }
}

/** Ana sütunun sol kenarı, sayfa genişliğine oranla (yan sütun genişliği şablona göre değişir). */
async function mainColumnStart(page: Page): Promise<number> {
  return preview(page)
    .locator('#cv-pages > .page')
    .first()
    .evaluate((p) => (p.querySelector('.col-main')!.getBoundingClientRect().left - p.getBoundingClientRect().left) / p.getBoundingClientRect().width)
}

/**
 * İlk sayfadaki tam genişlik başlığın alt sınırı: sütunların ilk bölüm başlıklarının
 * (ÖZET / BECERİLER) en üstteki satırı. Bunun üstündeki metin başlığa aittir.
 */
function headerBottom(pages: PdfPage[], T: Titles) {
  const starts = [T('ÖZET'), T('BECERİLER')].map((t) => t.slice(0, 4))
  const tops = pages[0].items.filter((i) => starts.some((s) => i.str.startsWith(s))).map((i) => i.y)
  expect(tops.length, 'ilk sayfada sütun başlığı bulunamadı').toBeGreaterThan(0)
  return Math.max(...tops) + 1.5
}

/**
 * Çizilmiş CV'nin (önizleme iframe'indeki #cv-pages) hesaplanmış stillerini ATS kurallarına
 * göre tarar: harf aralığı ≤ 0.05em, `order` yok, `*-reverse` yok, metin taşıyan öğe
 * `position` (relative dahil) değil, ::before/::after harf/rakam üretmiyor, metin taşıyan öğe
 * kendi boyama katmanını açmıyor (opacity < 1, transform, filter, z-index, mix-blend-mode,
 * isolation, will-change). Chromium bu katmanları PDF'e sayfanın geri kalanından ayrı (sonra)
 * basar: içerik akışında metin yerinden kayar, opacity/filter'da metin vektör yerine resim
 * olarak basılıp hiç çıkmayabilir. Metinsiz süs ve fotoğraf (`img`) serbest; `.page` hariç.
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
      const problems = {
        letterSpacing: [] as string[],
        order: [] as string[],
        reverse: [] as string[],
        absolute: [] as string[],
        pseudoText: [] as string[],
        layer: [] as string[],
      }
      let textElements = 0
      let maxSpacingEm = -Infinity
      // En büyük mutlak harf aralığı: ölçümün gerçekten yapıldığının kanıtı (her şablonun adında
      // eksi ya da artı harf aralığı var; hep 0 okunuyorsa ölçüm bozuk demektir).
      let maxAbsSpacingEm = 0
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const cs = win.getComputedStyle(el)
        if (ownText(el)) {
          textElements++
          const fontSize = parseFloat(cs.fontSize)
          const spacing = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing)
          const em = spacing / fontSize
          maxSpacingEm = Math.max(maxSpacingEm, em)
          if (Number.isFinite(em)) maxAbsSpacingEm = Math.max(maxAbsSpacingEm, Math.abs(em))
          // Hesaplanmış px değeri yuvarlanabilir: 0.05em'e küçük pay.
          if (!(em <= 0.0505)) problems.letterSpacing.push(`${describe(el)}: ${cs.letterSpacing} / ${cs.fontSize} = ${em.toFixed(4)}em`)
        }
        if (cs.order !== '0') problems.order.push(`${describe(el)}: order ${cs.order}`)
        if (/reverse/.test(cs.flexDirection) || /reverse/.test(cs.flexWrap)) {
          problems.reverse.push(`${describe(el)}: ${cs.flexDirection} ${cs.flexWrap}`)
        }
        // Konumlu (relative dahil) öğeler PDF'e sayfanın geri kalanından sonra çizilir; içerik akışında
        // sona düşerler. Yalnız `.page` (bütün sayfa) konumlu olabilir; süsler metinsiz ::before/::after.
        const carriesText = !el.classList.contains('page') && el.tagName !== 'IMG' && !!(el.textContent ?? '').trim()
        if (cs.position !== 'static' && carriesText) {
          problems.absolute.push(`${describe(el)}: position ${cs.position}`)
        }
        if (carriesText) {
          const layer = [
            parseFloat(cs.opacity) < 1 && `opacity ${cs.opacity}`,
            cs.transform !== 'none' && `transform ${cs.transform}`,
            cs.filter !== 'none' && `filter ${cs.filter}`,
            cs.zIndex !== 'auto' && `z-index ${cs.zIndex}`,
            cs.mixBlendMode !== 'normal' && `mix-blend-mode ${cs.mixBlendMode}`,
            cs.isolation === 'isolate' && 'isolation isolate',
            /transform|opacity|filter/.test(cs.willChange) && `will-change ${cs.willChange}`,
          ].filter(Boolean)
          if (layer.length) problems.layer.push(`${describe(el)}: ${layer.join(', ')}`)
        }
        for (const pseudo of ['::before', '::after']) {
          const content = win.getComputedStyle(el, pseudo).content
          if (content && content !== 'none' && content !== 'normal' && /[\p{L}\p{N}]/u.test(content)) {
            problems.pseudoText.push(`${describe(el)}${pseudo}: ${content}`)
          }
        }
      }
      return { textElements, maxSpacingEm, maxAbsSpacingEm, problems }
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

test('ATS matrisi kaynakla eşleşiyor: her şablon × desteklediği sütunlar × fotoğraflı/fotoğrafsız', async ({ page }) => {
  await page.goto('/sablonlar')
  const live = await page.evaluate(async ([templatesUrl, schemaUrl]) => {
    const templates = await import(/* @vite-ignore */ templatesUrl)
    const schema = await import(/* @vite-ignore */ schemaUrl)
    const columns = schema.TemplateSettingsSchema.shape.columns
    return {
      templates: (templates.TEMPLATE_LIST as { id: string; columns: number[] }[]).map((t) => ({ id: t.id, columns: [...t.columns] })),
      schemaColumns: Array.from({ length: 10 }, (_, n) => n).filter((n) => columns.safeParse(n).success),
    }
  }, ['/src/render/templates.ts', '/src/cv/schema.ts'])
  expect(live.templates).toEqual(TEMPLATE_META.map((t) => ({ id: t.id, columns: [...t.columns] })))
  // Şablonların sütun seçenekleri şemanın izin verdikleri arasında.
  for (const t of live.templates) for (const c of t.columns) expect(live.schemaColumns).toContain(c)
  expect(LAYOUTS).toHaveLength(live.templates.reduce((n, t) => n + t.columns.length * 2, 0))
  // Her şablon galeride seçilebilir (matris bu adlarla CV açar).
  for (const layout of LAYOUTS) await expect(page.getByRole('button', { name: `${layout.template} şablonunu seç` })).toBeVisible()
})

for (const layout of LAYOUTS) {
  test.describe(`ATS PDF — ${layout.label}`, () => {
    test('uzun CV: okuma sırasını bozan stil yok, harf aralığı ≤ 0.05em, önizleme = PDF sayfa sayfa (2-3 sayfa)', async ({ page }) => {
      test.slow() // CV aç + yamala + (gerekirse) sütun değiştir + yeniden yükle + PDF bas
      await openSample(page, layout, LONG_CV)

      // pdf.js/pdfminer ~0.1em üstü harf aralığını kelime boşluğu sayar; kural 0.05em.
      const { textElements, maxSpacingEm, maxAbsSpacingEm, problems } = await styleAudit(page)
      expect(textElements, 'taranan metin öğesi').toBeGreaterThan(40)
      // Harf aralığı gerçekten ölçüldü: sayı okundu ve en az bir öğede 0 değil (adın harf aralığı).
      expect(Number.isFinite(maxSpacingEm), `en büyük harf aralığı ${maxSpacingEm}`).toBe(true)
      expect(maxAbsSpacingEm, 'ölçülen harf aralığı (mutlak, em)').toBeGreaterThan(0)
      expect(problems.letterSpacing).toEqual([])
      expect(problems.order, 'CSS order').toEqual([])
      expect(problems.reverse, 'flex *-reverse').toEqual([])
      expect(problems.absolute, 'metin taşıyan öğede position (relative dahil)').toEqual([])
      expect(problems.pseudoText, '::before/::after ile üretilen metin').toEqual([])
      expect(problems.layer, 'metin taşıyan öğede opacity/transform/filter/z-index/blend/isolation/will-change').toEqual([])

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

    if (!layout.photo) {
      // Fotoğrafsız hâl en zor durum: ekranda fotoğraf kutusu yer kaplar, baskıda kaplamaz.
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
    }

    test('örnek CV: metin, Türkçe karakter, bağlantı, iletişim başlıkta, okuma sırası, sayfa sayısı, gömülü yazı tipleri', async ({ page }) => {
      test.slow()
      await openSample(page, layout)
      const mainStart = await mainColumnStart(page)
      const T = await renderedTitles(page)
      const shownHeader = await renderedHeader(page)
      const { pages, pdf, previewPages } = await printed(page)
      const text = flowText(pages)

      // Fotoğraf yer tutucusu PDF'e girmez.
      expect(text).not.toContain(PHOTO_HINT)
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
        ...shownHeader,
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
      // Bölüm başlıkları önizlemede göründüğü gibi; CSS ile büyük harfse Türkçe büyük İ (noktalı) çıkmalı.
      const titles = ['ÖZET', 'DENEYİM', 'EĞİTİM', 'PROJELER', 'BECERİLER', 'DİLLER', 'SERTİFİKALAR'].map(T)
      for (const title of titles) expect(squash(text), `başlık "${title}" yok`).toContain(squash(title))
      expect(squash(text)).not.toMatch(/DENEYIM|EĞITIM|BECERILER|DILLER/)
      // Bozuk/eşlemesiz glif, bağ (ligatür) ya da özel kullanım alanı karakteri yok.
      const bad = [...text].filter((c) => {
        const n = c.codePointAt(0)!
        return n === 0xfffd || (n >= 0xfb00 && n <= 0xfb06) || (n >= 0xe000 && n <= 0xf8ff)
      })
      expect(bad, 'eşlemesiz glif / ligatür / özel alan karakteri').toEqual([])

      // İletişim her düzende tam genişlik başlıkta (dar yan sütunda "…deniz-aksoy- ornek" diye
      // kırılıyordu); her öğe bölünmez birim, liste yalnız öğeler arasında kırılır.
      expect(squash(text)).not.toContain('İLETİŞİM')
      const bottom = headerBottom(pages, T)
      const headerOnly = squash(ySortedText([pages[0]], (item) => item.y > bottom))
      for (const c of CONTACT) expect(headerOnly, `"${c}" başlıkta değil`).toContain(squash(c))

      // pdf.js (ve pdfminer gibi ayrıştırıcılar) ~0.1em'den büyük harf aralığını kelime boşluğu
      // sayar ("D E N E Y İ M"); şablonlarda başlık harf aralığı bu yüzden 0.05em.
      for (const title of ['ÖZET', 'DENEYİM', 'EĞİTİM', 'PROJELER', 'BECERİLER'].map(T)) {
        expect(text, `"${title}" bitişik değil`).toMatch(new RegExp(`(^| )${title}( |$)`))
      }

      // PDF sayfa sayısı önizlemedekine eşit, boş sayfa yok.
      expect(previewPages).toBeGreaterThan(0)
      expect(pages).toHaveLength(previewPages)
      for (const p of pages) expect(p.items.length, 'boş PDF sayfası').toBeGreaterThan(0)

      // İçerik akışı: başlık en önde; iki sütunda yan sütunun tamamı ana sütundan önce (DOM sırası).
      const { header, side, main } = expectedOrder(layout, T, shownHeader)
      expect(orderProblem(squash(text), [...header, ...side, ...main].map(squash))).toBeNull()

      // y'ye göre sıralı okuma her sütunda doğru.
      if (layout.columns === 1) {
        expect(orderProblem(squash(ySortedText(pages, () => true)), [...header, ...main].map(squash))).toBeNull()
      } else {
        // Tam genişlik başlık (ilk sayfanın üstü) ayrı okunur; altında iki sütun.
        const inHeader = (item: PdfItem, p: PdfPage) => p === pages[0] && item.y > bottom
        const inSide = (item: PdfItem, p: PdfPage) => item.x < p.width * mainStart
        const headerText = squash(ySortedText(pages, inHeader))
        const sideText = squash(ySortedText(pages, (i, p) => !inHeader(i, p) && inSide(i, p)))
        const mainText = squash(ySortedText(pages, (i, p) => !inHeader(i, p) && !inSide(i, p)))
        expect(orderProblem(headerText, header.map(squash))).toBeNull()
        expect(orderProblem(sideText, side.map(squash))).toBeNull()
        expect(orderProblem(mainText, main.map(squash))).toBeNull()
        // Sütunlar birbirine karışmıyor: ana sütun metni yan sütunda yok (ve tersi).
        for (const needle of [squash(T('DENEYİM')), 'YazılımStajyeri', 'EgeÜniversitesi']) expect(sideText).not.toContain(needle)
        for (const needle of [squash(T('BECERİLER')), 'ÖrnekAkademi']) expect(mainText).not.toContain(needle)
        // İletişim yalnız başlıkta; sütunlara düşmüyor.
        for (const needle of ['deniz.aksoy@example.com', 'linkedin.com']) {
          expect(sideText).not.toContain(needle)
          expect(mainText).not.toContain(needle)
        }
      }

      // Yazı tipleri gömülü, ToUnicode'lu ve gerçek TrueType/CFF (Type3 değil): Chromium/Skia
      // değişken (wght) yazı tiplerini Type3 basar; public/fonts statik woff2 içerir (copy-fonts.mjs).
      const report = fontReport(pdf)
      expect(report.subtypes.length).toBeGreaterThan(0)
      expect(report.notEmbedded, `gömülü olmayan yazı tipi: ${report.subtypes.join(', ')}`).toBe(0)
      expect(report.withoutToUnicode, 'ToUnicode eşlemesi olmayan yazı tipi').toBe(0)
      expect(report.type3, `Type3 yazı tipi sayısı (alt türler: ${report.subtypes.join(', ')})`).toBe(0)
      expect(report.fontFiles).toBeGreaterThan(0)
    })
  })
}

test('sütun değiştirdikten hemen sonra alınan PDF önizlemeyle aynı (geçiş kopyası kalmaz)', async ({ page }) => {
  // CvFrame şablon geçişinde eski sayfaların kopyasını (#cv-ghost, gölge DOM) koyar ve solunca
  // kaldırır. İframe betiksiz sandbox: zamanlayıcı üst pencereden kurulmazsa hiç çalışmaz, kopya
  // belgede kalır ve yazdırınca eski düzenin yüksekliği kadar boş sayfa eklenir.
  const id = await createCv(page, { template: 'Bant', start: 'sample' })
  await switchColumns(page, 1)
  await expect.poll(() => storedColumns(page, id)).toBe(1)
  await page.waitForTimeout(1000)
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

for (const template of ['Zarif', 'Panel'] as const) {
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
