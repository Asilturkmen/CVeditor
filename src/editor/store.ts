import { liveQuery } from 'dexie'
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'
import { create } from 'zustand'
import { migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { getCv, saveCv, saveCvIfUnchanged, versionOf } from '@/db/repo'
import { nextTimestamp } from '@/lib/time'

enablePatches()

/**
 * Editör durumu. Her değişiklik Immer patch'i olarak geçmişe yazılır;
 * geri al/yinele ve yapay zekâ önerisinin toplu kabulü aynı modeli kullanır
 * (bir öneri grubunun kabulü = tek geri alma adımı).
 *
 * Yazarken her tuş ayrı adım olmasın diye aynı `coalesceKey` ile kısa sürede
 * gelen değişiklikler tek adımda birleşir.
 *
 * KAYIT VE İKİ SEKME. CV yalnız bu tarayıcıda durur; sessiz veri kaybı en ağır hatadır.
 * - Kayıt, bu sekmenin son okuduğu/yazdığı sürümle (`updatedAt`) veritabanındaki satırı tek
 *   işlemde karşılaştırır (`saveCvIfUnchanged`). Uyuşmuyorsa YAZMAZ: `saveState: 'conflict'`,
 *   `conflict` nedeni taşır ('changed' = başka sekme yazdı, 'deleted' = başka sekme sildi).
 * - Açık CV'nin satırı izlenir (Dexie `liveQuery`, sekmeler arası). Bu sekmede bekleyen değişiklik
 *   yokken başka sekmeden gelen değişiklik kendiliğinden yüklenir (geri alma geçmişi sıfırlanır,
 *   `remoteLoads` artar). Bekleyen değişiklik varsa çakışma bildirilir; kullanıcı seçer
 *   (`resolveConflict`).
 * - `flush` sonucu bildirir; kayıt başarısızsa çağıran (editörden çıkış, Ctrl+S) bunu bilir.
 */

interface HistoryEntry {
  patches: Patch[]
  inverse: Patch[]
  key: string | null
  at: number
}

export type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict'

/** Çakışmanın nedeni: başka sekme CV'yi değiştirdi ya da sildi. */
export type SaveConflict = 'changed' | 'deleted'

export type FlushResult = { ok: true } | { ok: false; reason: 'error' | 'conflict' }

const OK: FlushResult = { ok: true }
const FAILED: FlushResult = { ok: false, reason: 'error' }
const CONFLICT: FlushResult = { ok: false, reason: 'conflict' }

interface EditorState {
  cv: Cv | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  saveState: SaveState
  /** `saveState === 'conflict'` iken neden; değilse null */
  conflict: SaveConflict | null
  lastSavedAt: number | null
  /** Her load() çağrısında artar: aynı CV yeniden yüklense de yükleme fark edilir. */
  loads: number
  /** Başka sekmedeki değişikliğin kendiliğinden yüklenme sayısı (arayüz haber verir); load() sıfırlar. */
  remoteLoads: number
  /**
   * CV'yi editöre yükler. `storedVersion`: veritabanından okunan satırın sürümü (`versionOf(row)`);
   * verilmezse CV henüz kayıtlı değil sayılır (ilk kayıt satırı oluşturur; satır zaten varsa
   * üzerine yazılmaz, çakışma bildirilir).
   */
  load: (cv: Cv, storedVersion?: string | null) => void
  unload: (id?: string) => void
  /**
   * `coalesceKey`: aynı anahtarla `coalesceMs` (varsayılan 1,2 sn) içinde gelen değişiklik önceki
   * adımla birleşir. Bir etkileşime özgü anahtar (ör. renk seçicinin tek açılışı) `Infinity` ile
   * aradaki duraklamadan bağımsız tek adım olur.
   */
  update: (recipe: (draft: Draft<Cv>) => void, options?: { coalesceKey?: string; coalesceMs?: number }) => void
  undo: () => void
  redo: () => void
  /** Bekleyen (ya da daha önce başarısız olan) kaydı şimdi yazar ve sonucu bildirir. Asla reddetmez. */
  flush: () => Promise<FlushResult>
  /**
   * Çakışmayı çözer. 'mine': bu sekmedeki CV veritabanına yazılır (diğer sekmenin yazdığının üzerine;
   * silinmişse yeniden kaydedilir). 'theirs': veritabanındaki sürüm yüklenir, bu sekmedeki
   * kaydedilmemiş değişiklikler ve geri alma geçmişi bırakılır.
   */
  resolveConflict: (choice: 'mine' | 'theirs') => Promise<FlushResult>
}

const COALESCE_MS = 1200
const SAVE_DELAY_MS = 450
const HISTORY_LIMIT = 300
/** Bu sekmenin yazdığı son sürümler: gecikmiş kendi bildirimimiz "başka sekme yazdı" sanılmasın. */
const OWN_WRITES_LIMIT = 64

let saveTimer: ReturnType<typeof setTimeout> | null = null
/** Veritabanındaki satırın, bu sekmenin bildiği sürümü (null = satır yok). */
let base: string | null = null
/** Her load/unload'da artar: süren kayıt ve izleme eski CV'nin durumuna dokunmasın. */
let session = 0
let inflight: Promise<FlushResult> | null = null
let stopWatching: (() => void) | null = null
const ownWrites = new Set<string>()

function rememberOwnWrite(version: string) {
  ownWrites.add(version)
  if (ownWrites.size > OWN_WRITES_LIMIT) ownWrites.delete(ownWrites.values().next().value!)
}

function cancelTimer() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
}

