import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { TEMPLATE_META } from '../src/render/templateMeta.ts'
import { createCv, patchCv, preview } from './helpers.ts'
import { flowText, pdfText, renderPreviewPdf, settledPageCount } from './pdf.ts'

/**
 * Zorlayıcı CV, her şablonda (varsayılan sütun düzeni, fotoğraflı): uzun ve Türkçe karakterli ad,
 * uzun e-posta ve LinkedIn, virgülsüz (noktalı virgüllü) uzun beceri değeri. Denetlenen:
 * - hiçbir metin sayfanın ya da kendi sütununun (başlıkta başlığın) dışına taşmıyor,
 * - adın hiçbir kelimesi önizlemede satır ortasından bölünmüyor; PDF metninde ad aynen var,
 * - e-posta ve LinkedIn PDF metninde bölünmeden, beceri değeri tamamıyla var.
 * İki tur: 2 kelimelik ad (normal boy) ve 4 kelimelik 30+ karakterlik ad (büyük yazı, geniş boşluk).
 */

const TR = JSON.parse(readFileSync(new URL('../messages/tr.json', import.meta.url), 'utf8')) as Record<string, string>
const PHOTO = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+v9/PQAJZAPPJCkVjgAAAABJRU5ErkJggg==`
const EMAIL = 'abdurrahman.kahramanoglu@example.com'
const LINKEDIN = 'linkedin.com/in/abdurrahman-kahramanoglu-4b7a1c'
const SKILLS = 'TypeScript; JavaScript; React; Node.js; Express; PostgreSQL; Docker; Kubernetes; Terraform; Grafana; Prometheus; RabbitMQ; Elasticsearch'

interface Round {
  name: string
  fontSize: 'sm' | 'md' | 'lg'
  spacing: 'compact' | 'normal' | 'relaxed'
}
const ROUNDS: Round[] = [
  { name: 'Abdurrahman Kahramanoğlu', fontSize: 'md', spacing: 'normal' },
  { name: 'Ayşegül Nur Karamustafaoğlu Öztürk', fontSize: 'lg', spacing: 'relaxed' },
]

function patchFor(round: Round, align?: 'left' | 'center') {
  return `cv.personal.fullName = ${JSON.stringify(round.name)};
    cv.personal.email = ${JSON.stringify(EMAIL)};
    cv.personal.linkedin = ${JSON.stringify(LINKEDIN)};
    cv.personal.photo = ${JSON.stringify(PHOTO)};
    cv.template.showPhoto = true;
    cv.template.fontSize = ${JSON.stringify(round.fontSize)};
    cv.template.spacing = ${JSON.stringify(round.spacing)};
    ${align ? `cv.template.headerAlign = ${JSON.stringify(align)};` : ''}
    cv.sections.find((s) => s.type === 'skills').items[0].keywords = ${JSON.stringify(SKILLS)};`
}

/** Önizlemedeki taşmalar ve adın satırlara dağılımı (harf harf, satırın üst kenarına göre). */
async function layoutReport(page: Page) {
  return preview(page)
    .locator('html')
    .evaluate((html) => {
      const doc = html.ownerDocument
      const overflow: string[] = []
      const TOL = 1.5 // px: italik/eksi harf aralığı taşması
      for (const pageEl of doc.querySelectorAll<HTMLElement>('#cv-pages > .page')) {
        const pageRect = pageEl.getBoundingClientRect()
        const walker = doc.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? ''
          if (!text.trim()) continue
          const parent = node.parentElement!
          const box = (parent.closest('.col') ?? parent.closest('.cv-header') ?? pageEl).getBoundingClientRect()
          const range = doc.createRange()
          range.selectNodeContents(node)
          for (const r of range.getClientRects()) {
            if (r.width === 0) continue
            const outPage = r.left < pageRect.left - TOL || r.right > pageRect.right + TOL || r.bottom > pageRect.bottom + TOL
            const outBox = r.left < box.left - TOL || r.right > box.right + TOL
            if (outPage || outBox) {
              overflow.push(`"${text.trim().slice(0, 40)}" (${parent.className || parent.tagName}): ${outPage ? 'sayfa' : 'sütun'} dışında`)
              break
            }
          }
        }
      }
      // Adın her harfinin satırı: kelime ortasında satır değişirse kelime bölünmüş demektir.
      const nameNode = doc.querySelector('#cv-pages .cv-name-text')!.firstChild!
      const name = nameNode.textContent ?? ''
      const range = doc.createRange()
      const lines: string[] = []
      let lastTop = Number.NaN
      for (let i = 0; i < name.length; i++) {
        range.setStart(nameNode, i)
        range.setEnd(nameNode, i + 1)
        const rect = range.getClientRects()[0]
        if (!rect) continue
        if (!(Math.abs(rect.top - lastTop) <= 2)) {
          lines.push('')
          lastTop = rect.top
        }
        lines[lines.length - 1] += name[i]
      }
      const nameEl = doc.querySelector<HTMLElement>('#cv-pages .cv-name')!
      return { overflow, nameLines: lines.map((l) => l.trim()).filter(Boolean), nameFontPx: parseFloat(getComputedStyle(nameEl).fontSize) }
    })
}

async function checkRound(page: Page, label: string, round: Round) {
  await settledPageCount(page)
  const report = await layoutReport(page)
  expect(report.overflow, `${label}: taşan metin`).toEqual([])
  // Her satır yalnız tam kelimelerden oluşur.
  const words = round.name.split(' ')
  for (const line of report.nameLines) {
    for (const part of line.split(/\s+/)) expect(words, `${label}: ad satırı "${line}" kelime ortasından bölünmüş (${report.nameLines.join(' | ')})`).toContain(part)
  }
  expect(report.nameLines.join(' ')).toBe(round.name)

  const text = flowText(await pdfText(await renderPreviewPdf(page)))
  // Şablon adı CSS ile büyük harf yazabilir (Afiş, Gece); PDF'e de öyle geçer.
  const shown = [round.name, round.name.toLocaleUpperCase('tr')]
  expect(
    shown.some((n) => text.includes(n)),
    `${label}: PDF'te ad bölünmeden yok; PDF başı: "${text.slice(0, 80)}"`,
  ).toBe(true)
  for (const needle of [EMAIL, LINKEDIN, SKILLS]) expect(text, `${label}: PDF'te "${needle}" bölünmeden yok`).toContain(needle)
  return report
}

