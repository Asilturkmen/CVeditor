/**
 * Kalıcı depolama izni: tarayıcı yer darlığında ya da (Safari'de) 7 gün
 * ziyaret edilmeyince siteye ait verileri silebilir. persist() bunu
 * engellemeyi ister; Chromium çoğu zaman sessizce verir ya da reddeder.
 * Brave'in "siteyi kapatınca verileri unut" kalkanı bunu da aşar: yedek şart.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isPersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}

/** Chromium tabanlı mı (Chrome, Edge, Brave)? Önizleme = PDF garantisi yalnız orada. */
export function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands
  if (brands) return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Brave/i.test(b.brand))
  return /Chrome\//.test(navigator.userAgent) && !/Edg\/|OPR\//.test(navigator.userAgent)
}

/**
 * Gerçek Safari mi (macOS/iOS)? Safari (Akıllı İzleme Önleme) 7 gün ziyaret
 * edilmeyen sitenin verilerini silebilir. iOS'taki Chrome/Firefox/Edge/Opera da
 * WebKit'tir ve UA'larında "Safari" geçer; kendi işaretleri (CriOS, FxiOS, EdgiOS,
 * OPiOS…) varsa Safari sayılmaz. Ana ekrana eklenmiş web uygulaması (standalone)
 * bu sayaçtan muaf olduğundan o da sayılmaz.
 */
export function isSafari(
  ua: string = navigator.userAgent,
  vendor: string = navigator.vendor ?? '',
  standalone: boolean = (navigator as Navigator & { standalone?: boolean }).standalone === true,
): boolean {
  if (standalone) return false
  if (!/Apple/i.test(vendor)) return false
  if (!/Safari\//.test(ua) || !/Version\/\d/.test(ua)) return false
  return !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|EdgA|OPiOS|OPR|YaBrowser|GSA\/|DuckDuckGo|Brave|Android/i.test(ua)
}
