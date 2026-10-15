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
