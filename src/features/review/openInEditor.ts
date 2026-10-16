import type { useNavigate } from '@tanstack/react-router'
import { useEditor } from '@/editor/store'
import { useEditorUi } from '@/editor/ui'
import type { FindingTarget } from '@/review/rules'

/** Editör hiç açılmazsa (ör. kullanıcı vazgeçti) dinleyici bu süreden sonra kalkar. */
const WAIT_MS = 15_000

/**
 * Bulgunun "Düzenle" bağlantısı: editörü açar, CV yüklenince ilgili kayda
 * (ya da kişisel bilgilere) kaydırıp odaklar. Editör açılışta arayüz durumunu
 * sıfırladığı için odak, yükleme bittikten sonra verilir.
 *
 * Yükleme, CV id'sinin değişmesiyle değil yükleme sayacıyla (`loads`) anlaşılır:
 * editörden çıkınca CV ancak kayıt bitince boşaltıldığından aynı CV hâlâ
 * yüklüyken yeniden yüklenebilir. Başka bir CV yüklenirse dinleyici kalkar.
 * Dönen fonksiyon dinleyiciyi elle kaldırır.
 */
export function openInEditor(
  navigate: ReturnType<typeof useNavigate>,
  cvId: string,
  target: FindingTarget,
): () => void {
  const focusId = target.personal ? 'personal' : (target.itemId ?? null)
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.loads === prev.loads) return
    done()
    if (state.cv?.id !== cvId) return
    const ui = useEditorUi.getState()
    if (target.tab) ui.setTab(target.tab)
    else if (focusId) ui.focusItem(focusId, true)
  })
  const done = () => {
    unsubscribe()
    clearTimeout(timer)
  }
  timer = setTimeout(done, WAIT_MS)
  void navigate({ to: '/editor/$cvId', params: { cvId } })
  return done
}
