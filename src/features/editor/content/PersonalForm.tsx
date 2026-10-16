import { ImagePlus, Trash2 } from 'lucide-react'
import { memo, useRef } from 'react'
import type { Personal } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/toast'
import { setPersonal, setPhoto } from '@/editor/actions'
import { m } from '@/paraglide/messages'

const FIELDS: { key: Exclude<keyof Personal, 'photo'>; type: string; label: () => string; placeholder: () => string; autoComplete?: string }[] = [
  { key: 'fullName', type: 'text', label: () => m.f_full_name(), placeholder: () => m.ph_full_name(), autoComplete: 'name' },
  { key: 'headline', type: 'text', label: () => m.f_headline(), placeholder: () => m.ph_headline() },
  { key: 'email', type: 'email', label: () => m.f_email(), placeholder: () => m.ph_email(), autoComplete: 'email' },
  { key: 'phone', type: 'tel', label: () => m.f_phone(), placeholder: () => m.ph_phone(), autoComplete: 'tel' },
  { key: 'location', type: 'text', label: () => m.f_location(), placeholder: () => m.ph_city() },
  { key: 'website', type: 'url', label: () => m.f_website(), placeholder: () => m.ph_website() },
  { key: 'linkedin', type: 'text', label: () => m.f_linkedin(), placeholder: () => m.ph_linkedin() },
  { key: 'github', type: 'text', label: () => m.f_github(), placeholder: () => m.ph_github() },
]

/** Fotoğrafı küçültüp JPEG data URL'e çevirir (CV verisi küçük kalsın). */
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

export const PersonalForm = memo(function PersonalForm({ personal, showPhoto }: { personal: Personal; showPhoto: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const onPhoto = async (file: File | undefined) => {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label()}>
            {(id) => (
              <Input
                id={id}
                type={f.type}
                autoComplete={f.autoComplete ?? 'off'}
                value={personal[f.key]}
                placeholder={f.placeholder()}
                onChange={(e) => setPersonal(f.key, e.target.value)}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-2.5">
        {personal.photo ? (
          <img src={personal.photo} alt={m.photo_alt()} className="size-10 rounded-full object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-faint">
            <ImagePlus className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-medium">{m.photo_title()}</p>
          <p className="text-muted">{personal.photo ? (showPhoto ? m.photo_visible() : m.photo_hidden()) : m.photo_hint()}</p>
        </div>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          {personal.photo ? m.photo_change() : m.photo_upload()}
        </Button>
        {personal.photo && (
          <Button size="icon-sm" variant="ghost" aria-label={m.photo_remove()} onClick={() => setPersonal('photo', null)}>
            <Trash2 />
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void onPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
})
