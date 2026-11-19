export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' }

/** Dosya adı için güvenli parça: "Genel TR" → "Genel_TR", Türkçe harfler sadeleşir. */
export function fileSafe(value: string): string {
  return (
    value
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c] ?? c)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'CV'
  )
}

export function readFileText(file: File): Promise<string> {
  return file.text()
}

/** Bugünün tarihi (YYYY-AA-GG), kullanıcının yerel saatine göre: gece yarısından sonra alınan yedek dünün adını taşımasın. */
export function todayStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
