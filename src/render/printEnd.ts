/**
 * Baskı penceresinin kapandığını yakalar. Çoğu tarayıcıda `afterprint` gelir;
 * gelmezse ya da `print()` pencereyi beklemeden dönerse sayfanın yeniden odak
 * alması, görünür olması ya da kullanıcının sayfaya tıklaması/tuşa basması
 * baskının bittiği anlamına gelir. Bu yedek olaylar bir görev sonra kurulur:
 * baskıyı başlatan tuş ya da baskı başlarken gelen odak olayı sayılmaz.
 *
 * `done` en çok bir kez çağrılır. Dönen fonksiyon dinleyicileri elle kaldırır
 * (`done` çağrılmaz).
 */
export function whenPrintEnds(targets: Window[], done: () => void): () => void {
  let active = true
  let arm: ReturnType<typeof setTimeout> | undefined
  const removers: (() => void)[] = []
  const listen = (target: EventTarget, type: string, fn: () => void, capture = false) => {
    target.addEventListener(type, fn, capture)
    removers.push(() => target.removeEventListener(type, fn, capture))
  }
  const stop = () => {
    active = false
    clearTimeout(arm)
    for (const remove of removers.splice(0)) remove()
  }
  const finish = () => {
    if (!active) return
    stop()
    done()
  }
  for (const win of targets) listen(win, 'afterprint', finish)
  arm = setTimeout(() => {
    if (!active) return
    for (const win of targets) {
      listen(win, 'focus', finish)
      listen(win, 'pointerdown', finish, true)
      listen(win, 'keydown', finish, true)
      const doc = win.document
      listen(doc, 'visibilitychange', () => {
        if (doc.visibilityState === 'visible') finish()
      })
    }
  }, 0)
  return stop
}
