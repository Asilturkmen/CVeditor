import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'
import { create } from 'zustand'
import type { Cv } from '@/cv/schema'
import { saveCv } from '@/db/repo'

enablePatches()

/**
 * Editör durumu. Her değişiklik Immer patch'i olarak geçmişe yazılır;
 * geri al/yinele ve yapay zekâ önerisinin toplu kabulü aynı modeli kullanır
 * (bir öneri grubunun kabulü = tek geri alma adımı).
 *
 * Yazarken her tuş ayrı adım olmasın diye aynı `coalesceKey` ile kısa sürede
 * gelen değişiklikler tek adımda birleşir.
 */

interface HistoryEntry {
  patches: Patch[]
  inverse: Patch[]
  key: string | null
  at: number
}

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

interface EditorState {
  cv: Cv | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  saveState: SaveState
  lastSavedAt: number | null
  /** Her load() çağrısında artar: aynı CV yeniden yüklense de yükleme fark edilir. */
  loads: number
  load: (cv: Cv) => void
  unload: (id?: string) => void
  update: (recipe: (draft: Draft<Cv>) => void, options?: { coalesceKey?: string }) => void
  undo: () => void
  redo: () => void
  flush: () => Promise<void>
}

const COALESCE_MS = 1200
const SAVE_DELAY_MS = 450
const HISTORY_LIMIT = 300

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useEditor = create<EditorState>((set, get) => {
  async function persist() {
    saveTimer = null
    const cv = get().cv
    if (!cv) return
    set({ saveState: 'saving' })
    try {
      await saveCv(cv)
      // Kayıt sürerken yeni değişiklik geldiyse "pending" kalır.
      if (get().cv === cv) set({ saveState: 'saved', lastSavedAt: Date.now() })
    } catch (error) {
      console.error(error)
      set({ saveState: 'error' })
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    set({ saveState: 'pending' })
    saveTimer = setTimeout(() => void persist(), SAVE_DELAY_MS)
  }

  function touch(cv: Cv): Cv {
    return { ...cv, updatedAt: new Date().toISOString() }
  }

  return {
    cv: null,
    past: [],
    future: [],
    saveState: 'saved',
    lastSavedAt: null,
    loads: 0,

    load(cv) {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
      set({ cv, past: [], future: [], saveState: 'saved', lastSavedAt: null, loads: get().loads + 1 })
    },

    unload(id) {
      // Başka bir CV yüklendiyse (editörden editöre geçiş) ona dokunma.
      if (id && get().cv?.id !== id) return
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = null
      set({ cv: null, past: [], future: [], saveState: 'saved' })
    },

    update(recipe, options = {}) {
      const current = get().cv
      if (!current) return
      const [next, patches, inverse] = produceWithPatches(current, recipe)
      if (patches.length === 0) return
      const now = Date.now()
      const key = options.coalesceKey ?? null
      const past = get().past
      const last = past[past.length - 1]
      let nextPast: HistoryEntry[]
      if (key && last && last.key === key && now - last.at < COALESCE_MS) {
        nextPast = [
          ...past.slice(0, -1),
          { patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse], key, at: now },
        ]
      } else {
        nextPast = [...past, { patches, inverse, key, at: now }].slice(-HISTORY_LIMIT)
      }
      set({ cv: touch(next), past: nextPast, future: [] })
      scheduleSave()
    },

    undo() {
      const { cv, past, future } = get()
      const entry = past[past.length - 1]
      if (!cv || !entry) return
      set({
        cv: touch(applyPatches(cv, entry.inverse)),
        past: past.slice(0, -1),
        future: [...future, { ...entry, key: null }],
      })
      scheduleSave()
    },

    redo() {
      const { cv, past, future } = get()
      const entry = future[future.length - 1]
      if (!cv || !entry) return
      set({
        cv: touch(applyPatches(cv, entry.patches)),
        past: [...past, { ...entry, key: null }],
        future: future.slice(0, -1),
      })
      scheduleSave()
    },

    async flush() {
      // Bekleyen kayıt ya da daha önce başarısız olan kayıt varsa şimdi yaz.
      if (saveTimer || get().saveState === 'error') {
        if (saveTimer) clearTimeout(saveTimer)
        await persist()
      }
    },
  }
})

/** Sayfa kapanırken bekleyen kaydı yaz. */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void useEditor.getState().flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void useEditor.getState().flush()
  })
}
