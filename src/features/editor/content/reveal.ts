import { prefersReducedMotion } from '@/lib/motion'

/** Anahat satırının DOM kimliği (`#personal-card`, `#item-<id>`). */
export const rowElementId = (id: string) => (id === 'personal' ? 'personal-card' : `item-${id}`)

const ANCHOR_MS = 260
const TOP_GAP = 12

/**
 * Satırı panelde görünür yapar ve açılma/kapanma animasyonu (200ms) sürerken yerinde tutar:
 * başka bir kayıt üstte kapanırken satır kaymaz. Satır zaten görünüyorsa olduğu yerde kalır,
 * değilse panelin üstüne (12px boşlukla) gelir. Sonra kısa vurgu ve ilk alana imleç.
 */
export function revealRow(id: string, { focus = true, flash = true }: { focus?: boolean; flash?: boolean } = {}) {
  const el = document.getElementById(rowElementId(id))
  const scroller = el?.closest<HTMLElement>('[data-panel-scroll]')
  if (!el || !scroller) return
  const view = scroller.getBoundingClientRect()
  const top = el.getBoundingClientRect().top - view.top
  const visible = top >= 0 && top <= view.height - 88
  const wanted = visible ? top : TOP_GAP
  const settle = () => {
    const now = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTop += now - wanted
  }
  settle()
  if (!prefersReducedMotion()) {
    const end = performance.now() + ANCHOR_MS
    const step = () => {
      if (!el.isConnected) return
      settle()
      if (performance.now() < end) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  // Kayıtta bekleyen öneri varsa açılma bitince fark görünür olsun.
  const suggestion = el.querySelector<HTMLElement>('[data-field-suggestion]')
  if (suggestion) {
    setTimeout(() => suggestion.isConnected && suggestion.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }), ANCHOR_MS + 20)
  }
  if (flash) {
    el.classList.remove('animate-flash')
    void el.offsetWidth
    el.classList.add('animate-flash')
  }
  // İlk alana imleç: tıklayıp hemen yazmaya başlanabilsin. Bir menüden geldiyse (Bölüm ekle,
  // Kopyasını ekle) menü kapanıp odağı tetikleyicisine geri verdikten SONRA.
  if (focus) afterMenusClosed(() => el.querySelector<HTMLElement>('input, textarea, [contenteditable="true"]')?.focus({ preventScroll: true }))
}

/** Açık menü kapanıp odağı tetikleyicisine geri verdikten sonra çalıştırır (en çok ~1 sn bekler). */
export function afterMenusClosed(run: () => void, tries = 0) {
  if (document.querySelector('[role="menu"]') && tries < 40) {
    setTimeout(() => afterMenusClosed(run, tries + 1), 25)
    return
  }
  // Radix odağı içerik kaldırılırken geri verir; bir tur daha bekle.
  if (tries > 0) setTimeout(run, 0)
  else run()
}
