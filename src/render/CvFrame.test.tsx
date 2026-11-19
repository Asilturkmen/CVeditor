import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv } from '@/cv/schema'
import { CvFrame, FONT_TIMEOUT_MS, OWN_PRINT_ATTR, type CvFrameHandle } from './CvFrame'
import type { PaginateResult } from './paginate'
import { templateSettingsFor } from './templates'

/**
 * CvFrame'in çizim yaşam döngüsü: gerçek drawDocument ve paginate ile, jsdom'da. jsdom iframe
 * srcdoc'u yüklemez ve yazı tipi API'si taşımaz: iskelet elle yazılır, `fonts.load` taklit edilir
 * (elle çözülen söz = ağdan gelen yazı tipi).
 */

function sampleCv(name = 'Deniz Aksoy'): Cv {
  const sections = sampleSections('tr')
  return createCv({
    name: 'Örnek',
    language: 'tr',
    templateId: 'zarif',
    template: templateSettingsFor('zarif', sections),
    personal: { ...samplePersonal('tr'), fullName: name },
    sections,
  })
}

interface FontLoad {
  resolve: (faces: unknown[]) => void
}

let root: Root
let container: HTMLElement
let fontLoads: FontLoad[]
/** true: yazı tipleri hemen yüklenir; false: test çözene kadar bekler (takılan istek) */
let fontsReady: boolean

const frame = () => container.querySelector('iframe')!
const frameDoc = () => frame().contentDocument!
const pagesText = () => frameDoc().getElementById('cv-pages')?.textContent ?? ''

async function mount(props: Partial<Parameters<typeof CvFrame>[0]> & { cv: Cv }, ref = createRef<CvFrameHandle>()) {
  await act(async () => {
    root.render(<CvFrame ref={ref} scale={1} {...props} />)
  })
  return ref
}

/** Tarayıcının srcdoc'u yüklemesinin karşılığı: iskelet + yazı tipi API'si + load olayı. */
async function loadFrame() {
  const doc = frameDoc()
  doc.documentElement.innerHTML =
    '<head><style id="cv-fonts"></style><style id="cv-styles"></style><style id="cv-host"></style></head><body><div id="cv-source"></div><div id="cv-pages"></div></body>'
  Object.defineProperty(doc, 'fonts', {
    configurable: true,
    value: {
      load: () =>
        fontsReady
          ? Promise.resolve([{}])
          : new Promise<unknown[]>((resolve) => {
              fontLoads.push({ resolve })
            }),
    },
  })
  await act(async () => {
    frame().dispatchEvent(new Event('load'))
  })
}

/** requestAnimationFrame ile kurulan çizimi ve ardındaki sözleri çalıştırır. */
async function tick(ms = 20) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  fontLoads = []
  fontsReady = true
  // Üst belgede menü baskısı aynası için yazı tipi ısıtması (jsdom'da document.fonts yok).
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => Promise.resolve([]) } })
  // jsdom metin kutusu ölçmez (okuma metni ve başlık taşması boş döner).
  ;(Range.prototype as unknown as { getClientRects: () => DOMRect[] }).getClientRects = () => []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (document as unknown as { fonts?: unknown }).fonts
  delete (Range.prototype as unknown as { getClientRects?: unknown }).getClientRects
  document.documentElement.removeAttribute(OWN_PRINT_ATTR)
})

describe('CvFrame: çizim', () => {
  it('CV\'yi iframe\'e çizer ve sonucu bildirir', async () => {
    const onResult = vi.fn<(r: PaginateResult) => void>()
    await mount({ cv: sampleCv(), onResult })
    await loadFrame()
    await tick()
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0]).toMatchObject({ pageCount: 1, clipped: false, headerClipped: false })
    expect(pagesText()).toContain('Deniz Aksoy')
    expect(frameDoc().documentElement.lang).toBe('tr')
  })

  it('kaldırıldıktan sonra biten çizim depoya (onResult, onReadingText) ve belgeye yazmaz', async () => {
    fontsReady = false
    const onResult = vi.fn()
    const onReadingText = vi.fn()
    await mount({ cv: sampleCv(), onResult, onReadingText })
    await loadFrame()
    await tick()
    // Çizim yazı tiplerini bekliyor.
    expect(fontLoads.length).toBeGreaterThan(0)
    expect(onResult).not.toHaveBeenCalled()
    const doc = frameDoc()

    await act(async () => root.unmount())
    for (const load of fontLoads) load.resolve([{}])
    await tick(FONT_TIMEOUT_MS + 100)
    expect(onResult).not.toHaveBeenCalled()
    expect(onReadingText).not.toHaveBeenCalled()
    expect(doc.getElementById('cv-pages')!.childNodes).toHaveLength(0)
    expect(doc.getElementById('cv-source')!.childNodes).toHaveLength(0)
    root = createRoot(container)
  })

  it('takılan yazı tipi isteği önizlemeyi dondurmaz: süre dolunca çizer, yazı tipi gelince yeniden çizer', async () => {
    fontsReady = false
    const onResult = vi.fn()
    await mount({ cv: sampleCv(), onResult })
    await loadFrame()
    await tick()
    await tick(FONT_TIMEOUT_MS - 100)
    expect(onResult).not.toHaveBeenCalled()
    expect(pagesText()).toBe('')
    await tick(200)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(pagesText()).toContain('Deniz Aksoy')

    // Geç gelen yazı tipi satır kırılımını değiştirir: yeniden ölçülüp çizilir.
    fontsReady = true
    for (const load of fontLoads.splice(0)) load.resolve([{}])
    await tick()
    await tick()
    expect(onResult).toHaveBeenCalledTimes(2)
  })

  it('yazı tipleri beklenirken CV değişirse eski çizim bırakılır, yalnız güncel CV çizilir', async () => {
    fontsReady = false
    const onResult = vi.fn()
    const ref = await mount({ cv: sampleCv('Eski Ad'), onResult })
    await loadFrame()
    await tick()
    const stale = fontLoads.splice(0)
    await mount({ cv: sampleCv('Yeni Ad'), onResult }, ref)
    await tick()
    for (const load of [...stale, ...fontLoads]) load.resolve([{}])
    await tick()
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(pagesText()).toContain('Yeni Ad')
    expect(pagesText()).not.toContain('Eski Ad')
  })

  it('çizim hatası yutulmaz: onError\'a gider; önceki çizim belgede kalır', async () => {
    const onError = vi.fn()
    const onResult = vi.fn()
    const ref = await mount({ cv: sampleCv(), onResult, onError })
    await loadFrame()
    await tick()
    expect(onResult).toHaveBeenCalledTimes(1)
    const broken = { ...sampleCv('Bozuk Kayıt'), sections: null } as unknown as Cv
    await mount({ cv: broken, onResult, onError }, ref)
    await tick()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onResult).toHaveBeenCalledTimes(1)
  })

  it('onError verilmemişse hata konsola yazılır (işlenmemiş söz reddi olmaz)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ref = await mount({ cv: sampleCv() })
    await loadFrame()
    await tick()
    await mount({ cv: { ...sampleCv(), sections: null } as unknown as Cv }, ref)
    await tick()
    expect(logged.mock.calls.some(([first]) => first instanceof Error)).toBe(true)
  })
})

