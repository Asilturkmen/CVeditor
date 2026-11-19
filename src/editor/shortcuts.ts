/**
 * Editör kısayolları. Geri al/yinele için kural: odak CV'ye bağlı OLMAYAN bir metin alanındaysa
 * (yapay zekâ istek kutusu, bölüm adı değiştirme, arama…) tarayıcının kendi geri alı çalışır;
 * editör karışmaz. CV'ye bağlı alanlar `data-cv-form` taşıyan bir kapsayıcının içindedir
 * (İçerik/Görünüm paneli, CV adı). O kapsayıcının içinde olup kendi taslağını tutan giriş
 * (`data-native-undo`, ör. bölüm adı değiştirme kutusu) yine tarayıcıya bırakılır.
 */
export type EditorShortcut = 'undo' | 'redo' | 'print' | 'save'

/** CV formunu işaretleyen öznitelik: içindeki alanlarda Ctrl+Z CV'nin ortak geçmişini geri alır. */
export const CV_FORM_ATTR = 'data-cv-form'
/** CV formunun içinde olsa da kendi (tarayıcı) geri alını kullanan giriş. */
export const NATIVE_UNDO_ATTR = 'data-native-undo'

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'])

/** Olayın hedefi içine yazı yazılan bir alan mı (kendi geri alı olan)? */
function textField(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  const field = target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')
  if (!field) return null
  if (field instanceof HTMLInputElement && NON_TEXT_INPUTS.has(field.type)) return null
  return field
}

/** Geri al/yinele tarayıcıya mı bırakılmalı? */
export function usesNativeUndo(target: EventTarget | null): boolean {
  const field = textField(target)
  if (!field) return false
  return !field.closest(`[${CV_FORM_ATTR}]`) || !!field.closest(`[${NATIVE_UNDO_ATTR}]`)
}

interface ShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  target: EventTarget | null
  getModifierState?: (key: string) => boolean
}

/**
 * Tuş olayı hangi editör kısayolu? Değilse (ya da tarayıcıya bırakılacaksa) null.
 * AltGr (Windows'ta Ctrl+Alt olarak gelir; Türkçe klavyede @, €, ₺… bununla yazılır) kısayol sayılmaz.
 * `dialogOpen`: açık bir pencerede Ctrl+Z o pencerenin alanına aittir, arkadaki CV'ye değil.
 */
export function editorShortcut(e: ShortcutEvent, dialogOpen: boolean): EditorShortcut | null {
  if (!(e.ctrlKey || e.metaKey)) return null
  if (e.altKey || e.getModifierState?.('AltGraph')) return null
  const key = e.key.toLowerCase()
  if (key === 'z' || key === 'y') {
    if (dialogOpen || usesNativeUndo(e.target)) return null
    return key === 'z' && !e.shiftKey ? 'undo' : 'redo'
  }
  if (key === 'p') return 'print'
  if (key === 's') return 'save'
  return null
}
