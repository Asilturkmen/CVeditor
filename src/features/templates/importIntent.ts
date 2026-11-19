/**
 * "Eski CV'ni içe aktar" başka sayfadan (CV'lerim boş durumu) istendiğinde Şablonlar sayfası
 * şablon sayfasını içe aktarma seçili açar. Yönlendirici arama parametresi yerine bir kerelik bayrak:
 * sayfa yenilenince unutulur (istenen davranış).
 */
let pending = false

export function requestImportStart() {
  pending = true
}

/** Bayrağı okur (StrictMode'da iki kez okunabilir); temizlemek için `clearImportStart`. */
export function peekImportStart(): boolean {
  return pending
}

export function clearImportStart() {
  pending = false
}
