import { ImagePlus, Trash2 } from 'lucide-react'
import { useCallback, useId, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Switch } from '@/components/ui/Switch'
import { toast } from '@/components/ui/toast'
import { setPersonal, setPhoto, setTemplateSetting } from '@/editor/actions'
import { useEditor } from '@/editor/store'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { PickerContext, safePhoto, usePhotoPicker } from './photoContext'

/** Fotoğrafı küçültüp kare JPEG data URL'e çevirir (CV verisi küçük kalsın). */
async function resizePhoto(file: File, max = 480): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  // Kareye kırp: CV fotoğrafı kare/daire çizilir.
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.round(side * scale)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.86)
}

async function applyPhotoFile(file: File | undefined) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast({ message: m.photo_not_image(), tone: 'error' })
    return
  }
  try {
    // Tek geri alma adımı: Ctrl+Z fotoğrafı ve açılan gösterimi birlikte geri alır.
    if (setPhoto(await resizePhoto(file))) toast({ message: m.photo_shown_toast() })
  } catch {
    toast({ message: m.photo_failed(), tone: 'error' })
  }
}


/**
 * Panelde TEK dosya girişi: Kişisel bilgiler satırı kapalıyken de, İçerik ve Görünüm'deki fotoğraf
 * satırları da aynı girişi açar (sayfada iki `input[type=file]` olmaz).
 */
export function PhotoPickerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  const open = useCallback(() => ref.current?.click(), [])
  return (
    <PickerContext.Provider value={open}>
      {children}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void applyPhotoFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </PickerContext.Provider>
  )
}

export function PhotoThumb({ photo, size = 32, alt }: { photo: string | null; size?: number; alt?: string }) {
  const style = { width: size, height: size }
  if (photo) return <img src={photo} alt={alt ?? ''} style={style} className="shrink-0 rounded-full object-cover" />
  return (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded-full bg-fill-3 text-fg-2">
      <ImagePlus className="size-4" />
    </span>
  )
}

/**
 * Fotoğraf satırı (İçerik'te Kişisel bilgiler, Görünüm'de Fotoğraf): küçük resim, durum cümlesi,
 * Yükle/Değiştir, kaldır ve "CV'de göster" anahtarı. İki sekmede aynı bileşen.
 */
export function PhotoRow({ className }: { className?: string }) {
  const photoRaw = useEditor((s) => s.cv?.personal.photo ?? null)
  const showPhoto = useEditor((s) => s.cv?.template.showPhoto ?? false)
  const pick = usePhotoPicker()
  const photo = safePhoto(photoRaw)
  const switchId = useId()
  return (
    <div className={cn('px-[var(--row-px)] py-2', className)}>
      <div className="flex min-h-10 items-center gap-3">
        <PhotoThumb photo={photo} size={32} alt={m.photo_alt()} />
        <span className="min-w-0 flex-1 text-body text-fg">{m.photo_title()}</span>
        <div className="flex shrink-0 items-center gap-1">
          {photoRaw && <IconButton label={m.photo_remove()} icon={<Trash2 />} onClick={() => setPersonal('photo', null)} />}
          <Button onClick={pick}>{photoRaw ? m.photo_change() : m.photo_upload()}</Button>
        </div>
        <span aria-hidden className="h-5 w-px shrink-0 bg-separator" />
        <label htmlFor={switchId} className="flex shrink-0 cursor-pointer items-center gap-2 text-body text-fg">
          {m.photo_show_short()}
          <Switch
            id={switchId}
            checked={showPhoto}
            onCheckedChange={(v) => setTemplateSetting('showPhoto', v)}
            aria-label={m.ap_photo_show()}
          />
        </label>
      </div>
      {!photoRaw && <p className="pb-1 pl-11 text-callout text-fg-2">{m.photo_hint()} {m.photo_none_note()}</p>}
    </div>
  )
}
