/**
 * İşlenmemiş söz reddi (unhandledrejection) için genel yakalayıcı. Hiçbir hata sessizce
 * kaybolmasın: ayrıntı konsola, kullanıcıya sakin tek bir bildirim (art arda hatalar bildirim
 * yağdırmasın diye aralıklı).
 */

const NOTICE_GAP_MS = 10_000

const errorName = (reason: unknown) =>
  reason && typeof reason === 'object' && 'name' in reason ? String((reason as { name: unknown }).name) : ''
const errorMessage = (reason: unknown) =>
  reason && typeof reason === 'object' && 'message' in reason ? String((reason as { message: unknown }).message) : ''

/**
 * Kullanıcıyı ilgilendirmeyen redler:
 * - İptal edilen istek (AbortError): kullanıcı vazgeçti ya da sayfa değişti.
 * - Görünüm geçişi (View Transition) sekme gizliyken ya da yarıda kesilince reddedilir
 *   ("Transition was aborted because of invalid state" / "… Document hidden"); gezinme yine tamamlanır.
 */
export function isBenignRejection(reason: unknown): boolean {
  const name = errorName(reason)
  if (name === 'AbortError') return true
  return (name === 'InvalidStateError' || name === 'TimeoutError') && /transition/i.test(errorMessage(reason))
}

export function watchUnhandledRejections(notify: () => void, target: Pick<Window, 'addEventListener'> = window) {
  let lastNotice = -Infinity
  target.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (isBenignRejection(event.reason)) {
      event.preventDefault()
      return
    }
    // Ayrıntıyı tarayıcı zaten konsola yazar; bildirimi biz ekleriz.
    const now = Date.now()
    if (now - lastNotice < NOTICE_GAP_MS) return
    lastNotice = now
    notify()
  })
}