export const useEditor = create<EditorState>((set, get) => {
  /** Tek kayıt: sürüm uyuşuyorsa yazar. Hiçbir zaman reddetmez. */
  async function write(): Promise<FlushResult> {
    const mine = session
    const state = get()
    const cv = state.cv
    if (!cv) return OK
    if (state.saveState === 'conflict') return CONFLICT
    if (cv.updatedAt === base) {
      if (state.saveState !== 'saved') set({ saveState: 'saved' })
      return OK
    }
    set({ saveState: 'saving' })
    rememberOwnWrite(cv.updatedAt)
    try {
      const outcome = await saveCvIfUnchanged(cv, base)
      // Editör bu arada başka CV'ye geçtiyse (ya da kapandıysa) onun durumuna dokunma.
      if (mine !== session) return outcome.ok ? OK : CONFLICT
      if (!outcome.ok) {
        cancelTimer()
        set({ saveState: 'conflict', conflict: outcome.reason })
        return CONFLICT
      }
      base = cv.updatedAt
      // Kayıt sürerken yeni değişiklik geldiyse "pending" kalır.
      if (get().cv === cv) set({ saveState: 'saved', lastSavedAt: Date.now() })
      return OK
    } catch (error) {
      console.error(error)
      if (mine === session) set({ saveState: 'error' })
      return FAILED
    }
  }

  /** Kayıtlar sıraya girer: ikinci kayıt, birincinin yazdığı sürümü bilmeden karşılaştırma yapmasın. */
  function persist(): Promise<FlushResult> {
    cancelTimer()
    const previous = inflight ?? Promise.resolve(OK)
    const run: Promise<FlushResult> = previous.then(write, write).finally(() => {
      if (inflight === run) inflight = null
    })
    inflight = run
    return run
  }

  function scheduleSave() {
    cancelTimer()
    // Çakışma çözülmeden yazılmaz; değişiklik bellekte kalır.
    if (get().saveState === 'conflict') return
    set({ saveState: 'pending' })
    saveTimer = setTimeout(() => void persist(), SAVE_DELAY_MS)
  }

  function touch(cv: Cv): Cv {
    return { ...cv, updatedAt: nextTimestamp(cv.updatedAt) }
  }

  /** Veritabanındaki satırı editöre alır (başka sekmenin yazdığı sürüm). Okunamıyorsa false. */
  function adopt(row: unknown): boolean {
    let next: Cv
    try {
      next = migrateCv(row)
    } catch (error) {
      console.error(error)
      return false
    }
    cancelTimer()
    base = versionOf(row)
    set((s) => ({ cv: next, past: [], future: [], saveState: 'saved', conflict: null, remoteLoads: s.remoteLoads + 1 }))
    return true
  }

  /** İzlenen satır değişti (bu sekme ya da başka sekme yazdı/sildi). */
  function onStored(mine: number, row: unknown) {
    if (mine !== session) return
    const state = get()
    const cv = state.cv
    if (!cv) return
    const version = versionOf(row)
    if (version === base) {
      // Veritabanı bildiğimiz sürümde. Çakışma kendiliğinden kalktıysa (ör. diğer sekme silmeyi geri aldı) normale dön.
      if (state.saveState === 'conflict') {
        if (cv.updatedAt === base) set({ saveState: 'saved', conflict: null })
        else {
          set({ conflict: null, saveState: 'pending' })
          scheduleSave()
        }
      }
      return
    }
    // Kendi yazdığımızın (gecikmiş ya da henüz `base`e işlenmemiş) bildirimi.
    if (version !== null && ownWrites.has(version)) return
    if (state.saveState === 'saving' && inflight) {
      // Süren kayıt bitince yeniden bak: sonucu o belirler.
      void inflight.then(() => (mine === session ? getCv(cv.id) : undefined)).then(
        (fresh) => mine === session && get().saveState !== 'saving' && onStored(mine, fresh),
        (error) => console.error(error),
      )
      return
    }
    if (row && state.saveState === 'saved' && adopt(row)) return
    cancelTimer()
    set({ saveState: 'conflict', conflict: row ? 'changed' : 'deleted' })
  }

  function watch(id: string) {
    stopWatching?.()
    stopWatching = null
    if (typeof indexedDB === 'undefined') return
    const mine = session
    const subscription = liveQuery(() => db.cvs.get(id)).subscribe({
      next: (row) => onStored(mine, row),
      // Okuma hatası kaydı etkilemez; kayıt denemesi kendi hatasını bildirir.
      error: (error) => console.error(error),
    })
    stopWatching = () => subscription.unsubscribe()
  }

  return {
    cv: null,
    past: [],
    future: [],
    saveState: 'saved',
    conflict: null,
    lastSavedAt: null,
    loads: 0,
    remoteLoads: 0,

    load(cv, storedVersion = null) {
      cancelTimer()
      session++
      base = storedVersion
      ownWrites.clear()
      set({
        cv,
        past: [],
        future: [],
        saveState: 'saved',
        conflict: null,
        lastSavedAt: null,
        loads: get().loads + 1,
        remoteLoads: 0,
      })
      watch(cv.id)
    },

    unload(id) {
      // Başka bir CV yüklendiyse (editörden editöre geçiş) ona dokunma.
      if (id && get().cv?.id !== id) return
      cancelTimer()
      session++
      base = null
      ownWrites.clear()
      stopWatching?.()
      stopWatching = null
      set({ cv: null, past: [], future: [], saveState: 'saved', conflict: null })
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
      if (key && last && last.key === key && now - last.at < (options.coalesceMs ?? COALESCE_MS)) {
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
      const state = get()
      if (!state.cv) return inflight ?? OK
      if (state.saveState === 'conflict') return CONFLICT
      // Bekleyen kayıt ya da daha önce başarısız olan kayıt varsa şimdi yaz.
      if (saveTimer || state.saveState === 'pending' || state.saveState === 'error') return persist()
      return inflight ?? OK
    },

    async resolveConflict(choice) {
      const mine = session
      if (!get().cv || get().saveState !== 'conflict') return OK
      try {
        if (inflight) await inflight
        if (mine !== session) return OK
        const cv = get().cv!
        if (choice === 'mine') {
          // Kullanıcı açıkça seçti: sürüm karşılaştırmadan yazılır.
          rememberOwnWrite(cv.updatedAt)
          await saveCv(cv)
          if (mine !== session) return OK
          base = cv.updatedAt
          if (get().cv === cv) set({ saveState: 'saved', conflict: null, lastSavedAt: Date.now() })
          else {
            set({ conflict: null, saveState: 'pending' })
            scheduleSave()
          }
          return OK
        }
        const row = await getCv(cv.id)
        if (mine !== session) return OK
        if (!row) {
          set({ saveState: 'conflict', conflict: 'deleted' })
          return CONFLICT
        }
        return adopt(row) ? OK : FAILED
      } catch (error) {
        console.error(error)
        return FAILED
      }
    },
  }
})

/** Kaydedilmemiş değişiklik var mı (bekliyor, yazılıyor, yazılamadı ya da çakıştı)? */
export function hasUnsavedChanges(): boolean {
  const state = useEditor.getState()
  return !!state.cv && state.saveState !== 'saved'
}

/** Sayfa kapanırken bekleyen kaydı yaz; yazılamamış değişiklik varsa tarayıcı çıkmadan önce sorsun. */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void useEditor.getState().flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void useEditor.getState().flush()
  })
  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedChanges()) return
    void useEditor.getState().flush()
    event.preventDefault()
    // Eski tarayıcılar uyarıyı yalnız returnValue doluysa gösterir.
    event.returnValue = ''
  })
}
