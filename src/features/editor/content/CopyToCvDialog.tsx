import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Languages } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AnyItem, Cv, SectionType } from '@/cv/schema'
import { db } from '@/db/db'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/components/ui/Toaster'
import { copyItemToCv } from '@/editor/actions'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { itemLabel } from '../labels'

/**
 * Kaydı başka bir CV'ye ekler. V1'de kayıt olduğu gibi kopyalanır;
 * "çevirerek ekle" yapay zekâyla V3'te gelecek (aynı çeviri bağıyla).
 */
export function CopyToCvDialog({
  currentCvId,
  payload,
  onClose,
}: {
  currentCvId: string
  payload: { type: SectionType; item: AnyItem } | null
  onClose: () => void
}) {
  const others = useLiveQuery(
    () => db.cvs.orderBy('updatedAt').reverse().filter((c) => c.id !== currentCvId).toArray(),
    [currentCvId],
    [] as Cv[],
  )
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (payload) setTarget(others[0]?.id ?? null)
  }, [payload, others])

  const label = payload ? itemLabel(payload.type, payload.item) || m.editor_untitled() : ''

  const submit = async () => {
    if (!payload || !target) return
    const name = await copyItemToCv(target, payload.type, payload.item)
    toast({ message: m.toast_copied_to_cv({ name }) })
    onClose()
  }

  return (
    <Dialog
      open={!!payload}
      onOpenChange={(open) => !open && onClose()}
      title={m.copy_to_cv_title()}
      description={m.copy_to_cv_desc({ name: label })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button variant="primary" disabled={!target} onClick={() => void submit()}>
            {m.copy_to_cv_submit()}
          </Button>
        </>
      }
    >
      {others.length === 0 ? (
        <p className="text-sm text-muted">{m.copy_to_cv_none()}</p>
      ) : (
        <div role="radiogroup" className="flex flex-col gap-1.5">
          {others.map((cv) => (
            <button
              key={cv.id}
              type="button"
              role="radio"
              aria-checked={target === cv.id}
              onClick={() => setTarget(cv.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                target === cv.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="rounded bg-surface-2 px-1.5 py-px text-[11px] font-semibold uppercase">{cv.language}</span>
              <span className="flex-1 font-medium">{cv.name}</span>
              {target === cv.id && <Check className="size-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
        <Languages className="mt-0.5 size-4 shrink-0" />
        <p>{m.copy_to_cv_translate_note()}</p>
      </div>
    </Dialog>
  )
}
