import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Cv } from '@/cv/schema'
import { readingText, type ReadingText } from './atsText'
import type { SuggestionMap } from './CvMarkup'
import { drawDocument } from './drawDocument'
import { fontLoadQueries } from './fonts'
import { paginate, type PaginateResult } from './paginate'
import { whenPrintEnds } from './printEnd'
import { buildPrintMirror, shadowCopyOfPages, warmMirrorFonts } from './printMirror'
import { createRenderGate } from './renderGate'
import { cvFonts, cvStyles, documentShell, renderCvSource } from './renderCv'
import { getTemplate } from './templates'

/** A4 genişliği CSS pikseli olarak (210mm @ 96dpi) */
export const PAGE_WIDTH_PX = 793.7
export const PAGE_HEIGHT_PX = 1122.5

export interface CvFrameTarget {
  itemId: string | null
  sectionId: string | null
  personal: boolean
}

export interface CvFrameHandle {
  /**
   * Güncel CV'yi çizip iframe'i yazdırır. Çizim yapılamadıysa (son çizim hata verdi, belge
   * hazır değil) hiçbir şey basmaz ve reddeder: çağıran hatayı kullanıcıya göstermeli.
   */
  print: (title: string) => Promise<void>
  /** Tarayıcı menüsünden yazdırma için son çizimin kopyası (bkz. printMirror.ts) */
  printMirror: () => HTMLElement | null
}

/** "PDF al" iframe'i yazdırırken üst belgede işaret: menü baskısı aynası devreye girmesin. */
export const OWN_PRINT_ATTR = 'data-cv-own-print'

/** Menü baskısı aynasının son çizimden ne kadar sonra hazırlanacağı (yazarken her tuşta kurulmasın). */
const MIRROR_DELAY_MS = 250

/** Yazı tipleri en çok bu kadar beklenir; sonra eldekiyle çizilir (takılan istek önizlemeyi dondurmaz). */
export const FONT_TIMEOUT_MS = 4000
/** Bir kez zaman aşımına uğradıktan sonraki çizimlerde bekleme: her tuşta 4 sn gecikme olmasın. */
const FONT_RETRY_TIMEOUT_MS = 300

/**
 * Yazarken çizim ertelenir: çizim (işaretleme + sayfalama) ana iş parçacığında onlarca ms sürer ve
 * her tuşta yapılırsa yazmayı bloklar. Bir önceki değişiklikten bu süreden kısa sürede gelen değişiklik
 * "arka arkaya" sayılır; çizim son değişiklikten bu kadar sonra, tek sefer yapılır. Tek değişiklik
 * (ya da duraklamadan sonraki ilk tuş) hemen çizilir. Son tuştan sonra önizleme ≈ bu süre + bir çizim
 * içinde günceldir (≤ 250 ms).
 */
export const COALESCE_MS = 120
/** Hiç duraklamadan yazarken bile önizleme en geç bu kadar bayat kalır. */
export const MAX_DEFER_MS = 800
/** Küçük resimler (yalnız ilk sayfa) daha geç ve tarayıcı boşta kalınca çizilir: ana önizlemeye ve yazmaya yol verir. */
const THUMB_COALESCE_MS = 400

