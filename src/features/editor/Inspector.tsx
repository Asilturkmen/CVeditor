import { useId, useLayoutEffect, useRef } from 'react'
import type { Cv } from '@/cv/schema'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { Toolbar } from '@/components/ui/Toolbar'
import { useScrollEdge } from '@/components/ui/useScrollEdge'
import { CV_FORM_ATTR } from '@/editor/shortcuts'
import { useEditorUi } from '@/editor/ui'
import { m } from '@/paraglide/messages'
import { AppearanceTab } from './appearance/AppearanceTab'
import { PromptBox } from './ai/PromptBox'
import { PersonalForm } from './content/PersonalForm'
import { PhotoPickerProvider } from './content/photo'
import { SectionList } from './content/SectionList'

const cvForm = { [CV_FORM_ATTR]: '' }

/** "Tümünü aç": kapalıyken tek kayıt açık (anahat), açıkken bütün kayıtlar açık (eski hep açık form). */
function ExpandAllSwitch() {
  const expandAll = useEditorUi((s) => s.expandAll)
  const setExpandAll = useEditorUi((s) => s.setExpandAll)
  const id = useId()
  return (
    <div className="mb-2 flex min-h-7 items-center justify-end gap-2 pr-1">
      <label htmlFor={id} className="cursor-pointer text-body text-fg">
        {m.inspector_expand_all()}
      </label>
      <Switch id={id} checked={expandAll} onCheckedChange={setExpandAll} />
    </div>
  )
}

function ContentTab({ cv }: { cv: Cv }) {
  return (
    <>
      <ExpandAllSwitch />
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
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-panel-scroll>
          <div key={tab} {...cvForm} className="animate-rise-in px-4 pt-3 pb-8">
            {tab === 'content' ? <ContentTab cv={cv} /> : <AppearanceTab cv={cv} />}
          </div>
        </div>
        <PromptBox cv={cv} scrolled={moreBelow} />
      </div>
    </PhotoPickerProvider>
  )
}
