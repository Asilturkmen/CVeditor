/**
 * Apple klavyesi (macOS, iPadOS): kısayollar Ctrl yerine ⌘ ile yazılır. Kısayol işleyicileri ikisini de
 * kabul eder (`ctrlKey || metaKey`); bu yalnız GÖSTERİM içindir.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/**
 * Kısayolu platformun yazımıyla verir: "Ctrl+Shift+Z" → Mac'te "⌘⇧Z". Yalnız "Ctrl", "Shift", "Alt"
 * değiştiricilerini çevirir; geri kalan tuş adı olduğu gibi kalır.
 */
export function formatShortcut(shortcut: string, apple = isApplePlatform()): string {
  if (!apple) return shortcut
  return shortcut
    .split(' / ')
    .map((part) =>
      part
        .split('+')
        .map((key) => ({ Ctrl: '⌘', Shift: '⇧', Alt: '⌥' })[key] ?? key)
        .join(''),
    )
    .join(' / ')
}