interface Props {
  cv: Cv
  suggestions?: SuggestionMap
  /** Sayfa ölçeği; "fit" kapsayıcı genişliğine sığdırır */
  scale: number | 'fit'
  /** Yalnız ilk sayfa (küçük resimler için) */
  firstPageOnly?: boolean
  interactive?: boolean
  placeholders?: boolean
  emptyHint?: string
  /** Fotoğraf açık ama yüklenmemişken önizlemedeki kutunun yazısı (placeholders ile; baskıda gizli) */
  photoHint?: string
  focusedItemId?: string | null
  /** Kısa süre parlayacak kayıtlar (öneri kabulünden sonra); nonce her istekte artar */
  flash?: { ids: string[]; nonce: number } | null
  /** Değişince eski görünüm yenisinin üstünde solar (şablon/sütun geçişi) */
  crossfadeKey?: string
  onResult?: (result: PaginateResult) => void
  /** Kendiliğinden (CV değişince) yapılan çizim hata verdi. Verilmezse hata konsola yazılır. */
  onError?: (error: unknown) => void
  /** Her çizimden sonra basılacak metin, okunma sırasıyla (CV İnceleme) */
  onReadingText?: (text: ReadingText) => void
  onTargetClick?: (target: CvFrameTarget) => void
  onScaleChange?: (scale: number) => void
  className?: string
  title?: string
  /** "fit" ölçeğinde kenarlarda bırakılacak toplam boşluk (px) */
  fitPadding?: number
  /** "fit" ölçeğinin üst sınırı (editörde sayfa gerçek boyutundan büyümesin) */
  maxFitScale?: number
}

/**
 * CV'yi izole bir iframe'de çizer. Şablon CSS'i site stilinden etkilenmez;
 * yazdırma da bu iframe'den yapılır (önizleme = PDF).
 */
