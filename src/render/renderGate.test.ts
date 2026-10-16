import { describe, expect, it } from 'vitest'
import { createRenderGate } from './renderGate'

/** Elle çözülen söz: çizimin yazı tipi beklemesini taklit eder. */
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

describe('çizim sırası (yazdırma en son çizimi bekler)', () => {
  it('yazdırmanın çizimi yarıda kalırsa en son başlayan çizim bitene kadar beklenir', async () => {
    const gate = createRenderGate()
    const drawn: string[] = []
    const draw = (label: string, fonts: Promise<void>) =>
      gate.track(
        (async () => {
          const token = gate.begin()
          await fonts
          if (!gate.isCurrent(token)) return
          drawn.push(label)
          gate.complete(token)
        })(),
      )

    const printFonts = deferred()
    const newerFonts = deferred()
    const printing = draw('yazdırma', printFonts.promise)
    // Yazı tipleri beklenirken güncel CV ile yeni çizim başlar (requestAnimationFrame).
    const newer = draw('güncel', newerFonts.promise)
    printFonts.resolve()
    await printing
    expect(drawn).toEqual([])

    let settled = false
    const waiting = gate.settled().then((ok) => {
      settled = ok
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    newerFonts.resolve()
    await newer
    await waiting
    expect(settled).toBe(true)
    expect(drawn).toEqual(['güncel'])
  })

  it('beklerken yeni çizim gelirse onu da bekler; son çizim hata verirse false döner', async () => {
    const gate = createRenderGate()
    expect(await gate.settled()).toBe(true)

    const first = deferred()
    let t1 = 0
    gate.track(
      (async () => {
        t1 = gate.begin()
        await first.promise
        if (gate.isCurrent(t1)) gate.complete(t1)
      })(),
    )
    const waiting = gate.settled()
    const second = deferred()
    gate.track(
      (async () => {
        const t2 = gate.begin()
        await second.promise
        if (gate.isCurrent(t2)) gate.complete(t2)
      })(),
    )
    first.resolve()
    second.resolve()
    expect(await waiting).toBe(true)

    const failing = gate.track(
      (async () => {
        gate.begin()
        throw new Error('çizim hatası')
      })(),
    )
    await expect(failing).rejects.toThrow()
    expect(await gate.settled()).toBe(false)
  })
})
