import type { PaginateResult } from './paginate'

/**
 * Bir CV belgesini çizer: önizleme iframe'i (CvFrame) ve sunucudaki Playwright sayfası aynı
 * fonksiyonu, aynı sırayla çağırır (önizleme = PDF):
 *
 *   1. stili yaz  →  2. yazı tiplerini bekle  →  3. HTML'i koy  →  4. sayfala
 *
 * Yazı tipleri ölçümden önce yüklenmeli; yoksa satır kırılımı sayfalamadan sonra değişir.
 * Belge `documentShell()` iskeletinde olmalı (#cv-styles, #cv-host, #cv-source, #cv-pages).
 *
 * React'e, depoya ve Vite'a bağlı değildir. Gövdesi yalnız parametrelerini ve çalıştığı ortamın
 * genel nesnelerini (setTimeout, Promise) kullanır, modül düzeyinde hiçbir şeye başvurmaz:
 * `toString()` ile bir tarayıcı sayfasına enjekte edilebilir (bkz. pageScript.ts). Buraya içe
 * aktarma (tür dışında), modül sabiti ya da dış yardımcı fonksiyon ekleme; pageScript.test.ts denetler.
 */

/** Yapısal kopyalanabilir (JSON) girdi: `page.evaluate` ile sayfaya olduğu gibi geçer. */
export interface DrawInput {
  /** CV dili (`<html lang>`): büyük harf dönüşümü ve heceleme buna göre yapılır */
  lang: string
  /** `cvStyles(cv)`: taban + şablon CSS'i + CV değişkenleri */
  styles: string
  /** `renderCvSource(cv, …)`: sayfalanacak kaynak HTML */
  html: string
  /** Yalnız barındıranın eklediği stil (#cv-host; önizlemede sayfa gölgesi ve aralığı). Sunucuda boş. */
  hostStyles?: string
  /** `document.fonts.load` sorguları: `cvFonts(...)` ailelerinin `fontLoadQueries`'i */
  fontQueries?: string[]
  /** Yazı tipleri en çok bu kadar beklenir (ms), sonra eldekiyle çizilir. Varsayılan 4000. */
  fontTimeoutMs?: number
  /** Önceki çizimin sayfa sayısı: yeni eklenen sayfa belirme animasyonu alır (yalnız önizleme) */
  previousPageCount?: number
}

export interface DrawDeps {
  /** `paginate.ts`'teki fonksiyon (bu dosya onu içe aktarmaz: enjekte edilebilir kalır) */
  paginate: (doc: Document, options?: { previousPageCount?: number }) => PaginateResult
  /** Yazı tipleri beklendikten sonra sorulur; false ise (daha yeni çizim başladı) belgeye dokunulmadan bırakılır */
  isCurrent?: () => boolean
  /** Zaman aşımından sonra geç gelen bir yazı tipi yüklendi: ölçüler değişti, yeniden çizilmeli */
  onLateFonts?: () => void
}

export interface DrawResult extends PaginateResult {
  /** Yazı tipleri zaman aşımına kadar yüklenmedi; çizim eldeki (yedek) yazı tipleriyle yapıldı */
  fontsTimedOut: boolean
}

/** Çizimi yapar; `isCurrent` false dönerse `null` (HTML konmadı, sayfalanmadı). */
export async function drawDocument(doc: Document, input: DrawInput, deps: DrawDeps): Promise<DrawResult | null> {
  const styleEl = doc.getElementById('cv-styles')
  const hostEl = doc.getElementById('cv-host')
  const source = doc.getElementById('cv-source')
  if (!styleEl || !hostEl || !source || !doc.getElementById('cv-pages')) throw new Error('CV belgesi iskeleti eksik')

  // 1. Stil (değişmediyse yeniden yazılmaz: stil sayfası yeniden ayrıştırılmasın)
  doc.documentElement.lang = input.lang
  if (styleEl.textContent !== input.styles) styleEl.textContent = input.styles
  const hostStyles = input.hostStyles ?? ''
  if (hostEl.textContent !== hostStyles) hostEl.textContent = hostStyles

  // 2. Yazı tipleri: hepsi yüklenene ya da süre dolana kadar. Takılan bir istek çizimi sonsuza
  // dek bekletmez; süre dolunca eldekiyle çizilir, geç gelen yazı tipi `onLateFonts` ile bildirilir.
  let fontsTimedOut = false
  const fonts = doc.fonts as FontFaceSet | undefined
  const queries = Array.from(new Set(input.fontQueries ?? []))
  if (fonts && queries.length > 0) {
    const settled = queries.map(() => false)
    const loads = queries.map((query, index) =>
      fonts.load(query, 'Aa ğüşıöçĞÜŞİÖÇ').then(
        (faces) => {
          settled[index] = true
          return faces.length > 0
        },
        () => {
          settled[index] = true
          return false
        },
      ),
    )
    let timer: ReturnType<typeof setTimeout> | undefined
    fontsTimedOut = await Promise.race([
      Promise.all(loads).then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), input.fontTimeoutMs ?? 4000)
      }),
    ])
    clearTimeout(timer)
    if (fontsTimedOut) {
      const late = deps.onLateFonts
      loads.forEach((load, index) => {
        if (settled[index] || !late) return
        void load.then((loaded) => {
          if (loaded) late()
        })
      })
    }
  }
  if (deps.isCurrent && !deps.isCurrent()) return null

  // 3. HTML  4. Sayfalama
  source.innerHTML = input.html
  const result = deps.paginate(doc, { previousPageCount: input.previousPageCount })
  return { ...result, fontsTimedOut }
}