describe('CvFrame: yazdırma', () => {
  function spyPrint() {
    const win = frame().contentWindow!
    const print = vi.fn()
    Object.defineProperty(win, 'print', { configurable: true, value: print })
    Object.defineProperty(win, 'focus', { configurable: true, value: () => {} })
    return print
  }

  it('güncel CV çizildiyse iframe\'i yazdırır; başlık baskı bitince geri gelir', async () => {
    const ref = await mount({ cv: sampleCv() })
    await loadFrame()
    await tick()
    const print = spyPrint()
    const before = document.title
    await act(async () => {
      await ref.current!.print('Deniz Aksoy CV')
    })
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('Deniz Aksoy CV')
    expect(document.documentElement.hasAttribute(OWN_PRINT_ATTR)).toBe(true)
    await act(async () => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(document.title).toBe(before)
    expect(document.documentElement.hasAttribute(OWN_PRINT_ATTR)).toBe(false)
  })

  it('son çizim hata verdiyse eski belgeyi basmaz, hatayı çağırana iletir', async () => {
    const onError = vi.fn()
    const ref = await mount({ cv: sampleCv(), onError })
    await loadFrame()
    await tick()
    expect(pagesText()).toContain('Deniz Aksoy')
    const print = spyPrint()
    await mount({ cv: { ...sampleCv('Yeni Ad'), sections: null } as unknown as Cv, onError }, ref)
    await tick()
    // Belgede hâlâ eski CV duruyor; güncel CV çizilemedi.
    expect(pagesText()).toContain('Deniz Aksoy')

    const before = document.title
    let failure: unknown
    await act(async () => {
      failure = await ref.current!.print('Yeni Ad CV').catch((error: unknown) => error)
    })
    expect(failure).toBeInstanceOf(Error)
    expect(print).not.toHaveBeenCalled()
    expect(document.title).toBe(before)
    expect(document.documentElement.hasAttribute(OWN_PRINT_ATTR)).toBe(false)
  })

  it('yazdırmanın çizimi yarıda kalır ve en son çizim hata verirse de basmaz', async () => {
    fontsReady = false
    const onError = vi.fn()
    const ref = await mount({ cv: sampleCv(), onError })
    await loadFrame()
    await tick()
    const print = spyPrint()
    let failure: unknown = 'bekliyor'
    let printing!: Promise<void>
    await act(async () => {
      // Yazdırma kendi çizimini başlatır ve yazı tiplerini bekler…
      printing = ref.current!.print('CV').then(
        () => {
          failure = null
        },
        (error: unknown) => {
          failure = error
        },
      )
    })
    // …o sırada CV bozuk bir hâle değişir: daha yeni çizim başlar ve hata verir.
    await mount({ cv: { ...sampleCv(), sections: null } as unknown as Cv, onError }, ref)
    await tick()
    for (const load of fontLoads) load.resolve([{}])
    await tick()
    await act(async () => {
      await printing
    })
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).cause).toBeInstanceOf(Error)
    expect(print).not.toHaveBeenCalled()
  })

  it('belge henüz yüklenmediyse boş sayfa basmaz, reddeder', async () => {
    const ref = await mount({ cv: sampleCv() })
    const print = spyPrint()
    let failure: unknown
    await act(async () => {
      failure = await ref.current!.print('CV').catch((error: unknown) => error)
    })
    expect(failure).toBeInstanceOf(Error)
    expect(print).not.toHaveBeenCalled()
  })
})