for (const meta of TEMPLATE_META) {
  const template = TR[`template_${meta.id}_name`]
  test(`zorlayıcı CV — ${template}: uzun ad, uzun iletişim, virgülsüz beceri; taşma ve bölünme yok`, async ({ page }) => {
    test.slow()
    const id = await createCv(page, { template, start: 'sample' })
    for (const round of ROUNDS) {
      await patchCv(page, id, patchFor(round))
      await page.reload()
      await expect(preview(page).locator('#cv-pages')).toHaveClass(new RegExp(`\\btpl-${meta.id}\\b.*\\bcols-${meta.columns[0]}\\b`))
      await expect(preview(page).locator('#cv-pages .cv-header img.cv-photo')).toHaveCount(1)
      await checkRound(page, `${template} "${round.name}" ${round.fontSize}/${round.spacing}`, round)
    }
  })
}

// Başlığın öbür hizası: ortalamayı özel ele alan şablonlar (Zarif varsayılanı ortalı; sola alınır).
for (const [id, align] of [
  ['isvicre', 'center'],
  ['cizelge', 'center'],
  ['zarif', 'left'],
] as const) {
  const template = TR[`template_${id}_name`]
  test(`zorlayıcı CV — ${template}, başlık ${align === 'center' ? 'ortalı' : 'sola yaslı'}`, async ({ page }) => {
    test.slow()
    const cvId = await createCv(page, { template, start: 'sample' })
    const round = ROUNDS[1]
    await patchCv(page, cvId, patchFor(round, align))
    await page.reload()
    await expect(preview(page).locator('#cv-pages')).toHaveClass(new RegExp(`\\balign-${align}\\b`))
    await checkRound(page, `${template} ${align}`, round)
  })
}
