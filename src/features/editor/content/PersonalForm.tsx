import { memo } from 'react'
import type { Personal } from '@/cv/schema'
import { OutlineRow } from '@/components/ui/Disclosure'
import { BareInput } from '@/components/ui/Field'
import { FormRow } from '@/components/ui/Group'
import { setPersonal } from '@/editor/actions'
import { isRowOpen, useEditorUi } from '@/editor/ui'
import { m } from '@/paraglide/messages'
import { FieldSuggestion, PendingDot } from '../ai/suggestions'
import { fieldSuggestion, pendingKind } from '../ai/suggestionLogic'
import { PhotoRow, PhotoThumb } from './photo'
import { safePhoto } from './photoContext'

type InputMode = 'email' | 'tel' | 'url'

const FIELDS: {
  key: Exclude<keyof Personal, 'photo'>
  type: string
  inputMode?: InputMode
  label: () => string
  placeholder: () => string
  autoComplete?: string
}[] = [
  { key: 'fullName', type: 'text', label: () => m.f_full_name(), placeholder: () => m.ph_full_name(), autoComplete: 'name' },
  { key: 'headline', type: 'text', label: () => m.f_headline(), placeholder: () => m.ph_headline() },
  // type="email" değil: Chromium IDN alan adını punycode'a çevirir (ali@şirket.com.tr → xn--…) ve CV'ye o yazılır.
  { key: 'email', type: 'text', inputMode: 'email', label: () => m.f_email(), placeholder: () => m.ph_email(), autoComplete: 'email' },
  { key: 'phone', type: 'tel', label: () => m.f_phone(), placeholder: () => m.ph_phone(), autoComplete: 'tel' },
  { key: 'location', type: 'text', label: () => m.f_location(), placeholder: () => m.ph_city() },
  { key: 'website', type: 'url', label: () => m.f_website(), placeholder: () => m.ph_website() },
  { key: 'linkedin', type: 'text', label: () => m.f_linkedin(), placeholder: () => m.ph_linkedin() },
  { key: 'github', type: 'text', label: () => m.f_github(), placeholder: () => m.ph_github() },
]

/** Kayıt formlarının etiket sütunu (px): "Not ortalaması", "Web sitesi" sığar. */
export const FORM_LABEL_WIDTH = 104

function PersonalField({ f, value }: { f: (typeof FIELDS)[number]; value: string }) {
  const suggestion = useEditorUi((s) => fieldSuggestion(s.suggestions, 'personal', f.key))
  return (
    <div>
      <FormRow label={f.label()} labelWidth={FORM_LABEL_WIDTH}>
        {(id) => (
          <BareInput
            id={id}
            type={f.type}
            inputMode={f.inputMode}
            autoComplete={f.autoComplete ?? 'off'}
            value={value}
            placeholder={f.placeholder()}
            onChange={(e) => setPersonal(f.key, e.target.value)}
          />
        )}
      </FormRow>
      {suggestion && <FieldSuggestion s={suggestion} />}
    </div>
  )
}

/**
 * "Kişisel bilgiler" anahat satırı: kapalıyken ad · unvan ve fotoğraf küçük resmi; açılınca etiketli
 * alanlar (etiket solda, çıplak alan sağda) ve fotoğraf satırı. Başlık h2 (akordeon deseni).
 */
export const PersonalForm = memo(function PersonalForm({ personal }: { personal: Personal }) {
  const open = useEditorUi((s) => isRowOpen(s, 'personal'))
  const setRowOpen = useEditorUi((s) => s.setRowOpen)
  const pending = useEditorUi((s) => pendingKind(s.suggestions, 'personal'))
  const summary = [personal.fullName.trim(), personal.headline.trim()].filter(Boolean).join(' · ')
  const photo = safePhoto(personal.photo)
  return (
    <section
      id="personal-card"
      aria-label={m.editor_personal_title()}
      className="overflow-hidden rounded-xl bg-content shadow-1 [--row-px:12px]"
    >
      <OutlineRow
        headingLevel={2}
        open={open}
        onOpenChange={(next) => setRowOpen('personal', next)}
        title={
          <>
            {m.editor_personal_title()}
            {pending && <PendingDot kind={pending} />}
          </>
        }
        meta={!open && summary ? summary : undefined}
        actions={!open && photo ? <PhotoThumb photo={photo} size={28} /> : undefined}
      >
        <div className="group-rows pl-[22px]">
          {FIELDS.map((f) => (
            <PersonalField key={f.key} f={f} value={personal[f.key]} />
          ))}
          <PhotoRow />
        </div>
      </OutlineRow>
    </section>
  )
})
