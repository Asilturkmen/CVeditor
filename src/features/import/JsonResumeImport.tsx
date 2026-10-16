import { FileJson, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fromJsonResume } from '@/cv/jsonResume'
import type { CvLanguage } from '@/cv/schema'
import { Button } from '@/components/ui/Button'
import { m } from '@/paraglide/messages'
import type { ImportSelection } from './ImportPreview'

/**
 * JSON Resume dosyasından yeni CV: dosya tarayıcıda okunur, eşleyici
 * (src/cv/jsonResume.ts) bölümlere çevirir; alınamayan alanlar uyarı olarak
 * listelenir. CV dili bir önceki adımda seçilen dildir.
 */
export function JsonResumeImport({
  language,
  onChange,
}: {
  language: CvLanguage
  onChange: (selection: ImportSelection | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; json: unknown } | null>(null)
  const [readError, setReadError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    if (!file) return null
    try {
      return { ok: true as const, ...fromJsonResume(file.json, { language }) }
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : m.imp_json_invalid() }
    }
  }, [file, language])

  useEffect(() => {
    onChange(parsed?.ok ? { personal: parsed.personal, sections: parsed.sections } : null)
  }, [parsed, onChange])

  const pick = async (f: File) => {
    setReadError(null)
    setFile(null)
    try {
      setFile({ name: f.name, json: JSON.parse(await f.text()) })
    } catch {
      setReadError(m.imp_json_invalid())
    }
  }

  const fileLanguage = (file?.json as { meta?: { cveditor?: { language?: string } } } | null)?.meta?.cveditor?.language
  const error = readError ?? (parsed && !parsed.ok ? parsed.message : null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          <FileJson />
          {m.imp_json_pick()}
        </Button>
        {parsed?.ok && (
          <span className="min-w-0 truncate text-xs text-muted" data-testid="json-resume-summary">
            {m.imp_json_loaded({
              file: file!.name,
              sections: parsed.sections.length,
              items: parsed.sections.reduce((n, s) => n + s.items.length, 0),
            })}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="json-resume-file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void pick(f)
        }}
      />
      {error && (
        <p role="alert" className="flex gap-1.5 text-xs text-danger">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {parsed?.ok && (fileLanguage === 'tr' || fileLanguage === 'en') && fileLanguage !== language && (
        <p className="text-xs text-warn">
          {m.imp_json_language_note({ language: fileLanguage === 'tr' ? m.lang_tr() : m.lang_en() })}
        </p>
      )}
      {parsed?.ok && parsed.warnings.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer text-warn select-none">
            {m.imp_json_warnings({ count: parsed.warnings.length })}
          </summary>
          <ul className="mt-1 max-h-28 list-disc overflow-auto pl-4">
            {parsed.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
