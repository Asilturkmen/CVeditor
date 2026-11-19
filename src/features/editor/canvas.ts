import { create } from 'zustand'

/**
 * Tuvalin (önizleme alanı) paylaşılan durumu: sığdırma kipi, görünen sayfa, sayfaya gitme isteği ve
 * son çizimin sayacı. Sol raydaki sayfa küçük resimleri ve alt ortadaki hap bunu okur.
 * Kaydedilmez (yalnız sığdırma seçimi tarayıcıda hatırlanır).
 */

export type FitMode = 'page' | 'width'

const FIT_KEY = 'cveditor:fitMode'

function readFitMode(): FitMode | null {
  try {
    const value = localStorage.getItem(FIT_KEY)
    return value === 'page' || value === 'width' ? value : null
  } catch {
    return null
  }
}

interface CanvasState {
  /** Kullanıcının seçtiği sığdırma; null = cihazın varsayılanı (masaüstünde sayfa, telefonda genişlik) */
  fitMode: FitMode | null
  setFitMode: (mode: FitMode) => void
  /** Tuvalde görünen sayfa (1'den) */
  currentPage: number
  setCurrentPage: (page: number) => void
  /** Sayfaya git isteği (raydan ya da haptan); nonce aynı sayfaya yeniden gitmeyi sağlar */
  pageRequest: { page: number; nonce: number } | null
  goToPage: (page: number) => void
  /** Önizleme her çizimi bitirdiğinde artar (ray küçük resimleri yeniden kopyalar) */
  drawn: number
  markDrawn: () => void
}

let nonce = 0

export const useCanvas = create<CanvasState>((set) => ({
  fitMode: readFitMode(),
  setFitMode: (fitMode) => {
    try {
      localStorage.setItem(FIT_KEY, fitMode)
    } catch {
      // yalnız bu oturumda kalır
    }
    set({ fitMode })
  },
  currentPage: 1,
  setCurrentPage: (currentPage) => set((s) => (s.currentPage === currentPage ? {} : { currentPage })),
  pageRequest: null,
  goToPage: (page) => set({ pageRequest: { page, nonce: ++nonce } }),
  drawn: 0,
  markDrawn: () => set((s) => ({ drawn: s.drawn + 1 })),
}))

/** Editördeki canlı önizlemenin belgesi (sayfa küçük resimleri ondan kopyalanır). */
export function previewDocument(): Document | null {
  return document.querySelector<HTMLIFrameElement>('[data-preview-scroll] iframe')?.contentDocument ?? null
}
