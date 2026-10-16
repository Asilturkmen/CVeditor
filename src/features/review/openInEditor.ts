import type { useNavigate } from '@tanstack/react-router'
import { isItemEmpty } from '@/cv/factory'
import type { AnyItem, Cv, SectionType } from '@/cv/schema'
import { addItem, addSection } from '@/editor/actions'
import { useEditor } from '@/editor/store'
import { useEditorUi } from '@/editor/ui'
import type { FindingTarget } from '@/review/rules'

/** Editör hiç açılmazsa (ör. kullanıcı vazgeçti) dinleyici bu süreden sonra kalkar. */
const WAIT_MS = 15_000

/** Bekleyen tek istek: yeni "Düzenle" (ör. çift tıklama) öncekini iptal eder. */
let pending: (() => void) | null = null

/**
 * Bulgunun "Düzenle" bağlantısı: editörü açar, CV yüklenince ilgili kayda
 * (ya da kişisel bilgilere, eksik bölüme, Görünüm sekmesine) kaydırıp odaklar.
 * Editör açılışta arayüz durumunu sıfırladığı için odak, yükleme bittikten
 * sonra verilir.
 *
 * Yükleme, CV id'sinin değişmesiyle değil yükleme sayacıyla (`loads`) anlaşılır:
 * editörden çıkınca CV ancak kayıt bitince boşaltıldığından aynı CV hâlâ
 * yüklüyken yeniden yüklenebilir. Başka bir CV yüklenirse dinleyici kalkar.
 * Aynı anda tek istek bekler: yeni çağrı öncekinin dinleyicisini kaldırır
 * (çift tıklama iki kez bölüm eklemesin). Dönen fonksiyon dinleyiciyi elle
 * kaldırır.
 */
export function openInEditor(
  navigate: ReturnType<typeof useNavigate>,
  cvId: string,
  target: FindingTarget,
): () => void {
  pending?.()
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.loads === prev.loads) return
    done()
    if (state.cv?.id !== cvId) return
    const ui = useEditorUi.getState()
    const missing = target.addSection
    if (target.tab) ui.setTab(target.tab)
    else {
      const focusId = existingFocus(state.cv, target)
      if (focusId) ui.focusItem(focusId, true)
      // Eksik bölümü eklemek CV değişikliğidir: yükleme bildirimi bitince yapılır.
      else if (missing) queueMicrotask(() => addMissing(cvId, missing))
    }
  })
  const done = () => {
    unsubscribe()
    clearTimeout(timer)
    if (pending === done) pending = null
  }
  pending = done
  timer = setTimeout(done, WAIT_MS)
  void navigate({ to: '/editor/$cvId', params: { cvId } })
  return done
}

/** Var olan hedef kayıt: kişisel bilgiler, kayıt, bölümün (ya da o türde bölümün) ilk kaydı. */
function existingFocus(cv: Cv, target: FindingTarget): string | null {
  if (target.personal) return 'personal'
  if (target.itemId) return target.itemId
  const type = target.addSection
  const section = type ? cv.sections.find((s) => s.type === type) : cv.sections.find((s) => s.id === target.sectionId)
  return (section?.items as AnyItem[] | undefined)?.[0]?.id ?? null
}

/**
 * Eksik bölüm: o türde boş bölüm varsa ona ilk kayıt, yoksa bölüm (ilk
 * kaydıyla; özet en başa, diğerleri sona) eklenir ve kayda odaklanılır. Tek
 * geri alma adımıdır. Tekrar çağrılırsa ikinci kayıt eklenmez: bölümde kayıt
 * varsa (önce boş olanı) ona odaklanılır.
 */
export function addMissing(cvId: string, type: SectionType) {
  const cv = useEditor.getState().cv
  if (cv?.id !== cvId) return
  const section = cv.sections.find((s) => s.type === type)
  const items = (section?.items ?? []) as AnyItem[]
  let itemId: string | null
  if (items.length) itemId = (items.find(isItemEmpty) ?? items[0]).id
  else if (section) itemId = addItem(section.id)
  else {
    const id = addSection(type, type === 'summary' ? 0 : undefined)
    const added = useEditor.getState().cv?.sections.find((s) => s.id === id)
    itemId = (added?.items as AnyItem[] | undefined)?.[0]?.id ?? null
  }
  if (itemId) useEditorUi.getState().focusItem(itemId, true)
}