export const CvFrame = forwardRef<CvFrameHandle, Props>(function CvFrame(
  {
    cv,
    suggestions,
    scale,
    firstPageOnly = false,
    interactive = false,
    placeholders = false,
    emptyHint,
    photoHint,
    focusedItemId = null,
    flash = null,
    crossfadeKey,
    onResult,
    onError,
    onReadingText,
    onTargetClick,
    onScaleChange,
    className,
    title,
    fitPadding = 48,
    maxFitScale = 4,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Her yüklemede artar; iframe yeniden bağlanırsa içerik yeniden çizilir.
  const [loadCount, setLoadCount] = useState(0)
  const ready = loadCount > 0
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT_PX)
  const [containerWidth, setContainerWidth] = useState(0)
  const pageCountRef = useRef(0)
  const [gate] = useState(createRenderGate)
  const callbacks = useRef({ onResult, onError, onReadingText, onTargetClick })
  // Vurgu ve parlama yeniden çizim gerektirmez; her çizimden sonra da yeniden uygulanır.
  const marks = useRef({ focusedItemId, flash, flashDone: 0 })
  // Son değerler her işlemeden sonra, aşağıdaki efektlerden (ve rAF'teki çizimden) önce yazılır.
  useLayoutEffect(() => {
    callbacks.current = { onResult, onError, onReadingText, onTargetClick }
    marks.current.focusedItemId = focusedItemId
    marks.current.flash = flash
  })
  const lastCrossfadeKey = useRef(crossfadeKey)
  // Menü baskısının aynası her çizimden kısa süre sonra hazırlanır (bkz. printMirror.ts):
  // baskı anında (beforeprint beklemez) fotoğraf gibi görseller çözülmüş olur.
  const drawCount = useRef(0)
  const mirror = useRef<{ host: HTMLElement | null; draw: number }>({ host: null, draw: -1 })
  const mirrorTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // "PDF al" baskısı sürerken: pencere kapanınca başlığı ve işareti geri alır.
  const endPrint = useRef<(() => void) | null>(null)
  // Son çizimin hatası (yazdırma bunu çağırana iletir); başarılı çizimde temizlenir.
  const drawError = useRef<unknown>(null)
  // Yazı tipleri zaman aşımına uğradıysa: sonraki çizimler kısa bekler, geç gelen yazı tipi yeniden çizdirir.
  const slowFonts = useRef(false)
  const [lateFonts, setLateFonts] = useState(0)
  useEffect(
    () => () => {
      clearTimeout(mirrorTimer.current)
      endPrint.current?.()
      // Yazı tiplerini bekleyen çizim, bileşen kaldırıldıktan sonra belgeye ve depoya (onResult) yazmasın.
      gate.invalidate()
    },
    [gate],
  )

  // İskelet bir kez yazılır; içerik sonradan değişir (titreme olmasın diye).
  const srcDoc = useMemo(() => documentShell({ lang: cv.language, title }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || scale !== 'fit') return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [scale])

  const effectiveScale =
    scale === 'fit'
      ? containerWidth > 0
        ? Math.min(maxFitScale, Math.max(0.1, (containerWidth - fitPadding) / PAGE_WIDTH_PX))
        : 0
      : scale

  useEffect(() => {
    if (effectiveScale > 0) onScaleChange?.(effectiveScale)
  }, [effectiveScale, onScaleChange])

  /** Çizer; belge hazır değilse ya da çizim yarıda bırakıldıysa (daha yenisi başladı, bileşen kalktı) false. */
  const draw = useCallback(async (yieldToInput: boolean): Promise<boolean> => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.getElementById('cv-source')) return false
    const token = gate.begin()
    if (crossfadeKey !== lastCrossfadeKey.current) {
      lastCrossfadeKey.current = crossfadeKey
      snapshotForCrossfade(doc)
    }
    // İşaretleme (renderToStaticMarkup) çizimin en pahalı parçası. Kendiliğinden çizimde ardından ana iş
    // parçacığına bir kez yol verilir ki bekleyen tuşlar sayfalamadan önce işlensin; bu arada daha yeni
    // çizim başladıysa bu bırakılır. Yazdırma beklemez.
    const html = renderCvSource(cv, { suggestions, placeholders, emptyHint, photoHint })
    if (yieldToInput) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (!gate.isCurrent(token)) return false
    }
    doc.body.classList.toggle('interactive', interactive)
    // Gövde ailesinin yanında şablonun başlık ve eş aralıklı aileleri de (bütün yüzleriyle) yüklenir.
    const fonts = Object.values(cvFonts(getTemplate(cv.templateId), cv.template))
    // Sıra (stil → yazı tipleri → HTML → sayfalama) sunucudaki PDF ile ortak: drawDocument.ts.
    const result = await drawDocument(
      doc,
      {
        lang: cv.language,
        styles: cvStyles(cv),
        hostStyles: firstPageOnly
          ? // Yalnız ilk sayfa görünür: iframe bir sayfa yüksekliğinde, gerisi taşar. Sayfaları gizlemek
            // ölçümü bozardı (gizli sayfada her şey 0 yükseklik).
            'html,body{overflow:hidden}#cv-pages{gap:0}.overflow-warning{outline:none}'
          : '#cv-pages{--sheet-gap:24px;--sheet-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 24px rgba(0,0,0,.08)}' +
            // Kesikli "uzun kayıt" çerçevesi yalnız düzenlenebilir önizlemede (küçük resimde, telefonda değil).
            (interactive ? '' : '.overflow-warning{outline:none}'),
        html,
        fontQueries: fonts.flatMap(fontLoadQueries),
        fontTimeoutMs: slowFonts.current ? FONT_RETRY_TIMEOUT_MS : FONT_TIMEOUT_MS,
        previousPageCount: pageCountRef.current,
      },
      {
        paginate,
        isCurrent: () => gate.isCurrent(token),
        onLateFonts: () => {
          slowFonts.current = false
          setLateFonts((n) => n + 1)
        },
      },
    )
    // Yarıda bırakıldı: daha yeni bir çizim başladı ya da bileşen kaldırıldı (jeton geçersiz).
    if (!result || !gate.isCurrent(token)) return false
    slowFonts.current = result.fontsTimedOut
    // Menü baskısı aynası üst belgede çizilir; şablonun aileleri orada da hazır olsun.
    if (!firstPageOnly) warmMirrorFonts(fonts)
    pageCountRef.current = result.pageCount
    // CV'deki bağlantılar klavye sırasına girmez (PDF al'dan sonra fazladan durak olmasın).
    doc.querySelectorAll('#cv-pages a').forEach((a) => a.setAttribute('tabindex', '-1'))
    applyMarks(doc, marks.current)
    fadeOutGhost(doc)
    // Yükseklik sayfalama sırasında, animasyonlar kapalıyken ölçülür (yeni sayfanın belirme kayması katılmaz).
    setContentHeight(firstPageOnly ? PAGE_HEIGHT_PX : result.contentHeight)
    gate.complete(token)
    const drawn = ++drawCount.current
    if (!firstPageOnly) {
      clearTimeout(mirrorTimer.current)
      mirrorTimer.current = setTimeout(() => {
        const current = iframeRef.current?.contentDocument
        if (drawCount.current !== drawn || !current) return
        mirror.current = { host: buildPrintMirror(current), draw: drawn }
      }, MIRROR_DELAY_MS)
    }
    callbacks.current.onResult?.(result)
    callbacks.current.onReadingText?.(readingText(doc))
    return true
  }, [cv, suggestions, interactive, placeholders, emptyHint, photoHint, firstPageOnly, crossfadeKey, gate])

  const render = useCallback((yieldToInput = false) => {
    const run = draw(yieldToInput)
    run.then(
      (drawn) => {
        if (drawn) drawError.current = null
      },
      (error: unknown) => {
        drawError.current = error
      },
    )
    return gate.track(run)
  }, [draw, gate])

  // Odak değişince yalnız sınıf güncellenir (yeniden çizim yok). Parlama çizimden sonra
  // uygulanır: kabul CV'yi de değiştirdiğinden eski DOM'a eklenen sınıf hemen kaybolurdu.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (ready && doc) applyMarks(doc, marks.current, false)
  }, [ready, focusedItemId])

  // Kendiliğinden çizim zamanlaması (bkz. COALESCE_MS): son değişikliğin ve son çizimin bitişinin zamanı,
  // ertelenen çizimin ilk isteği.
  const schedule = useRef<{ lastChange: number; lastDrawEnd: number; deferredSince: number; render: unknown }>({
    lastChange: Number.NEGATIVE_INFINITY,
    lastDrawEnd: Number.NEGATIVE_INFINITY,
    deferredSince: 0,
    render: null,
  })
  useEffect(() => {
    if (!ready) return
    const s = schedule.current
    const now = performance.now()
    // Yalnız içerik değişikliği (render) ertelenebilir; belge yeniden yüklendiyse ya da geç yazı tipi geldiyse hemen.
    // Çizim bitince hemen gelen değişiklik de arka arkaya sayılır: o tuş çizim sürerken basılıp beklemişti.
    const changed = s.render !== render
    const burst = changed && now - Math.max(s.lastChange, s.lastDrawEnd) < (firstPageOnly ? THUMB_COALESCE_MS : COALESCE_MS)
    if (changed) {
      s.render = render
      s.lastChange = now
    }
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let idle = 0
    const run = () => {
      s.deferredSince = 0
      // Hata yutulmaz: çağırana (onError) iletilir, yoksa konsola yazılır.
      render(true)
        .catch((error: unknown) => {
          if (callbacks.current.onError) callbacks.current.onError(error)
          else console.error(error)
        })
        .finally(() => {
          s.lastDrawEnd = performance.now()
        })
    }
    const queue = () => {
      // Küçük resimler boşta çizilir: birkaç tanesi art arda gelse de aralarda tuşlar işlenir.
      if (firstPageOnly && typeof requestIdleCallback === 'function') idle = requestIdleCallback(run, { timeout: 1000 })
      else frame = requestAnimationFrame(run)
    }
    if (!burst) queue()
    else {
      if (!s.deferredSince) s.deferredSince = now
      const waited = now - s.deferredSince
      if (!firstPageOnly && waited >= MAX_DEFER_MS) queue()
      else timer = setTimeout(queue, firstPageOnly ? THUMB_COALESCE_MS : COALESCE_MS)
    }
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      if (idle) cancelIdleCallback(idle)
    }
    // lateFonts: zaman aşımından sonra gelen yazı tipi ölçüleri değiştirir, yeniden çizilir.
  }, [ready, loadCount, render, lateFonts, firstPageOnly])

  // Tıklanan kaydı editöre bildir.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!ready || !doc || !interactive) return
    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element).closest?.('[data-item-id], [data-target="personal"], [data-section-id]')
      if (el instanceof HTMLAnchorElement || (event.target as Element).closest?.('a')) event.preventDefault()
      if (!el) return
      const h = el as HTMLElement
      callbacks.current.onTargetClick?.({
        itemId: h.dataset.itemId ?? null,
        sectionId: h.dataset.sectionId ?? null,
        personal: h.dataset.target === 'personal',
      })
    }
    doc.addEventListener('click', onClick)
    return () => doc.removeEventListener('click', onClick)
  }, [ready, loadCount, interactive])

  // Odak önizlemedeyken kısayollar (Ctrl+P, Ctrl+Z, Ctrl+S…) üst pencerenin dinleyicilerine
  // iletilir: iframe ayrı bir belge, tuş olayları üste kabarmaz. Betiksiz sandbox'ta dinleyiciyi
  // üst pencere kurar; kopya olayda engellenen varsayılan asıl olayda da engellenir.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!ready || !doc) return
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const copy = new KeyboardEvent('keydown', {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(copy)
      if (copy.defaultPrevented) event.preventDefault()
    }
    doc.addEventListener('keydown', onKey, true)
    return () => doc.removeEventListener('keydown', onKey, true)
  }, [ready, loadCount])

  useImperativeHandle(
    ref,
    () => ({
      async print(printTitle: string) {
        const win = iframeRef.current?.contentWindow
        const doc = iframeRef.current?.contentDocument
        if (!win || !doc) throw new Error('CV belgesi hazır değil; yazdırılamadı')
        // Çizim hata verirse reddi çağırana gider (eski ya da boş belge basılmaz).
        await render()
        // Yazı tipleri yüklenirken daha yeni bir çizim başladıysa bu çizim yarıda kalmıştır:
        // eski görünüm basılmasın diye en son çizim bitene kadar beklenir. O da hata verdiyse
        // ya da belge hiç çizilmediyse (iframe yüklenmedi) basılacak güncel bir şey yoktur.
        const settled = await gate.settled()
        if (!settled || drawCount.current === 0) {
          throw new Error('CV çizilemedi; yazdırma iptal edildi', { cause: drawError.current ?? undefined })
        }
        // Geçiş kopyası baskıya girmesin (CSS'te de @media print ile gizli).
        doc.getElementById(GHOST_ID)?.remove()
        // Önceki baskının penceresi kapanmış sayılır (geri alma bekliyorsa şimdi yapılır).
        endPrint.current?.()
        const previousTitle = document.title
        doc.title = printTitle
        document.title = printTitle
        doc.body.classList.remove('interactive')
        document.documentElement.setAttribute(OWN_PRINT_ATTR, '')
        // print() çoğu tarayıcıda pencere kapanana dek bekler ama her yerde değil: başlık ve
        // işaret hemen değil, baskı bitince (afterprint, ya da yeniden odak/etkileşim) geri alınır.
        let stopWatching = () => {}
        const restore = () => {
          stopWatching()
          if (endPrint.current === restore) endPrint.current = null
          document.documentElement.removeAttribute(OWN_PRINT_ATTR)
          document.title = previousTitle
          doc.body.classList.toggle('interactive', interactive)
        }
        endPrint.current = restore
        stopWatching = whenPrintEnds([win, window], restore)
        try {
          win.focus()
          win.print()
        } catch (error) {
          restore()
          throw error
        }
      },
      printMirror() {
        const doc = iframeRef.current?.contentDocument
        if (!doc) return null
        // Son çizimden hazırlanmış ayna varsa o (görselleri çözülmüş); yoksa şimdi kurulur.
        const built = mirror.current
        if (built.host && built.draw === drawCount.current) return built.host
        return buildPrintMirror(doc)
      },
    }),
    [render, interactive, gate],
  )

  return (
    <div ref={containerRef} className={className}>
      {effectiveScale > 0 && (
        <div
          style={{
            width: PAGE_WIDTH_PX * effectiveScale,
            height: contentHeight * effectiveScale,
            margin: '0 auto',
            position: 'relative',
          }}
        >
          <iframe
            ref={iframeRef}
            title={title ?? 'CV'}
            srcDoc={srcDoc}
            onLoad={() => setLoadCount((n) => n + 1)}
            // Betik çalışmaz (içerik yalnız dışarıdan yazılır); yazdırmak için allow-modals.
            sandbox="allow-same-origin allow-modals"
            tabIndex={interactive ? 0 : -1}
            style={{
              width: PAGE_WIDTH_PX,
              height: contentHeight,
              border: 0,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              inset: 0,
              background: 'transparent',
              colorScheme: 'light',
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          />
        </div>
      )}
    </div>
  )
})

