/**
 * Önizleme çizimlerinin sırası. Çizim yazı tiplerini beklerken yeni bir
 * çizim (ör. requestAnimationFrame ile gelen güncel CV) başlayabilir; eski
 * çizim jetonu geçersiz kalınca yarıda bırakılır. Yazdırma "kendi" çizimi
 * değil en son başlayan çizim bitince yapılmalı: `settled()` bunu bekler.
 */
export interface RenderGate {
  /** Yeni çizim başlar; jetonu döner */
  begin: () => number
  /** Bu jeton hâlâ en son başlayan çizimin mi? */
  isCurrent: (token: number) => boolean
  /** Çizim bitti (yalnız en son başlayan çizim için anlamlı) */
  complete: (token: number) => void
  /** Çizimin sözünü izler; settled() en son izlenen sözü bekler */
  track: <T>(promise: Promise<T>) => Promise<T>
  /**
   * En son başlayan çizim bitene kadar bekler; beklerken yenisi başlarsa onu
   * da bekler. Son çizim hata verip bitmediyse false döner.
   */
  settled: () => Promise<boolean>
}

export function createRenderGate(): RenderGate {
  let started = 0
  let completed = 0
  let latest: Promise<unknown> = Promise.resolve()
  return {
    begin: () => ++started,
    isCurrent: (token) => token === started,
    complete: (token) => {
      if (token === started) completed = token
    },
    track(promise) {
      latest = promise.catch(() => undefined)
      return promise
    },
    async settled() {
      // Sınır: sürekli yeni çizim gelse bile yazdırma sonsuza dek beklemez.
      for (let guard = 0; guard < 50 && completed !== started; guard++) {
        const waiting = latest
        await waiting
        // Son çizim bitti ama tamamlanmadı (hata ya da erken çıkış) ve yenisi gelmedi.
        if (waiting === latest && completed !== started) return false
      }
      return completed === started
    },
  }
}
