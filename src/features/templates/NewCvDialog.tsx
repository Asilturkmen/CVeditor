import { useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Copy, FileText, FileUp } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createCv, defaultSections, duplicateCv } from '@/cv/factory'
import type { Cv, CvLanguage, Section } from '@/cv/schema'
import { db } from '@/db/db'
import { saveCv } from '@/db/repo'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { getTemplate, templateSettingsFor, type TemplateId } from '@/render/templates'
import { ImportPreview, type ImportSelection } from '@/features/import/ImportPreview'

type Step = 'details' | 'start' | 'import'
type StartMode = 'blank' | 'import' | 'copy'

const defaultName = (lang: CvLanguage) => (lang === 'tr' ? 'Genel TR' : 'Genel EN')

function StartOption({
  selected,
  onSelect,
  icon,
  title,
  body,
  badge,
  disabled,
  children,
}: {
  selected: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  body: string
  badge?: string
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-[border-color,background-color,box-shadow] duration-150',
        selected ? 'border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]' : 'border-line hover:border-line-strong',
        disabled && 'opacity-55',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onSelect}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
            selected ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {badge && (
              <span className="rounded-full bg-warn-soft px-1.5 py-px text-[11px] font-medium text-warn">{badge}</span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted">{body}</span>
        </span>
      </button>
      {selected && children && <div className="px-4 pb-3 pl-15 animate-rise-in">{children}</div>}
    </div>
  )
}

export function NewCvDialog({ templateId, onClose }: { templateId: TemplateId | null; onClose: () => void }) {
  const navigate = useNavigate()
  const cvs = useLiveQuery(() => db.cvs.orderBy('updatedAt').reverse().toArray(), [], [] as Cv[])
  const [step, setStep] = useState<Step>('details')
  const [language, setLanguage] = useState<CvLanguage>('tr')
  const [name, setName] = useState(defaultName('tr'))
  const [nameTouched, setNameTouched] = useState(false)
  const [mode, setMode] = useState<StartMode>('blank')
  const [copyFrom, setCopyFrom] = useState<string>('')
  const [importSelection, setImportSelection] = useState<ImportSelection | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (templateId) {
      setStep('details')
      setLanguage('tr')
      setName(defaultName('tr'))
      setNameTouched(false)
      setMode('blank')
      setImportSelection(null)
      setBusy(false)
    }
  }, [templateId])

  useEffect(() => {
    if (!copyFrom && cvs.length > 0) setCopyFrom(cvs[0].id)
  }, [cvs, copyFrom])

  if (!templateId) return null
  const template = getTemplate(templateId)

  const changeLanguage = (lang: CvLanguage) => {
    setLanguage(lang)
    if (!nameTouched) setName(defaultName(lang))
  }

  const finish = async (cv: Cv) => {
    setBusy(true)
    await saveCv(cv)
    onClose()
    void navigate({ to: '/editor/$cvId', params: { cvId: cv.id } })
  }

  const create = async () => {
    const cvName = name.trim() || defaultName(language)
    if (mode === 'blank') {
      const sections = defaultSections()
      await finish(
        createCv({ name: cvName, language, templateId, template: templateSettingsFor(templateId, sections), sections }),
      )
    } else if (mode === 'copy') {
      const source = cvs.find((c) => c.id === copyFrom)
      if (!source) return
      const copy = duplicateCv(source, { name: cvName, language })
      copy.templateId = templateId
      copy.template = { ...templateSettingsFor(templateId, copy.sections), accentColor: source.template.accentColor }
      await finish(copy)
    } else {
      setStep('import')
    }
  }

  const createFromImport = async () => {
    if (!importSelection) return
    const sections: Section[] = importSelection.sections
    await finish(
      createCv({
        name: name.trim() || defaultName(language),
        language,
        templateId,
        template: templateSettingsFor(templateId, sections),
        personal: importSelection.personal,
        sections,
      }),
    )
  }

  const titles: Record<Step, string> = {
    details: m.new_cv_title({ template: template.name }),
    start: m.new_cv_start_title(),
    import: m.import_title(),
  }

  const footer =
    step === 'details' ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          {m.common_cancel()}
        </Button>
        <Button variant="primary" onClick={() => setStep('start')} disabled={!name.trim()}>
          {m.common_continue()}
        </Button>
      </>
    ) : step === 'start' ? (
      <>
        <Button variant="ghost" className="mr-auto" onClick={() => setStep('details')}>
          <ArrowLeft />
          {m.common_back()}
        </Button>
        <Button
          variant="primary"
          disabled={busy || (mode === 'copy' && !copyFrom)}
          onClick={() => void create()}
        >
          {mode === 'import' ? m.common_continue() : m.new_cv_create()}
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" className="mr-auto" onClick={() => setStep('start')}>
          <ArrowLeft />
          {m.common_back()}
        </Button>
        <Button
          variant="primary"
          disabled={busy || !importSelection || importSelection.sections.length === 0}
          onClick={() => void createFromImport()}
        >
          {m.new_cv_create()}
        </Button>
      </>
    )

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={titles[step]}
      description={step === 'details' ? m.new_cv_details_desc() : undefined}
      footer={footer}
      className={step === 'import' ? 'w-[min(94vw,680px)]' : undefined}
    >
      <div key={step} className="animate-rise-in">
        {step === 'details' && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) setStep('start')
            }}
          >
            <Field label={m.new_cv_name()} hint={m.new_cv_name_hint()}>
              {(id) => (
                <Input
                  id={id}
                  value={name}
                  autoFocus
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameTouched(true)
                  }}
                />
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-muted">{m.new_cv_language()}</span>
              <Segmented
                value={language}
                onChange={changeLanguage}
                aria-label={m.new_cv_language()}
                options={[
                  { value: 'tr', label: m.lang_tr() },
                  { value: 'en', label: m.lang_en() },
                ]}
              />
              <p className="text-xs text-faint">{m.new_cv_language_hint()}</p>
            </div>
            <button type="submit" hidden />
          </form>
        )}

        {step === 'start' && (
          <div role="radiogroup" aria-label={m.new_cv_start_title()} className="flex flex-col gap-2.5">
            <StartOption
              selected={mode === 'blank'}
              onSelect={() => setMode('blank')}
              icon={<FileText />}
              title={m.start_blank()}
              body={m.start_blank_desc()}
            />
            <StartOption
              selected={mode === 'import'}
              onSelect={() => setMode('import')}
              icon={<FileUp />}
              title={m.start_import()}
              body={m.start_import_desc()}
              badge={m.badge_preview()}
            />
            <StartOption
              selected={mode === 'copy'}
              onSelect={() => setMode('copy')}
              icon={<Copy />}
              title={m.start_copy()}
              body={cvs.length > 0 ? m.start_copy_desc() : m.start_copy_none()}
              disabled={cvs.length === 0}
            >
              <div className="flex flex-col gap-1.5">
                <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label={m.start_copy()}>
                  {cvs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.language.toUpperCase()})
                    </option>
                  ))}
                </Select>
                {cvs.find((c) => c.id === copyFrom)?.language !== language && (
                  <p className="text-xs text-warn">{m.start_copy_language_note()}</p>
                )}
              </div>
            </StartOption>
          </div>
        )}

        {step === 'import' && <ImportPreview language={language} onChange={setImportSelection} />}
      </div>
    </Dialog>
  )
}
