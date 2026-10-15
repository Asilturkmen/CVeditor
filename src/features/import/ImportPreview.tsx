import { Check, FileUp, Info, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDateRange } from '@/cv/dates'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, CvLanguage, Personal, Section } from '@/cv/schema'
import { sectionTitle } from '@/cv/locale'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { itemLabel } from '@/features/editor/labels'

export interface ImportSelection {
  personal: Personal
  sections: Section[]
}

/**
 * Eski CV'yi içe aktarma ekranı (V1: yalnız arayüz). Seçilen PDF okunmaz ve
 * hiçbir yere gönderilmez; gösterilen kayıtlar uydurma örnektir. V3'te aynı
 * ekran yapay zekânın PDF metninden çıkardığı kayıtları gösterecek:
 * kullanıcı kayıt kayıt seçer, tahmin onaysız kaydedilmez.
 */
export function ImportPreview({
  language,
  onChange,
}: {
  language: CvLanguage
  onChange: (selection: ImportSelection | null) => void
}) {
  const [phase, setPhase] = useState<'idle' | 'reading' | 'ready'>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const personal = useMemo(() => samplePersonal(language), [language])
  const sections = useMemo(() => sampleSections(language), [language])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const start = (name: string | null) => {
    setFileName(name)
    setPhase('reading')
    setTimeout(() => setPhase('ready'), 900)
  }

  useEffect(() => {
    if (phase !== 'ready') {
      onChange(null)
      return
    }
    const chosen = sections
      .map((s) => ({ ...s, items: (s.items as AnyItem[]).filter((i) => !excluded.has(i.id)) }) as Section)
      .filter((s) => s.items.length > 0)
    onChange({ personal, sections: chosen })
  }, [phase, excluded, sections, personal, onChange])

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] text-text">
        <Info className="mt-0.5 size-4 shrink-0 text-warn" />
        <p>{m.import_demo_notice()}</p>
      </div>

      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
          <FileUp className="size-6 text-faint" />
          <div>
            <p className="font-medium">{m.import_pick_title()}</p>
            <p className="mt-0.5 text-sm text-muted">{m.import_pick_body()}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => inputRef.current?.click()}>{m.import_pick_button()}</Button>
            <Button variant="ghost" onClick={() => start(null)}>
              {m.import_sample_button()}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) start(file.name)
            }}
          />
        </div>
      )}

      {phase === 'reading' && (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted" role="status">
          <Loader2 className="size-4 animate-spin" />
          {m.import_reading()}
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex flex-col gap-4 animate-rise-in">
          <p className="text-sm text-muted">
            {fileName ? m.import_found_in({ file: fileName }) : m.import_found_sample()}
          </p>
          <div className="rounded-xl border border-line">
            <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
              {m.editor_personal_title()}
            </div>
            <p className="px-4 py-3 text-sm">
              <span className="font-medium">{personal.fullName}</span>
              <span className="text-muted"> · {personal.headline} · {personal.email}</span>
            </p>
          </div>
          {sections.map((section) => (
            <div key={section.id} className="rounded-xl border border-line">
              <div className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
                {sectionTitle(language, section.type, section.title)}
              </div>
              <ul>
                {(section.items as AnyItem[]).map((item) => {
                  const on = !excluded.has(item.id)
                  const dates = 'dates' in item ? formatDateRange(item.dates, language) : ''
                  return (
                    <li key={item.id} className="border-b border-line last:border-b-0">
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(item.id)} />
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                            on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong',
                          )}
                        >
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className={cn('min-w-0 flex-1 truncate', !on && 'text-faint line-through')}>
                          {itemLabel(section.type, item) || m.editor_untitled()}
                        </span>
                        {dates && <span className="shrink-0 text-xs text-faint">{dates}</span>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
