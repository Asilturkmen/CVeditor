import { afterEach, describe, expect, it } from 'vitest'
import { CV_FORM_ATTR, editorShortcut, NATIVE_UNDO_ATTR, usesNativeUndo } from './shortcuts'
import { useEditorUi } from './ui'

/** Editör düzeninin iskeleti: CV formu (panel), onun dışında istek kutusu. */
function mount() {
  document.body.innerHTML = `
    <input id="cv-name" ${CV_FORM_ATTR} />
    <div ${CV_FORM_ATTR}>
      <input id="cv-field" />
      <input id="cv-color" type="color" />
      <div id="cv-rich" contenteditable="true"><p id="cv-rich-p">metin</p></div>
      <input id="rename" ${NATIVE_UNDO_ATTR} />
      <button id="cv-button">düğme</button>
    </div>
    <textarea id="prompt"></textarea>
    <input id="search" type="search" />
    <input id="outside-checkbox" type="checkbox" />
    <button id="outside-button">düğme</button>
  `
  return (id: string) => document.getElementById(id)!
}

const key = (target: EventTarget | null, init: Partial<Parameters<typeof editorShortcut>[0]> = {}) => ({
  key: 'z',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target,
  ...init,
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('editör kısayolları', () => {
  it('CV\'ye bağlı alanlarda Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z CV\'nin geçmişidir', () => {
    const el = mount()
    for (const id of ['cv-name', 'cv-field', 'cv-color', 'cv-rich-p', 'cv-button']) {
      expect(editorShortcut(key(el(id)), false), id).toBe('undo')
      expect(editorShortcut(key(el(id), { key: 'y' }), false), id).toBe('redo')
      expect(editorShortcut(key(el(id), { key: 'Z', shiftKey: true }), false), id).toBe('redo')
    }
    // Odak hiçbir alanda değilken (gövde) ve Mac'te Cmd ile de CV geri alınır.
    expect(editorShortcut(key(document.body), false)).toBe('undo')
    expect(editorShortcut(key(el('cv-field'), { ctrlKey: false, metaKey: true }), false)).toBe('undo')
  })

  it('CV\'ye bağlı olmayan metin alanında tarayıcının kendi geri alı çalışır (CV geri alınmaz)', () => {
    const el = mount()
    for (const id of ['prompt', 'search', 'rename']) {
      expect(usesNativeUndo(el(id)), id).toBe(true)
      expect(editorShortcut(key(el(id)), false), id).toBeNull()
      expect(editorShortcut(key(el(id), { key: 'y' }), false), id).toBeNull()
      expect(editorShortcut(key(el(id), { shiftKey: true }), false), id).toBeNull()
    }
    // Metin alanı olmayan öğeler (düğme, onay kutusu) form dışında da CV'yi geri alır.
    expect(editorShortcut(key(el('outside-button')), false)).toBe('undo')
    expect(editorShortcut(key(el('outside-checkbox')), false)).toBe('undo')
  })

  it('açık pencerede Ctrl+Z arkadaki CV\'ye gitmez; Ctrl+S ve Ctrl+P her yerde çalışır', () => {
    const el = mount()
    expect(editorShortcut(key(el('cv-field')), true)).toBeNull()
    expect(editorShortcut(key(el('prompt'), { key: 's' }), false)).toBe('save')
    expect(editorShortcut(key(el('prompt'), { key: 'P' }), true)).toBe('print')
  })

  it('AltGr (Ctrl+Alt) kısayol sayılmaz', () => {
    const el = mount()
    for (const k of ['z', 'y', 's', 'p', 'q']) {
      expect(editorShortcut(key(el('cv-field'), { key: k, altKey: true }), false), k).toBeNull()
      expect(editorShortcut(key(el('cv-field'), { key: k, getModifierState: (name) => name === 'AltGraph' }), false), k).toBeNull()
    }
    // Değiştirici tuş yoksa ya da başka bir harfse kısayol değildir.
    expect(editorShortcut(key(el('cv-field'), { ctrlKey: false }), false)).toBeNull()
    expect(editorShortcut(key(el('cv-field'), { key: 'a' }), false)).toBeNull()
  })
})

describe('kaydırma hedefi', () => {
  it('bir kez tüketilir; arada gelen yeni hedef eski tüketimle silinmez', () => {
    const ui = () => useEditorUi.getState()
    ui().reset()
    ui().focusItem('a', true)
    const first = ui().scrollTarget!
    expect(first.id).toBe('a')
    ui().consumeScrollTarget(first.nonce)
    expect(ui().scrollTarget).toBeNull()
    // Sekme değiştirip dönmek hedefi geri getirmez.
    ui().setTab('appearance')
    ui().setTab('content')
    expect(ui().scrollTarget).toBeNull()

    // Aynı kayda yeniden kaydırma isteği yeni bir hedeftir.
    ui().focusItem('a', true)
    const second = ui().scrollTarget!
    expect(second.nonce).not.toBe(first.nonce)
    ui().focusItem('b', true)
    ui().consumeScrollTarget(second.nonce)
    expect(ui().scrollTarget?.id).toBe('b')
    // Kaydırmasız odak hedef üretmez.
    ui().consumeScrollTarget(ui().scrollTarget!.nonce)
    ui().focusItem('c')
    expect(ui().scrollTarget).toBeNull()
  })
})
