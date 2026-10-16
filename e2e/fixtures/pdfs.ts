import { readFileSync } from 'node:fs'
import type { Browser } from '@playwright/test'

/**
 * İçe aktarma testlerinin PDF'leri: depoya ikili dosya koymak yerine
 * uydurma CV'lerin HTML'inden Chromium ile o anda basılır.
 * - cv-tr.html: Türkçe, tek sütun, tarih unvanla aynı satırda
 * - cv-en.html: İngilizce, iki sütun (yan sütun önce), tarih ayrı satırda
 * - imageOnlyPdf: metni görsel olarak basılmış PDF (metin katmanı yok)
 */
const fixture = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')

async function printHtml(browser: Browser, html: string): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({ preferCSSPageSize: true, printBackground: true })
  } finally {
    await page.close()
  }
}

export const trCvPdf = (browser: Browser) => printHtml(browser, fixture('cv-tr.html'))
export const enCvPdf = (browser: Browser) => printHtml(browser, fixture('cv-en.html'))

/** Canva'da "görsel olarak" kaydedilmiş CV gibi: yazı tuvale çizilir, PDF'e resim olarak girer. */
export async function imageOnlyPdf(browser: Browser): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setContent('<!doctype html><body style="margin:0"><img id="cv" style="width:100%"></body>')
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1240
      canvas.height = 600
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#111'
      ctx.font = 'bold 64px Arial'
      ctx.fillText('Görsel Kişi', 80, 140)
      ctx.font = '32px Arial'
      ctx.fillText('DENEYİM  ·  Örnek Şirket  ·  2020 – 2024', 80, 240)
      const img = document.getElementById('cv') as HTMLImageElement
      img.src = canvas.toDataURL('image/png')
      await img.decode()
    })
    return await page.pdf({ format: 'A4', printBackground: true })
  } finally {
    await page.close()
  }
}

/** PDF olmayan dosya (uzantısı .pdf olsa bile) */
export const fakePdf = () => Buffer.from('Bu bir PDF değil, düz metin.', 'utf8')
