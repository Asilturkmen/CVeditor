import { Link } from '@tanstack/react-router'
import { buttonClass } from '@/components/ui/buttonClass'
import { m } from '@/paraglide/messages'
import { Wordmark } from './Wordmark'

/** Bilinmeyen adres: ortalı (ortalamanın izinli olduğu yer), yazı logosu, title-1, tek birincil eylem. */
export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-window px-6 text-center">
      <Wordmark className="mb-8" />
      <h1 className="text-title-1 text-fg">{m.not_found_title()}</h1>
      <p className="mt-2 max-w-90 text-body text-fg-2">{m.not_found_body()}</p>
      <Link to="/" className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-5' })}>
        {m.not_found_home()}
      </Link>
    </div>
  )
}
