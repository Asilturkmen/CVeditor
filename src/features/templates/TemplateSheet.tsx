import { useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy, FileText, FileUp, X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createCv, defaultSections, duplicateCv } from '@/cv/factory'
import { initialCvLanguage } from '@/cv/locale'
import { describeCvError, migrateCv } from '@/cv/migrate'
import type { Cv, CvLanguage, Section, TemplateSettings } from '@/cv/schema'
import { db } from '@/db/db'
import { saveCv } from '@/db/repo'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RadioGroup, RadioRow } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { BareInput, Select } from '@/components/ui/Field'
import { FormRow, Group, GroupRow } from '@/components/ui/Group'
import { IconButton } from '@/components/ui/IconButton'
import { Segmented } from '@/components/ui/Segmented'
import { Swatches } from '@/components/ui/Swatches'
import { toast } from '@/components/ui/toast'
import { ToolbarGroup } from '@/components/ui/Toolbar'
import { useScrollEdge } from '@/components/ui/useScrollEdge'
import { controlOnContentClass } from '@/components/ui/controlClass'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { m } from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'
import { CvFrame } from '@/render/CvFrame'
import {
  supportedColumns,
  TEMPLATES,
  templateSettingsFor,
  templateSettingsForCopy,
  type ColorSet,
  type TemplateId,
} from '@/render/templates'
import { ImportPreview, type ImportSelection } from '@/features/import/ImportPreview'
import { colorSetName, TEMPLATE_TEXT } from './templateText'
import { useSampleCv } from './useSampleCv'

export type StartMode = 'blank' | 'import' | 'copy'

const defaultName = (lang: CvLanguage) => m.new_cv_default_name({ lang: lang.toUpperCase() })

/** Yeni CV'nin dili arayüz dilini izler (arayüz İngilizceyse İngilizce CV); kullanıcı yine değiştirebilir. */
const initialLanguage = (): CvLanguage => initialCvLanguage(getLocale())

/** Klavyeyle önceki/sonraki şablon: yazı alanında ve ok tuşunu kendisi kullanan kontrolde değil. */
const ownsArrows = (target: EventTarget) =>
  target instanceof Element && !!target.closest('input, textarea, select, [role="radiogroup"], [role="radio"], [contenteditable="true"]')

interface TemplateSheetProps {
  /** Açık şablon; null kapalı */
  templateId: TemplateId | null
  /** Önceki/sonraki gezinmesinin sırası (galerinin süzülmüş listesi) */
  order: readonly TemplateId[]
  onTemplateChange: (id: TemplateId) => void
  onClose: () => void
  /** Açılırken seçili başlangıç ("Eski CV'ni içe aktar" kısayolu `import` verir) */
  initialMode?: StartMode
  /** Galerideki örnek kipi: fotoğraflı mı */
  initialPhoto: boolean
  /** Galerideki sütun süzgeci (destekleniyorsa önizleme bu düzenle açılır) */
  preferredColumns?: 1 | 2
}

/**
 * Şablon sayfası + Yeni CV (eski iki adımlı pencerenin yerine tek sayfa). Solda büyük önizleme
 * (örnek kişi, seçilen renk/sütun/fotoğraf ve CV dilinde), sağda şablonun tanımı, Görünüm (renk
 * takımı, örnek kipi, sütun), CV adı ve dili, başlangıç türü. Üstte önceki/sonraki şablon (← →).
 * "Eski CV'yi içe aktar" seçilince birincil düğme "Devam: PDF seç" olur ve içe aktarma penceresi
 * (ImportPreview, aynen) bu sayfanın üstünde açılır. Telefonda tam ekran, tek sütun.
 */