/** Kayıt vurgusu (.is-focused) ve kabul sonrası kısa parlama (.sg-flash). */
function applyMarks(
  doc: Document,
  marks: { focusedItemId: string | null; flash: { ids: string[]; nonce: number } | null; flashDone: number },
  withFlash = true,
) {
  doc.querySelectorAll('.is-focused').forEach((el) => el.classList.remove('is-focused'))
  if (marks.focusedItemId) {
    doc.querySelectorAll(`[data-item-id="${CSS.escape(marks.focusedItemId)}"]`).forEach((el) => el.classList.add('is-focused'))
  }
  const flash = marks.flash
  if (!withFlash || !flash || flash.nonce === marks.flashDone) return
  const found = flash.ids.flatMap((id) =>
    Array.from(doc.querySelectorAll(id === 'personal' ? '[data-target="personal"].cv-header' : `[data-item-id="${CSS.escape(id)}"]`)),
  )
  // Kabul edilen değişiklik henüz çizilmediyse bir sonraki çizimde denenir.
  if (found.length === 0) return
  marks.flashDone = flash.nonce
  for (const el of found) {
    el.classList.remove('sg-flash')
    void (el as HTMLElement).offsetWidth
    el.classList.add('sg-flash')
  }
}

const GHOST_ID = 'cv-ghost'
const FADE_MS = 220

