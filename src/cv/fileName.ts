import { fileSafe } from '@/lib/download'
import type { Cv } from './schema'

/**
 * PDF dosyasının adı (uzantısız): "Ad_Soyad_CV_tr" ya da ad yoksa "CV_tr".
 * Tarayıcının yazdır penceresi (belge başlığı) ve sunucunun PDF'i aynı adı kullanır.
 * Saf fonksiyon: sunucu da içe aktarır.
 */
export function pdfBaseName(cv: Pick<Cv, 'personal' | 'language'>): string {
  const name = cv.personal.fullName.trim()
  return name ? `${fileSafe(name)}_CV_${cv.language}` : `CV_${cv.language}`
}
