import { Tooltip as T } from 'radix-ui'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

export const TooltipProvider = T.Provider

/** Aynı anda tek balon: yeni açılan, açık olanı kapatır (fare ve klavye karışık kullanılınca da). */
let closeCurrent: (() => void) | null = null

export function Tooltip({
  content,
  children,
  side = 'bottom',
}: {
  content: ReactNode
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
          className="pop z-[60] max-w-64 rounded-md bg-text px-2 py-1 text-xs leading-snug text-bg shadow-md data-[state=delayed-open]:animate-[pop-in_160ms_var(--ease-out-soft)]"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
