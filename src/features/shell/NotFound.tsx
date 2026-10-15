import { Link } from '@tanstack/react-router'
import { m } from '@/paraglide/messages'
import { Wordmark } from './Wordmark'

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark />
      <h1 className="text-xl font-semibold tracking-tight">{m.not_found_title()}</h1>
      <p className="max-w-sm text-muted">{m.not_found_body()}</p>
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        {m.not_found_home()}
      </Link>
    </div>
  )
}
