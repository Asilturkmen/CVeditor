import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { InlineNotice } from '@/components/ui/Notice'
import { backupEverything } from '@/features/cv-actions'
import { m } from '@/paraglide/messages'
import { Wordmark } from './Wordmark'

/**
 * Bir sayfa çizilirken hata olursa (yönlendiricinin varsayılan İngilizce hata kutusu yerine):
 * ne olduğu arayüz dilinde, "Yenile" ve "Yedek al". CV'ler tarayıcıda durur; kullanıcı önce
 * yedeğini alabilsin diye yedek veritabanından doğrudan okunur (bozuk sayfaya bağlı değildir).
 */
export function RouteError({ error }: ErrorComponentProps) {
  const [backup, setBackup] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')
  useEffect(() => console.error(error), [error])
  return (
    <div
      role="alert"
      data-route-error
      className="flex min-h-dvh flex-col items-center justify-center bg-window px-6 text-center"
    >
      <Wordmark className="mb-8" />
      <h1 className="text-title-1 text-fg">{m.err_page_title()}</h1>
      <p className="mt-2 max-w-90 text-body text-fg-2">{m.err_page_body()}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button
          size="lg"
          loading={backup === 'busy'}
          onClick={() => {
            setBackup('busy')
            void backupEverything().then((ok) => setBackup(ok ? 'done' : 'failed'))
          }}
        >
          {m.backup_now()}
        </Button>
        <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
          {m.db_reload()}
        </Button>
      </div>
      {(backup === 'done' || backup === 'failed') && (
        <div role="status" className="mt-4">
          <InlineNotice tone={backup === 'failed' ? 'danger' : 'ok'}>
            {backup === 'done' ? m.err_backup_done() : m.err_backup()}
          </InlineNotice>
        </div>
      )}
    </div>
  )
}
