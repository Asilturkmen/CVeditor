import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/buttonClass'
import { Dialog } from '@/components/ui/Dialog'
import { InlineNotice } from '@/components/ui/Notice'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'

/** "Örnek" rozeti: örnek sağlayıcının çıktısının yanında. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warn" className={className}>
      {m.badge_sample()}
    </Badge>
  )
}

/**
 * Yüklenen PDF'te kişinin adı tahmin edilemedi: metinde geçiyorsa maskelenmeden
 * gidebilir. Gönder düğmesinin üstünde, istek atılmadan önce görünür.
 */
export function NameMissingNote({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div data-testid="ai-name-missing" className={cn('mt-3', className)}>
      <InlineNotice tone="warn">{children ?? m.rv_ai_name_missing()}</InlineNotice>
    </div>
  )
}

/** "Ne gönderilir?" bağlantısı (PromptBox, İnceleme): düz vurgu düğmesi, pencere açar. */
export function WhatIsSentButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={buttonClass({ variant: 'plain', size: 'sm', className: cn('-mx-2 phone:h-11', className) })}>
      {m.ai2_what_is_sent()}
    </button>
  )
}

/**
 * "Ne gönderilir?": bu istek için sağlayıcıya gidecek verinin tamamı.
 * `build`, gönderimin kullandığı fonksiyonla aynı girdilerden kurulmalı. Pencere
 * açıkken her işlemede yeniden çağrılır: girdiler (ör. ilan metni) değişirse
 * gösterilen de değişir, pencere her zaman o an gönderilecek olanı gösterir.
 *
 * Düzen: önce uyarı (varsa), sonra neyin gidip neyin gitmediği (kurallar, örnek sağlayıcı notu),
 * en altta gidecek verinin kendisi. Veri her zaman DOM'da ve seçilebilir; uzunsa kendi kabında kayar.
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
      size="lg"
      closeButton
    >
      <div className="flex flex-col gap-3">
        {warning && (
          <div data-testid="ai-payload-warning">
            <InlineNotice tone="warn">{warning}</InlineNotice>
          </div>
        )}
        <p className="text-body text-fg">{rules}</p>
        {demo && <InlineNotice tone="info">{m.ai2_payload_demo()}</InlineNotice>}
        <div>
          <h3 className="mb-1.5 text-headline text-fg">{m.ai2_payload_data()}</h3>
          <pre
            data-testid="ai-payload"
            tabIndex={0}
            aria-label={m.ai2_payload_data()}
            className="max-h-[min(48dvh,28rem)] overflow-auto rounded-lg bg-fill-4 px-3 py-2.5 font-mono text-callout break-words whitespace-pre-wrap text-fg"
          >
            {json}
          </pre>
        </div>
      </div>
    </Dialog>
  )
}
