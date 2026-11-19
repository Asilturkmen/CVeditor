import { useLiveQuery } from 'dexie-react-hooks'
import { FileUp } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { db } from '@/db/db'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { CvFrame } from '@/render/CvFrame'
import { DEFAULT_TEMPLATE_ID } from '@/render/templateMeta'
import { supportedColumns, TEMPLATE_LIST, type TemplateDef, type TemplateId } from '@/render/templates'
import { clearImportStart, peekImportStart } from './importIntent'
import { TemplateSheet, type StartMode } from './TemplateSheet'
import { TEMPLATE_TEXT } from './templateText'
import { useSampleCv } from './useSampleCv'

type ColumnFilter = 'all' | '1' | '2'

/**
 * Galeri kartı: kapsız; A4 küçük resim doğrudan pencere zemininde (kâğıt, yarıçap 6, küçük resim gölgesi;
 * hover'da gölge 2 + 1px yukarı; odakta 3px vurgu halkası). Altında 12px ile ad (title-3), ayırt edici
 * özellikler tek satır ve açıklama (callout, ikincil, sarar; kesilmez). Kartın tamamı tek düğme.
 */
function TemplateCard({
  template,
  photo,
  columns,
  onChoose,
}: {
  template: TemplateDef
  photo: boolean
  columns?: 1 | 2
  onChoose: () => void
}) {
  const sample = useSampleCv(template.id, { photo, columns })
  const text = TEMPLATE_TEXT[template.id]
  return (
    <button
      type="button"
      onClick={onChoose}
      className="group flex min-w-0 flex-col text-left outline-none"
      aria-label={m.templates_choose({ name: text.name() })}
      data-template={template.id}
    >
      <span
        className={cn(
          'block aspect-[210/297] w-full overflow-hidden rounded-sm bg-paper shadow-thumb',
          'transition-[translate,box-shadow] duration-200 ease-out',
          'group-hover:-translate-y-px group-hover:shadow-2 group-active:translate-y-0',
          'group-focus-visible:outline-3 group-focus-visible:outline-offset-3 group-focus-visible:outline-focus-ring',
        )}
      >
        <CvFrame cv={sample} scale="fit" fitPadding={0} firstPageOnly title={text.name()} />
      </span>
      <span className="mt-3 flex flex-col gap-0.5">
        <span className="text-title-3 text-fg">{text.name()}</span>
        <span className="text-callout text-fg-2">{text.features()}</span>
        <span className="mt-1 text-callout text-fg-2">{text.description()}</span>
      </span>
    </button>
  )
}

/** Süzgeç satırındaki etiket + segment (telefonda tam genişlik). */
function FilterControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 max-sm:w-full">
      <span className="shrink-0 text-body text-fg-2 max-sm:w-16">{label}</span>
      <div className="max-sm:flex-1">{children}</div>
    </div>
  )
}

/**
 * Şablonlar galerisi: başlık (ilk ziyarette karşılama) + "Eski CV'ni içe aktar (PDF)"; iki segment
 * (Sütun süzer; Örnek yalnız önizleme kipidir) ve sonuç sayısı; 4 sütunluk ızgara (900-1100px 3,
 * telefonda 2). Şablon listesi, sütunlar ve etiketler TEMPLATE_META'dan gelir; karta tıklayınca
 * şablon sayfası (büyük önizleme + Yeni CV) açılır.
 */
export function TemplatesPage() {
  const count = useLiveQuery(() => db.cvs.count())
  const [columnFilter, setColumnFilter] = useState<ColumnFilter>('all')
  const [photo, setPhoto] = useState(true)
  // CV'lerim'deki "Eski CV'ni içe aktar" buraya bir kerelik istekle gelir.
  const [startImport] = useState(peekImportStart)
  const [chosen, setChosen] = useState<TemplateId | null>(() => (startImport ? DEFAULT_TEMPLATE_ID : null))
  const [startMode, setStartMode] = useState<StartMode>(startImport ? 'import' : 'blank')
  useEffect(() => clearImportStart(), [])

  const columns = columnFilter === 'all' ? undefined : (Number(columnFilter) as 1 | 2)
  const visible = useMemo(
    () => TEMPLATE_LIST.filter((t) => !columns || (t.columns as readonly number[]).includes(columns)),
    [columns],
  )
  const order = useMemo(() => visible.map((t) => t.id), [visible])

  if (count === undefined) return null
  const firstVisit = count === 0

  const choose = (id: TemplateId, mode: StartMode = 'blank') => {
    setStartMode(mode)
    setChosen(id)
  }

  return (
    <div className="animate-fade-in">
      {/* Başlık | ikincil eylem aynı taban çizgisinde; altında 4px ile tek cümle. Telefonda alt alta. */}
      <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-6 max-sm:grid-cols-1 max-sm:gap-y-3">
        <h1 className="text-title-lg text-fg">{firstVisit ? m.templates_welcome_title() : m.templates_title()}</h1>
        <Button size="lg" onClick={() => choose(DEFAULT_TEMPLATE_ID, 'import')} className="max-sm:order-last">
          <FileUp />
          {m.templates_import_cta()}
        </Button>
        <p className="mt-1 max-w-[720px] text-body text-fg-2 max-sm:mt-0">
          {firstVisit ? m.templates_welcome_body() : m.templates_subtitle()}
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterControl label={m.templates_filter_columns()}>
          <Segmented
            aria-label={m.templates_filter_columns()}
            value={columnFilter}
            onChange={setColumnFilter}
            stretch
            options={[
              { value: 'all', label: m.templates_filter_all() },
              { value: '1', label: m.layout_one_column() },
              { value: '2', label: m.layout_two_columns() },
            ]}
          />
        </FilterControl>
        <FilterControl label={m.templates_filter_sample()}>
          <Segmented
            aria-label={m.templates_filter_sample()}
            value={photo ? 'photo' : 'none'}
            onChange={(value) => setPhoto(value === 'photo')}
            stretch
            options={[
              { value: 'photo', label: m.templates_sample_photo() },
              { value: 'none', label: m.templates_sample_nophoto() },
            ]}
          />
        </FilterControl>
        <p role="status" className="text-body text-fg-2 tabular-nums sm:ml-auto">
          {m.templates_count({ count: visible.length })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 sm:gap-y-8 min-[900px]:grid-cols-3 min-[1100px]:grid-cols-4">
        {visible.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            photo={photo}
            columns={columns ? supportedColumns(template, columns) : undefined}
            onChoose={() => choose(template.id)}
          />
        ))}
      </div>
      <p className="mt-12 max-w-[720px] text-callout text-fg-2">{m.templates_more_soon()}</p>

      <TemplateSheet
        templateId={chosen}
        order={order}
        onTemplateChange={setChosen}
        onClose={() => setChosen(null)}
        initialMode={startMode}
        initialPhoto={photo}
        preferredColumns={columns}
      />
    </div>
  )
}
