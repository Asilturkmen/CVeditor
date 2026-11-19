import { Tooltip as T } from 'radix-ui'
import { LucideProvider } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

/**
 * Uygulama kökü sağlayıcısı: ipucu gecikmesi (ilk 600ms, komşuya geçişte 0) ve ikon çizgi kalınlığı
 * (lucide 1.75; 13px Regular metnin yanında varsayılan 2 kalın kalıyor). 20px ve üstü ikonda `strokeWidth={1.5}` ver.
 */
export function TooltipProvider({
  children,
  delayDuration = 600,
  skipDelayDuration = 400,
}: {
  children: ReactNode
  delayDuration?: number
  skipDelayDuration?: number
}) {
  return (
    <LucideProvider strokeWidth={1.75}>
      <T.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
        {children}
      </T.Provider>
    </LucideProvider>
  )
}

/** Aynı anda tek balon: yeni açılan, açık olanı kapatır (fare ve klavye karışık kullanılınca da). */
let closeCurrent: (() => void) | null = null

/**
 * İpucu balonu: açık yüzey (macOS gibi), 12px metin, en çok 240px, ok yok.
 * `shortcut` verilirse aynı satırda ikincil renkte yazılır ("Geri al  Ctrl+Z").
 * Dokunmatikte ipucu çıkmaz; anlamı etiket ya da menü öğesi taşır.
 */
export function Tooltip({
  content,
  shortcut,
  children,
  side = 'bottom',
}: {
  content: ReactNode
  shortcut?: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useEffect(
    () => () => {
      if (closeCurrent === close) closeCurrent = null
    },
    [close],
  )
  if (!content) return <>{children}</>
  return (
    <T.Root
      open={open}
      disableHoverableContent
      onOpenChange={(next) => {
        if (next) {
          if (closeCurrent && closeCurrent !== close) closeCurrent()
          closeCurrent = close
        } else if (closeCurrent === close) {
          closeCurrent = null
        }
        setOpen(next)
      }}
    >
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="tip z-[60] max-w-60 rounded-sm bg-elevated px-2 py-1 text-callout text-fg shadow-2 pointer-coarse:hidden"
        >
          {content}
          {shortcut && <span className="ml-2 text-fg-2 tabular-nums">{shortcut}</span>}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
