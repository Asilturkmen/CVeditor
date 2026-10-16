import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Browser } from '@playwright/test'

/**
 * İçe aktarma testlerinin PDF'leri: depoya ikili dosya koymak yerine
 * uydurma CV'lerin HTML'inden Chromium ile o anda basılır.
 * - cv-tr.html: Türkçe, tek sütun, tarih unvanla aynı satırda
 * - cv-en.html: İngilizce, iki sütun (yan sütun önce), tarih ayrı satırda
 * - imageOnlyPdf: metni görsel olarak basılmış PDF (metin katmanı yok)
 * - encryptedPdf: kullanıcı parolalı PDF (elle kurulur; Chromium parolalı basamaz)
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

// ---------------------------------------------------------------- Parolalı PDF

/** PDF standart güvenlik işleyicisinin dolgu dizisi (PDF 1.7, 7.6.3.3) */
const PASSWORD_PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex')

const md5 = (...parts: Buffer[]) => createHash('md5').update(Buffer.concat(parts)).digest()
const padPassword = (password: string) => Buffer.concat([Buffer.from(password, 'latin1'), PASSWORD_PAD]).subarray(0, 32)

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = Buffer.alloc(data.length)
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255
    j = (j + s[i]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255]
  }
  return out
}

/**
 * Kullanıcı parolalı (açmak için parola isteyen) tek sayfalık PDF: standart
 * güvenlik işleyicisi, RC4 40 bit (V1 R2). Chromium parolalı PDF basamadığı
 * için PDF elle kurulur; içerik akışı da parolayla şifrelenir.
 */
export function encryptedPdf(userPassword = 'gizli', ownerPassword = 'sahip'): Buffer {
  const permissions = -44
  const id = md5(Buffer.from('cveditor-parolali-ornek'))
  const owner = rc4(md5(padPassword(ownerPassword)).subarray(0, 5), padPassword(userPassword))
  const p = Buffer.alloc(4)
  p.writeInt32LE(permissions)
  const key = md5(padPassword(userPassword), owner, p, id).subarray(0, 5)
  const user = rc4(key, PASSWORD_PAD)
  const objectKey = (num: number) => md5(key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0])).subarray(0, 10)

  const content = rc4(objectKey(4), Buffer.from('BT /F1 18 Tf 72 760 Td (Parolali Ornek CV) Tj ET', 'latin1'))
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.from(`<< /Filter /Standard /V 1 /R 2 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> /P ${permissions} >>`),
  ]
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  let offset = chunks[0].length
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(offset)
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')])
    chunks.push(chunk)
    offset += chunk.length
  })
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>] >>`,
    'startxref',
    String(offset),
    '%%EOF',
    '',
  ].join('\n')
  chunks.push(Buffer.from(xref))
  return Buffer.concat(chunks)
}
