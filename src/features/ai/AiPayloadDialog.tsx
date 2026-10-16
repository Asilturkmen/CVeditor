import type { ReactNode } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'

/** "Örnek" rozeti: örnek sağlayıcının çıktısının yanında. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-full bg-warn-soft px-1.5 py-px text-[11px] font-medium text-warn', className)}>
      {m.badge_sample()}
    </span>
  )
}

/**
 * Yüklenen PDF'te kişinin adı tahmin edilemedi: metinde geçiyorsa maskelenmeden
 * gidebilir. Gönder düğmesinin üstünde, istek atılmadan önce görünür.
 */
export function NameMissingNote({ className }: { className?: string }) {
  return (
    <p data-testid="ai-name-missing" className={cn('mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn', className)}>
      {m.rv_ai_name_missing()}
    </p>
  )
}

/** "Ne gönderilir?" bağlantısı (PromptBox'taki ile aynı görünüm). */
export function WhatIsSentButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded font-medium text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-text',
        className,
      )}
    >
      {m.ai2_what_is_sent()}
    </button>
  )
}

/**
 * "Ne gönderilir?": bu istek için sağlayıcıya gidecek verinin tamamı.
 * `build`, gönderimin kullandığı fonksiyonla aynı girdilerden kurulmalı. Pencere
 * açıkken her işlemede yeniden çağrılır: girdiler (ör. ilan metni) değişirse
 * gösterilen de değişir, pencere her zaman o an gönderilecek olanı gösterir.
 */
export function AiPayloadDialog({
  open,
  onClose,
  build,
  description,
  rules,
  warning,
  demo,
}: {
  open: boolean
  onClose: () => void
  build: () => unknown
  description: ReactNode
  rules: ReactNode
  /** Kurallardan önce gösterilen uyarı (ör. PDF'te ad bulunamadı) */
  warning?: ReactNode
  demo: boolean
}) {
  const json = open ? JSON.stringify(build(), null, 2) : ''
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={m.ai2_payload_title()}
      description={description}
      className="w-[min(92vw,640px)]"
    >
      {warning && (
        <p data-testid="ai-payload-warning" className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] leading-relaxed text-warn">
          {warning}
        </p>
      )}
      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        {rules}
        {demo && <span className="mt-1.5 block font-medium text-text">{m.ai2_payload_demo()}</span>}
      </p>
      <pre
        data-testid="ai-payload"
        className="max-h-[52vh] overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap text-text"
      >
        {json}
      </pre>
    </Dialog>
  )
}
