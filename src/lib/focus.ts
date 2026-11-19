/**
 * Odağı, açık menü/pencere kapandıktan sonra `find`'ın bulduğu öğeye verir; yalnız odak boşta kaldıysa
 * (silinen ya da kapanan öğeyle birlikte kaybolup gövdeye düştüyse). Kullanıcı bu arada başka bir
 * yere geçtiyse dokunulmaz. Radix pencereleri kapanırken odağı açıldıkları öğeye geri verir; o öğe
 * (menü maddesi, silinen kayıt) artık yoksa odak gövdeye düşer: klavye kullanıcısı sayfanın başına döner.
 */
export function focusWhenSettled(find: () => HTMLElement | null | undefined) {
  let tries = 0
  const attempt = () => {
    // Pencere/menü kapanma animasyonu sürerken bekle (en fazla ~1 sn).
    if (document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"]') && tries++ < 40) {
      setTimeout(attempt, 25)
      return
    }
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    find()?.focus()
  }
  setTimeout(attempt, 0)
}
