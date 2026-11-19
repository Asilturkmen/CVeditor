import { duplicateCv } from '@/cv/factory'
import { pdfBaseName } from '@/cv/fileName'
import { createBackup, describeCvError, migrateCv } from '@/cv/migrate'
import type { Cv } from '@/cv/schema'
import { db } from '@/db/db'
import { allCvs, deleteCv, META_LAST_BACKUP, restoreCv, saveCv, setMeta } from '@/db/repo'
import { toast } from '@/components/ui/toast'
import { downloadText, fileSafe, todayStamp } from '@/lib/download'
import { nextTimestamp } from '@/lib/time'
import { m } from '@/paraglide/messages'

/**
 * Veritabanı işlemi başarısız olursa hata yutulmaz: ayrıntı konsola, kullanıcıya sakin bir bildirim.
 * (Depolama dolu, veritabanı başka sekmede yükseltiliyor, gizli pencere kısıtı…)
 */
function reportFailure(error: unknown, message: string) {
  console.error(error)
  toast({ message, tone: 'error' })
}

/** Silinen CV'yi geri getirir; olmazsa kullanıcı CV'yi dosya olarak kurtarabilir. */
async function undoDelete(removed: Cv) {
  try {
    await restoreCv(removed)
  } catch (error) {
    console.error(error)
    toast({
      message: m.err_undo_delete({ name: removed.name }),
      tone: 'error',
      duration: Infinity,
      action: { label: m.err_download_copy(), run: () => exportCvJson(removed) },
    })
  }
}

/** CV silme: sayfa içi onaydan sonra çağrılır; kısa süre "Geri al" sunar. Silindiyse true. */
export async function deleteWithUndo(cv: Cv): Promise<boolean> {
  let removed: Cv | undefined
  try {
    removed = await deleteCv(cv.id)
  } catch (error) {
    reportFailure(error, m.err_delete({ name: cv.name }))
    return false
  }
  if (!removed) return true
  const snapshot = removed
  toast({
    message: m.toast_deleted({ name: cv.name }),
    action: { label: m.common_undo(), run: () => void undoDelete(snapshot) },
  })
  return true
}

/** CV'nin kopyasını oluşturur; kaydedilemezse bildirir ve null döner. */
export async function duplicate(cv: Cv): Promise<Cv | null> {
  // Listeden gelen CV veritabanındaki ham satırdır: kopya, editörün okuduğu (yükseltilmiş, onarılmış) hâlden alınır.
  let source: Cv
  try {
    source = migrateCv(cv)
  } catch (error) {
    reportFailure(error, describeCvError(error))
    return null
  }
  const copy = duplicateCv(source, { name: m.cv_copy_name({ name: source.name }) })
  try {
    await saveCv(copy)
  } catch (error) {
    reportFailure(error, m.err_storage_write())
    return null
  }
  toast({ message: m.toast_duplicated({ name: copy.name }) })
  return copy
}

/** Yeniden adlandırır; kaydedilemezse bildirir ve false döner (pencere açık kalsın). */
export async function rename(cv: Cv, name: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed || trimmed === cv.name) return true
  try {
    await db.cvs.update(cv.id, { name: trimmed, updatedAt: nextTimestamp(cv.updatedAt) })
    return true
  } catch (error) {
    reportFailure(error, m.err_storage_write())
    return false
  }
}

export function exportCvJson(cv: Cv) {
  downloadText(`${fileSafe(cv.name)}.cveditor.json`, JSON.stringify(createBackup([cv]), null, 2))
}

/** Okunamayan kaydın ham hâli: kullanıcı verisine ulaşabilsin (yedek biçiminde değil, olduğu gibi). */
export function exportRawJson(raw: unknown, name = 'cv') {
  downloadText(`${fileSafe(name)}.ham.json`, JSON.stringify(raw, null, 2))
}

export async function exportAllJson(cvs: Cv[]) {
  downloadText(`cveditor-yedek-${todayStamp()}.json`, JSON.stringify(createBackup(cvs), null, 2))
  try {
    await setMeta(META_LAST_BACKUP, new Date().toISOString())
  } catch (error) {
    // Dosya indi; yalnız "son yedek" tarihi yazılamadı.
    console.error(error)
  }
  toast({ message: m.toast_backup_done({ count: cvs.length }) })
}

/** Hata ekranındaki "Yedek al": CV'leri veritabanından okuyup indirir. Olmadıysa false. */
export async function backupEverything(): Promise<boolean> {
  try {
    await exportAllJson(await allCvs())
    return true
  } catch (error) {
    reportFailure(error, m.err_backup())
    return false
  }
}

/** PDF / yazdırma için dosya adı: "Ad_Soyad_CV_tr" ya da "CV_tr" */
export function printTitle(cv: Cv): string {
  return pdfBaseName(cv)
}
