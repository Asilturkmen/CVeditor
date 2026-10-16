import { duplicateCv } from '@/cv/factory'
import { toJsonResume } from '@/cv/jsonResume'
import { createBackup } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { deleteCv, META_LAST_BACKUP, saveCv, setMeta } from '@/db/repo'
import { toast } from '@/components/ui/Toaster'
import { downloadText, fileSafe, todayStamp } from '@/lib/download'
import { m } from '@/paraglide/messages'

/** CV silme: sayfa içi onaydan sonra çağrılır; kısa süre "Geri al" sunar. */
export async function deleteWithUndo(cv: Cv) {
  const removed = await deleteCv(cv.id)
  if (!removed) return
  toast({
    message: m.toast_deleted({ name: cv.name }),
    action: { label: m.common_undo(), run: () => void saveCv(removed) },
  })
}

export async function duplicate(cv: Cv): Promise<Cv> {
  const copy = duplicateCv(cv, { name: m.cv_copy_name({ name: cv.name }) })
  await saveCv(copy)
  toast({ message: m.toast_duplicated({ name: copy.name }) })
  return copy
}

export async function rename(cv: Cv, name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed === cv.name) return
  await db.cvs.update(cv.id, { name: trimmed, updatedAt: new Date().toISOString() })
}

export function exportCvJson(cv: Cv) {
  downloadText(`${fileSafe(cv.name)}.cveditor.json`, JSON.stringify(createBackup([cv]), null, 2))
}

/** jsonresume.org biçiminde dışa aktarım (başka araçlarda ve yeniden içe aktarmada kullanılır) */
export function exportJsonResume(cv: Cv) {
  downloadText(`${fileSafe(cv.name)}.resume.json`, JSON.stringify(toJsonResume(cv), null, 2))
}

export async function exportAllJson(cvs: Cv[]) {
  downloadText(`cveditor-yedek-${todayStamp()}.json`, JSON.stringify(createBackup(cvs), null, 2))
  await setMeta(META_LAST_BACKUP, new Date().toISOString())
  toast({ message: m.toast_backup_done({ count: cvs.length }) })
}

/** PDF / yazdırma için dosya adı: "Ad_Soyad_CV_tr" ya da "CV_tr" */
export function printTitle(cv: Cv): string {
  const name = cv.personal.fullName.trim()
  return name ? `${fileSafe(name)}_CV_${cv.language}` : `CV_${cv.language}`
}
