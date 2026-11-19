import { useId, useLayoutEffect, useRef } from 'react'
import { isItemEmpty } from '@/cv/factory'
import type { AnyItem, Cv } from '@/cv/schema'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { Toolbar } from '@/components/ui/Toolbar'
import { useScrollEdge } from '@/components/ui/useScrollEdge'
import { CV_FORM_ATTR } from '@/editor/shortcuts'
import { useEditorUi } from '@/editor/ui'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { AppearanceTab } from './appearance/AppearanceTab'
import { PromptBox } from './ai/PromptBox'
import { PersonalForm } from './content/PersonalForm'
import { PhotoPickerProvider } from './content/photo'
import { SectionList } from './content/SectionList'

const cvForm = { [CV_FORM_ATTR]: '' }

/** CV'de henüz hiçbir şey yazılmamış mı (kişisel bilgi de kayıt da boş). */
function isCvBlank(cv: Cv): boolean {
  const { photo, ...personal } = cv.personal
  if (photo || Object.values(personal).some((v) => typeof v === 'string' && v.trim() !== '')) return false
  return cv.sections.every((s) => (s.items as AnyItem[]).every(isItemEmpty))
}

/**
 * Panelin üst satırı: solda (yalnız boş CV'de) sakin bir boş durum metni, sağda "Tümünü aç" — kapalıyken
 * tek kayıt açık (anahat), açıkken bütün kayıtlar açık (eski hep açık form).
 */
function ContentHeader({ blank }: { blank: boolean }) {
  const expandAll = useEditorUi((s) => s.expandAll)
  const setExpandAll = useEditorUi((s) => s.setExpandAll)
  const id = useId()
  return (
    <div className={cn('flex min-h-7 items-start gap-4 pr-1', blank ? 'mb-4' : 'mb-2')}>
      {blank && (
        <p className="min-w-0 flex-1 px-3 pt-1 text-body text-fg-2" data-empty-intro>
          {m.editor_empty_intro()}
        </p>
      )}
      <div className="ml-auto flex min-h-7 shrink-0 items-center gap-2">
        <label htmlFor={id} className="cursor-pointer text-body text-fg">
          {m.inspector_expand_all()}
        </label>
        <Switch id={id} checked={expandAll} onCheckedChange={setExpandAll} />
      </div>
    </div>
  )
}

function ContentTab({ cv }: { cv: Cv }) {
  return (
    <>
      <ContentHeader blank={isCvBlank(cv)} />
      <div className="flex flex-col gap-6">
        <PersonalForm personal={cv.personal} />
        <SectionList sections={cv.sections} language={cv.language} cvId={cv.id} />
      </div>
    </>
  )
}

/**
 * Editörün sağ paneli (denetçi): üstte İçerik | Görünüm (44px, malzeme), ortada kayan içerik, altta
 * prompt çubuğu. Genişliği ve kenar çizgisini çağıran (EditorPage) verir; bu bileşen panelin içini doldurur.
 * Ctrl+Z kuralı: CV formu `data-cv-form` kapsayıcısının içinde, prompt kutusu dışında kalır.
 */
export function Inspector({ cv }: { cv: Cv }) {
  const tab = useEditorUi((s) => s.tab)
  const setTab = useEditorUi((s) => s.setTab)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledTop = useScrollEdge(scrollRef, 'top')
  const moreBelow = useScrollEdge(scrollRef, 'bottom')
  // Sekme başına kaydırma konumu: iki sekme aynı kaydırıcıyı paylaşır; Görünüm İçerik'in konumunda
  // açılmasın (ilk açılışta en üstten), İçerik'e dönünce de kalınan yerden devam edilsin.
  const tabScroll = useRef<Record<typeof tab, number>>({ content: 0, appearance: 0 })
  const shownTab = useRef(tab)
  const onScroll = () => {
    if (scrollRef.current) tabScroll.current[shownTab.current] = scrollRef.current.scrollTop
  }
  useLayoutEffect(() => {
    if (shownTab.current === tab) return
    shownTab.current = tab
    // Bekleyen bir kaydırma hedefi (önizlemeden gelen kayıt) varsa konumu o belirler.
    if (tab === 'content' && useEditorUi.getState().scrollTarget) return
    if (scrollRef.current) scrollRef.current.scrollTop = tabScroll.current[tab]
  }, [tab])
  useLayoutEffect(() => {
    tabScroll.current = { content: 0, appearance: 0 }
  }, [cv.id])

  // Her CV açılışında Kişisel bilgiler açık gelir (boş CV'de imleç oraya gider); bekleyen bir hedef
  // (önizlemeden ya da İnceleme'den gelen kayıt) varsa onu açacak olan o hedef.
  useLayoutEffect(() => {
    const ui = useEditorUi.getState()
    if (ui.scrollTarget) return
    useEditorUi.setState({ openRowId: 'personal', collapsedRows: [] })
  }, [cv.id])

  return (
    <PhotoPickerProvider>
      <div className="flex min-h-0 flex-1 flex-col bg-window">
        <Toolbar as="div" size="md" scrolled={scrolledTop} className="shrink-0 px-4">
          <Segmented
            stretch
            value={tab}
            onChange={setTab}
            aria-label={m.editor_panel_tabs()}
            options={[
              { value: 'content', label: m.tab_content() },
              { value: 'appearance', label: m.tab_appearance() },
            ]}
          />
        </Toolbar>
        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-panel-scroll data-collision-boundary>
          <div key={tab} {...cvForm} className="animate-rise-in px-4 pt-3 pb-8">
            {tab === 'content' ? <ContentTab cv={cv} /> : <AppearanceTab cv={cv} />}
          </div>
        </div>
        <PromptBox cv={cv} scrolled={moreBelow} />
      </div>
    </PhotoPickerProvider>
  )
}
