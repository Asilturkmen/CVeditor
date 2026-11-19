const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' }

/** Dosya adı: CV'nin adı, yasak karakterler atılmış, en çok 120 karakter; boşsa "CV". */
export function pdfFileName(cvName: string): string {
  const base = cvName
    // eslint-disable-next-line no-control-regex -- dosya adında denetim karakteri olmasın
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim()
  return `${base || 'CV'}.pdf`
}

/** Eski istemciler için ASCII karşılığı ("Yazılım TR.pdf" → "Yazilim TR.pdf") */
export function asciiFileName(name: string): string {
  return (
    name
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c] ?? c)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_') || 'CV.pdf'
  )
}

/** RFC 6266 + RFC 5987: ASCII yedek ad ve UTF-8 asıl ad */
export function contentDisposition(name: string): string {
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${asciiFileName(name)}"; filename*=UTF-8''${encoded}`
}