/**
 * Şablon geçişi: eski sayfaların kopyası, eski stilleriyle birlikte bir gölge
 * kökte (shadow DOM) yeni düzenin üstüne konur ve solarak kaybolur. Yeni
 * şablonun CSS'i kopyayı etkilemez; yazı tipleri belgeden gelir.
 */
function snapshotForCrossfade(doc: Document) {
  doc.getElementById(GHOST_ID)?.remove()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const host = doc.createElement('div')
  host.id = GHOST_ID
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  host.style.cssText = `position:absolute;inset:0 0 auto 0;z-index:10;pointer-events:none;opacity:1;transition:opacity ${FADE_MS}ms cubic-bezier(0.2,0.7,0.2,1)`
  if (shadowCopyOfPages(doc, host)) doc.body.append(host)
}

/**
 * Kopyayı soldurup kaldırır. Zamanlayıcılar üst pencereden kurulur: iframe betiksiz
 * sandbox olduğundan onun penceresindeki setTimeout/requestAnimationFrame hiç çalışmaz
 * ve kopya belgede kalırdı (yazdırınca fazladan boş sayfa).
 */
function fadeOutGhost(doc: Document) {
  const ghost = doc.getElementById(GHOST_ID)
  if (!ghost) return
  const started = Number(ghost.dataset.fadeStart)
  if (started) {
    // Önceki çizimden kalmış ve süresi geçmiş kopya: hemen kaldır.
    if (performance.now() - started > FADE_MS + 40) ghost.remove()
    return
  }
  ghost.dataset.fadeStart = String(performance.now())
  // Başlangıç opaklığı işlensin ki geçiş çalışsın.
  void ghost.offsetWidth
  ghost.style.opacity = '0'
  window.setTimeout(() => ghost.remove(), FADE_MS + 40)
}
