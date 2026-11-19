import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { drawDocument, type DrawInput } from './drawDocument'
import { paginate, type PaginateResult } from './paginate'
import { documentShell, renderCvSource } from './renderCv'
import { templateSettingsFor } from './templates'

const EMPTY: PaginateResult = { pageCount: 1, oversized: [], clipped: false, headerClipped: false, contentHeight: 0 }
const INPUT: DrawInput = { lang: 'tr', styles: '.x{color:red}', hostStyles: '.y{gap:0}', html: '<div class="cv">içerik</div>', fontQueries: ["400 12px 'CV Inter'"] }

function shell() {
  return new DOMParser().parseFromString(documentShell({ lang: 'en' }), 'text/html')
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** jsdom'da `document.fonts` yok; sorgu başına elle çözülen yükleme. */
function fakeFonts(doc: Document) {
  const loads = new Map<string, ReturnType<typeof deferred<unknown[]>>>()
  const load = vi.fn((query: string) => {
    const d = deferred<unknown[]>()
    loads.set(query, d)
    return d.promise
  })
  Object.defineProperty(doc, 'fonts', { value: { load }, configurable: true })
  return { load, loads }
}

const text = (doc: Document, id: string) => doc.getElementById(id)!.textContent
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  vi.useRealTimers()
})

