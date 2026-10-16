import { Navigate } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

/** Ana sayfa: hiç CV yoksa Şablonlar, varsa CV'lerim. */
export function HomeRedirect() {
  const count = useLiveQuery(() => db.cvs.count())
  if (count === undefined) return null
  return <Navigate to={count === 0 ? '/sablonlar' : '/cvler'} replace />
}
