import { X } from 'lucide-react'
import type { Cv } from '@/cv/schema'
import { IconButton } from '@/components/ui/IconButton'
import { Segmented } from '@/components/ui/Segmented'
import { useEditorUi } from '@/editor/ui'
import { m } from '@/paraglide/messages'
import { PagesRail } from './PagesRail'
import { TemplatesRail } from './TemplatesRail'

/** Sol rayın genişliği (px): iki sütun 100px küçük resim + 12px kenar + 8px ara. */
export const RAIL_WIDTH = 232

/**
 * Tuvalin solundaki ray (Pages'in kenar çubuğu): Şablonlar | Sayfalar. Varsayılan kapalı; üst
 * çubuktaki "Şablonlar", haptaki sayfa göstergesi, Görünüm'deki "Değiştir…" ve Ctrl+\ açar.
 * Kenardan kayarak gelir (hareket azaltılınca yalnız belirir).
 */
export function Rail({ cv }: { cv: Cv }) {
  const rail = useEditorUi((s) => s.rail)
  const setRail = useEditorUi((s) => s.setRail)
  if (!rail) return null
  return (
    <aside
      aria-label={m.rail_label()}
      data-rail={rail}
      style={{ width: RAIL_WIDTH }}
      className="flex min-h-0 shrink-0 flex-col border-r border-separator bg-window transition-[translate,opacity] duration-200 ease-out starting:-translate-x-4 starting:opacity-0 motion-reduce:starting:translate-x-0"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 pr-2 pl-3">
        <Segmented
          stretch
          className="min-w-0 flex-1"
          value={rail}
          onChange={setRail}
          aria-label={m.rail_label()}
          options={[
            { value: 'templates', label: m.rail_templates() },
            { value: 'pages', label: m.rail_pages() },
          ]}
        />
        <IconButton label={m.rail_close()} shortcut="Ctrl+\" icon={<X />} onClick={() => setRail(null)} />
      </div>
      {rail === 'templates' ? <TemplatesRail cv={cv} /> : <PagesRail cv={cv} />}
    </aside>
  )
}