describe('ortak çizim sırası (önizleme ve sunucu)', () => {
  it('stili yazar → yazı tiplerini bekler → HTML\'i koyar → sayfalar', async () => {
    const doc = shell()
    const fonts = fakeFonts(doc)
    const steps: string[] = []
    const paginateSpy = vi.fn((d: Document, options?: { previousPageCount?: number }) => {
      // Sayfalama anında stil de HTML de yerinde.
      steps.push(`sayfala stil=${text(d, 'cv-styles')} html=${d.getElementById('cv-source')!.innerHTML} önceki=${options?.previousPageCount}`)
      return { ...EMPTY, pageCount: 3 }
    })
    const drawing = drawDocument(doc, { ...INPUT, previousPageCount: 2 }, { paginate: paginateSpy })
    await flush()
    // Yazı tipleri beklenirken: stil yazıldı, HTML henüz yok, sayfalanmadı.
    expect(doc.documentElement.lang).toBe('tr')
    expect(text(doc, 'cv-styles')).toBe('.x{color:red}')
    expect(text(doc, 'cv-host')).toBe('.y{gap:0}')
    expect(fonts.load).toHaveBeenCalledWith("400 12px 'CV Inter'", expect.stringContaining('ğ'))
    expect(doc.getElementById('cv-source')!.innerHTML).toBe('')
    expect(paginateSpy).not.toHaveBeenCalled()

    fonts.loads.get("400 12px 'CV Inter'")!.resolve([{}])
    const result = await drawing
    expect(steps).toEqual(['sayfala stil=.x{color:red} html=<div class="cv">içerik</div> önceki=2'])
    expect(result).toEqual({ ...EMPTY, pageCount: 3, fontsTimedOut: false })
  })

  it('takılan yazı tipi isteği çizimi dondurmaz: süre dolunca eldekiyle çizer (varsayılan 4 sn)', async () => {
    vi.useFakeTimers()
    const doc = shell()
    fakeFonts(doc)
    const paginateSpy = vi.fn(() => EMPTY)
    let result: Awaited<ReturnType<typeof drawDocument>> | undefined
    void drawDocument(doc, INPUT, { paginate: paginateSpy }).then((r) => {
      result = r
    })
    await vi.advanceTimersByTimeAsync(3999)
    expect(paginateSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(paginateSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ...EMPTY, fontsTimedOut: true })
    expect(doc.getElementById('cv-source')!.innerHTML).toContain('içerik')
  })

  it('bekleme süresi verilebilir; zamanında yüklenen yazı tipinde zamanlayıcı kalmaz', async () => {
    vi.useFakeTimers()
    const doc = shell()
    const fonts = fakeFonts(doc)
    const paginateSpy = vi.fn(() => EMPTY)
    const slow = drawDocument(doc, { ...INPUT, fontTimeoutMs: 300 }, { paginate: paginateSpy })
    await vi.advanceTimersByTimeAsync(300)
    expect((await slow)?.fontsTimedOut).toBe(true)

    const fast = drawDocument(doc, INPUT, { paginate: paginateSpy })
    fonts.loads.get("400 12px 'CV Inter'")!.resolve([{}])
    expect((await fast)?.fontsTimedOut).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('süre dolduktan sonra gelen yazı tipi bildirilir (yeniden çizilsin); yüklenemeyen ve zamanında gelen bildirilmez', async () => {
    vi.useFakeTimers()
    const doc = shell()
    const fonts = fakeFonts(doc)
    const onLateFonts = vi.fn()
    const queries = ['400 12px A', '400 12px B', '400 12px C']
    const drawing = drawDocument(doc, { ...INPUT, fontQueries: queries }, { paginate: () => EMPTY, onLateFonts })
    fonts.loads.get('400 12px A')!.resolve([{}]) // zamanında
    await vi.advanceTimersByTimeAsync(4000)
    expect((await drawing)?.fontsTimedOut).toBe(true)
    expect(onLateFonts).not.toHaveBeenCalled()

    fonts.loads.get('400 12px B')!.reject(new Error('ağ hatası')) // geç ve başarısız
    await vi.advanceTimersByTimeAsync(0)
    expect(onLateFonts).not.toHaveBeenCalled()

    fonts.loads.get('400 12px C')!.resolve([{}]) // geç ama yüklendi
    await vi.advanceTimersByTimeAsync(0)
    expect(onLateFonts).toHaveBeenCalledTimes(1)
  })

  it('yüklenemeyen yazı tipi çizimi düşürmez; aynı sorgu bir kez yüklenir', async () => {
    const doc = shell()
    const fonts = fakeFonts(doc)
    const drawing = drawDocument(doc, { ...INPUT, fontQueries: ['400 12px A', '400 12px A'] }, { paginate: () => EMPTY })
    expect(fonts.load).toHaveBeenCalledTimes(1)
    fonts.loads.get('400 12px A')!.reject(new Error('ağ hatası'))
    expect(await drawing).toEqual({ ...EMPTY, fontsTimedOut: false })
  })

  it('yazı tipleri beklenirken daha yeni çizim başladıysa (isCurrent false) belgeye dokunmadan bırakır', async () => {
    const doc = shell()
    const fonts = fakeFonts(doc)
    const paginateSpy = vi.fn(() => EMPTY)
    let current = true
    const drawing = drawDocument(doc, INPUT, { paginate: paginateSpy, isCurrent: () => current })
    current = false
    fonts.loads.get("400 12px 'CV Inter'")!.resolve([{}])
    expect(await drawing).toBeNull()
    expect(doc.getElementById('cv-source')!.innerHTML).toBe('')
    expect(paginateSpy).not.toHaveBeenCalled()
  })

  it('iskelet eksikse hata verir (boş belge sayfalanmaz)', async () => {
    const doc = shell()
    doc.getElementById('cv-pages')!.remove()
    await expect(drawDocument(doc, INPUT, { paginate: () => EMPTY })).rejects.toThrow('iskeleti eksik')
  })

  it('gerçek sayfalamayla: kaynak sayfalara dağıtılır, kaynakta kopya kalmaz (yazı tipi API\'si olmayan ortamda da)', async () => {
    const sections = sampleSections('tr')
    const cv = createCv({ name: 'Örnek', language: 'tr', templateId: 'zarif', template: templateSettingsFor('zarif', sections), personal: samplePersonal('tr'), sections })
    const doc = shell()
    const result = await drawDocument(doc, { lang: cv.language, styles: '', html: renderCvSource(cv), fontQueries: ['400 12px A'] }, { paginate })
    expect(result).toMatchObject({ pageCount: 1, oversized: [], clipped: false, headerClipped: false, fontsTimedOut: false })
    expect(doc.querySelectorAll('#cv-pages > .page')).toHaveLength(1)
    expect(doc.querySelector('#cv-pages .page-inner.has-header .cv-name')!.textContent).toBe('Deniz Aksoy')
    expect(doc.getElementById('cv-source')!.childNodes).toHaveLength(0)
    expect(doc.getElementById('cv-pages')!.hasAttribute('data-measuring')).toBe(false)
  })
})