export function TemplateSheet({
  templateId,
  order,
  onTemplateChange,
  onClose,
  initialMode = 'blank',
  initialPhoto,
  preferredColumns,
}: TemplateSheetProps) {
  const navigate = useNavigate()
  const cvs = useLiveQuery(() => db.cvs.orderBy('updatedAt').reverse().toArray(), [], [] as Cv[])
  // Kapanırken çıkış animasyonu son şablonla oynar.
  const [shownId, setShownId] = useState<TemplateId | null>(templateId)
  const [language, setLanguage] = useState<CvLanguage>(initialLanguage)
  const [name, setName] = useState<string>(() => defaultName(initialLanguage()))
  const [nameTouched, setNameTouched] = useState(false)
  const [mode, setMode] = useState<StartMode>(initialMode)
  const [chosenCopyFrom, setCopyFrom] = useState('')
  const [photo, setPhoto] = useState(initialPhoto)
  const [colorId, setColorId] = useState<string | null>(null)
  const [colorTouched, setColorTouched] = useState(false)
  const [columns, setColumns] = useState<1 | 2 | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importSelection, setImportSelection] = useState<ImportSelection | null>(null)
  const [busy, setBusy] = useState(false)
  // Çift tıklama iki CV oluşturmasın: durum güncellenmeden gelen ikinci tıklamayı da keser.
  const creating = useRef(false)
  const primaryRef = useRef<HTMLButtonElement>(null)
  // Kaydırma: telefonda bütün sayfa, genişte yalnız sağ sütun. Eylem satırının çizgisi kaydırılacak içerik varken.
  const wide = useMediaQuery('(min-width: 768px)')
  const pageScrollRef = useRef<HTMLDivElement>(null)
  const formScrollRef = useRef<HTMLDivElement>(null)
  const footerScrolled = useScrollEdge(wide ? formScrollRef : pageScrollRef, 'bottom')

  // Açılışta her şey baştan; açıkken şablon değişince (önceki/sonraki) yalnız şablona özgü seçimler
  // (renk, sütun) sıfırlanır: yazılan ad, dil ve başlangıç türü korunur.
  const [previousId, setPreviousId] = useState<TemplateId | null>(null)
  if (templateId !== previousId) {
    setPreviousId(templateId)
    if (templateId !== null) {
      if (previousId === null) {
        setLanguage(initialLanguage())
        setName(defaultName(initialLanguage()))
        setNameTouched(false)
        setMode(initialMode)
        setCopyFrom('')
        setPhoto(initialPhoto)
        setImportOpen(false)
        setImportSelection(null)
        setBusy(false)
      }
      setColorId(null)
      setColorTouched(false)
      setColumns(null)
      setShownId(templateId)
    }
  }
  useEffect(() => {
    if (templateId === null) creating.current = false
  }, [templateId])

  if (!shownId) return null
  const template = TEMPLATES[shownId]
  const text = TEMPLATE_TEXT[shownId]
  const colorSet = template.colorSets.find((set) => set.id === colorId) ?? template.colorSets[0]
  const effectiveColumns: 1 | 2 =
    columns ?? (preferredColumns ? supportedColumns(template, preferredColumns) : template.columns[0])
  const copyFrom = chosenCopyFrom || (cvs[0]?.id ?? '')
  const copySource = cvs.find((c) => c.id === copyFrom)

  const list = order.includes(shownId) ? order : (Object.keys(TEMPLATES) as TemplateId[])
  const index = list.indexOf(shownId)
  const prevId = index > 0 ? list[index - 1] : null
  const nextId = index < list.length - 1 ? list[index + 1] : null

  const changeLanguage = (lang: CvLanguage) => {
    setLanguage(lang)
    if (!nameTouched) setName(defaultName(lang))
  }

  /** Şablon sayfasında seçilen görünüm (renk takımı, sütun) yeni CV'nin ayarlarına. */
  const withLook = (settings: TemplateSettings, applyColor: boolean): TemplateSettings => ({
    ...settings,
    columns: effectiveColumns,
    ...(applyColor
      ? { accentColor: colorSet.accent, baseColor: colorSet === template.colorSets[0] ? null : (colorSet.base ?? null) }
      : {}),
  })

  const finish = async (cv: Cv) => {
    if (creating.current) return
    creating.current = true
    setBusy(true)
    try {
      await saveCv(cv)
    } catch (error) {
      // Kaydedilemedi: sayfa açık kalır, düğme yeniden kullanılabilir (seçimler kaybolmaz).
      console.error(error)
      creating.current = false
      setBusy(false)
      toast({ message: m.err_storage_write(), tone: 'error' })
      return
    }
    onClose()
    void navigate({ to: '/editor/$cvId', params: { cvId: cv.id } })
  }

  const cvName = () => name.trim() || defaultName(language)

  const create = async () => {
    if (busy) return
    if (mode === 'blank') {
      const sections = defaultSections()
      await finish(
        createCv({
          name: cvName(),
          language,
          templateId: shownId,
          template: withLook(templateSettingsFor(shownId, sections), true),
          sections,
        }),
      )
    } else if (mode === 'copy') {
      if (!copySource) return
      // Kaynak veritabanındaki ham satırdır: kopyalanmadan önce editörün okuduğu gibi okunur
      // (eski sürüm yükseltilir, bozuk tarih/fotoğraf/yinelenen id onarılır). Okunamıyorsa kopyalanmaz.
      let source: Cv
      try {
        source = migrateCv(copySource)
      } catch (error) {
        console.error(error)
        toast({ message: describeCvError(error), tone: 'error' })
        return
      }
      const copy = duplicateCv(source, { name: cvName(), language })
      copy.templateId = shownId
      // Renk: burada seçildiyse o; seçilmediyse şablon değiştirme kuralıyla (kaynağın özel rengi kalır).
      copy.template = withLook(templateSettingsForCopy(source, shownId, copy.sections), colorTouched)
      await finish(copy)
    } else {
      setImportSelection(null)
      setImportOpen(true)
    }
  }

  /** İçe aktarılan seçimle CV; hiç bölüm seçilmediyse (yalnız kişisel bilgi) boş CV bölümleri */
  const createFrom = async (selection: ImportSelection) => {
    const sections: Section[] = selection.sections.length ? selection.sections : defaultSections()
    await finish(
      createCv({
        name: cvName(),
        language,
        templateId: shownId,
        template: withLook(templateSettingsFor(shownId, sections), true),
        personal: selection.personal,
        sections,
      }),
    )
  }

  const hasImport = (s: ImportSelection | null) => !!s && (s.sections.length > 0 || s.personal.fullName.trim() !== '')

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (event.altKey || event.ctrlKey || event.metaKey || ownsArrows(event.target)) return
    const target = event.key === 'ArrowLeft' ? prevId : nextId
    if (!target) return
    event.preventDefault()
    onTemplateChange(target)
  }

  return (
    <>
      <D.Root open={templateId !== null} onOpenChange={(next) => !next && onClose()}>
        <D.Portal>
          <D.Overlay className="overlay fixed inset-0 z-50 bg-[var(--overlay)]" />
          <D.Content
            data-template-sheet={shownId}
            onKeyDown={onKeyDown}
            onOpenAutoFocus={(event) => {
              // Gezinmeye hazır: odak birincil düğmede (Enter başlatır, ← → şablon değiştirir).
              event.preventDefault()
              primaryRef.current?.focus({ preventScroll: true })
            }}
            className={cn(
              'dialog fixed z-50 flex flex-col overflow-hidden bg-window shadow-4 outline-none',
              // Telefon: tam ekran
              'inset-0 h-dvh w-full pt-[env(safe-area-inset-top)]',
              // Masaüstü: ortada büyük pencere
              'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(92dvh,780px)] sm:w-[min(96vw,1120px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pt-0',
            )}
          >
            {/* Üst çubuk: önceki/sonraki şablon ve kapat */}
            <div className="flex h-13 shrink-0 items-center gap-2 border-b border-separator px-3">
              <ToolbarGroup aria-label={m.nav_templates()}>
                <IconButton
                  label={m.templates_prev()}
                  tooltip={prevId ? `${m.templates_prev()}: ${TEMPLATE_TEXT[prevId].name()}` : m.templates_prev()}
                  shortcut="←"
                  icon={<ChevronLeft />}
                  disabled={!prevId}
                  onClick={() => prevId && onTemplateChange(prevId)}
                />
                <IconButton
                  label={m.templates_next()}
                  tooltip={nextId ? `${m.templates_next()}: ${TEMPLATE_TEXT[nextId].name()}` : m.templates_next()}
                  shortcut="→"
                  icon={<ChevronRight />}
                  disabled={!nextId}
                  onClick={() => nextId && onTemplateChange(nextId)}
                />
              </ToolbarGroup>
              <span className="text-body text-fg tabular-nums">
                {m.templates_position({ index: String(index + 1), total: String(list.length) })}
              </span>
              <D.Close asChild>
                <IconButton label={m.common_close()} icon={<X />} className="ml-auto" />
              </D.Close>
            </div>

            <div
              ref={pageScrollRef}
              className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1fr)_400px] md:overflow-hidden"
            >
              {/* Önizleme: kâğıt, kalan alana sığar (gölgeli A4, tuval zemini) */}
              <div className="relative flex h-[min(68dvh,600px)] items-center justify-center bg-canvas [container-type:size] md:h-auto">
                <div className="aspect-[210/297] w-[min(calc(100cqw-48px),calc((100cqh-48px)*0.7071))] overflow-hidden bg-paper shadow-page">
                  <SheetPreview
                    templateId={shownId}
                    language={language}
                    photo={photo}
                    columns={effectiveColumns}
                    colorSet={colorSet}
                    title={text.name()}
                  />
                </div>
                <Badge tone="warn" className="absolute top-4 left-4">
                  {m.badge_sample()}
                </Badge>
              </div>

              {/* Sağ sütun: tanım, görünüm, ad/dil, başlangıç */}
              <div className="flex min-h-0 flex-col md:border-l md:border-separator">
                <div
                  ref={formScrollRef}
                  className="flex flex-col gap-6 px-5 pt-5 pb-6 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain"
                >
                  {/* Grup başlıkları ve satır metniyle aynı x (grubun 12px iç boşluğu) */}
                  <div className="px-3">
                    <D.Title className="text-title-1 text-fg">{text.name()}</D.Title>
                    <p className="mt-1 text-callout text-fg-2">{text.features()}</p>
                    <D.Description className="mt-2 text-body text-fg">{text.description()}</D.Description>
                  </div>

                  <Group title={m.templates_look_title()} footer={m.templates_look_hint()}>
                    <GroupRow
                      title={m.templates_color()}
                      description={colorSetName(colorSet.id)}
                      trailing={
                        <Swatches
                          aria-label={m.templates_color()}
                          value={colorSet.id}
                          onChange={(id) => {
                            setColorId(id)
                            setColorTouched(true)
                          }}
                          options={template.colorSets.map((set) => ({
                            value: set.id,
                            color: set.accent,
                            second: set.base,
                            label: colorSetName(set.id),
                          }))}
                        />
                      }
                    />
                    {template.columns.length > 1 && (
                      <GroupRow
                        title={m.templates_filter_columns()}
                        trailing={
                          <Segmented
                            aria-label={m.templates_filter_columns()}
                            value={String(effectiveColumns) as '1' | '2'}
                            onChange={(value) => setColumns(value === '2' ? 2 : 1)}
                            options={template.columns.map((c) => ({
                              value: String(c) as '1' | '2',
                              label: c === 2 ? m.layout_two_columns() : m.layout_one_column(),
                            }))}
                          />
                        }
                      />
                    )}
                    <GroupRow
                      title={m.templates_filter_sample()}
                      trailing={
                        <Segmented
                          aria-label={m.templates_filter_sample()}
                          value={photo ? 'photo' : 'none'}
                          onChange={(value) => setPhoto(value === 'photo')}
                          options={[
                            { value: 'photo', label: m.templates_sample_photo() },
                            { value: 'none', label: m.templates_sample_nophoto() },
                          ]}
                        />
                      }
                    />
                  </Group>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void create()
                    }}
                  >
                    <Group title={m.list_new_cv()}>
                      <FormRow label={m.new_cv_name()} hint={m.new_cv_name_hint()} labelWidth={96}>
                        {(id, describedBy) => (
                          <BareInput
                            id={id}
                            value={name}
                            aria-describedby={describedBy}
                            onChange={(event) => {
                              setName(event.target.value)
                              setNameTouched(true)
                            }}
                          />
                        )}
                      </FormRow>
                      <GroupRow
                        title={m.new_cv_language()}
                        description={m.new_cv_language_hint()}
                        trailing={
                          <Segmented
                            aria-label={m.new_cv_language()}
                            value={language}
                            onChange={changeLanguage}
                            options={[
                              { value: 'tr', label: m.lang_tr() },
                              { value: 'en', label: m.lang_en() },
                            ]}
                          />
                        }
                      />
                    </Group>
                    <button type="submit" hidden />
                  </form>

                  <Group title={m.new_cv_start_title()}>
                    <RadioGroup
                      aria-label={m.new_cv_start_title()}
                      value={mode}
                      onValueChange={(value) => setMode(value as StartMode)}
                      className="group-rows gap-0"
                    >
                      <RadioRow
                        value="blank"
                        selected={mode === 'blank'}
                        icon={<FileText />}
                        title={m.start_blank()}
                        description={m.start_blank_desc()}
                      />
                      <RadioRow
                        value="import"
                        selected={mode === 'import'}
                        icon={<FileUp />}
                        title={m.start_import()}
                        description={m.start_import_desc()}
                      />
                      <RadioRow
                        value="copy"
                        selected={mode === 'copy'}
                        icon={<Copy />}
                        title={m.start_copy()}
                        description={cvs.length > 0 ? m.start_copy_desc() : m.start_copy_none()}
                        disabled={cvs.length === 0}
                      >
                        <div className="flex flex-col gap-2">
                          <Select
                            controlSize="sm"
                            className={controlOnContentClass}
                            value={copyFrom}
                            onChange={(event) => setCopyFrom(event.target.value)}
                            aria-label={m.start_copy()}
                          >
                            {cvs.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.language.toUpperCase()})
                              </option>
                            ))}
                          </Select>
                          {copySource && copySource.language !== language && (
                            <p className="text-callout text-warn">{m.start_copy_language_note()}</p>
                          )}
                        </div>
                      </RadioRow>
                    </RadioGroup>
                  </Group>
                </div>

                {/* Eylem satırı: Vazgeç solda, birincil sağda; telefonda tam genişlik, birincil üstte */}
                <div
                  data-scrolled={footerScrolled ? '' : undefined}
                  className={cn(
                    'scroll-edge-top sticky bottom-0 flex shrink-0 items-center justify-end gap-2 bg-window px-5 py-4',
                    'pb-[max(16px,env(safe-area-inset-bottom))] max-sm:flex-col-reverse max-sm:items-stretch',
                  )}
                >
                  <D.Close asChild>
                    <Button size="lg" className="max-sm:h-11">
                      {m.common_cancel()}
                    </Button>
                  </D.Close>
                  <Button
                    ref={primaryRef}
                    variant="primary"
                    size="lg"
                    className="max-sm:h-11"
                    loading={busy}
                    disabled={mode === 'copy' && !copySource}
                    onClick={() => void create()}
                  >
                    {mode === 'import' ? m.new_cv_continue_import() : m.templates_use()}
                  </Button>
                </div>
              </div>
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>

      {/* İçe aktarma penceresi: dosya seçimi → bulunan kayıtlar (ImportPreview aynen) */}
      <Dialog
        open={importOpen}
        onOpenChange={(next) => !next && setImportOpen(false)}
        title={m.import_title()}
        size="lg"
        className="w-[min(94vw,680px)]"
        footer={
          <>
            <Button size="lg" onClick={() => setImportOpen(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              variant="primary"
              size="lg"
              loading={busy}
              disabled={!hasImport(importSelection)}
              onClick={() => importSelection && void createFrom(importSelection)}
            >
              {m.new_cv_create()}
            </Button>
          </>
        }
      >
        <ImportPreview language={language} onChange={setImportSelection} onLanguageChange={changeLanguage} />
      </Dialog>
    </>
  )
}

/** Şablon sayfasındaki büyük önizleme (örnek kişi). Şablon değişince çapraz geçişle. */
function SheetPreview({
  templateId,
  language,
  photo,
  columns,
  colorSet,
  title,
}: {
  templateId: TemplateId
  language: CvLanguage
  photo: boolean
  columns: 1 | 2
  colorSet: ColorSet
  title: string
}) {
  const sample = useSampleCv(templateId, { language, photo, columns, colorSet })
  return <CvFrame cv={sample} scale="fit" fitPadding={0} firstPageOnly title={title} crossfadeKey={templateId} />
}
