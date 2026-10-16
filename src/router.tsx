import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Navigate, Outlet } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Toaster } from '@/components/ui/Toaster'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { db } from '@/db/db'
import { AppShell } from '@/features/shell/AppShell'
import { CvListPage } from '@/features/cv-list/CvListPage'
import { TemplatesPage } from '@/features/templates/TemplatesPage'
import { NotFound } from '@/features/shell/NotFound'

const rootRoute = createRootRoute({
  component: () => (
    <TooltipProvider delayDuration={350}>
      <Outlet />
      <Toaster />
    </TooltipProvider>
  ),
  notFoundComponent: NotFound,
})

/** Ana sayfa: hiç CV yoksa Şablonlar, varsa CV'lerim. */
function HomeRedirect() {
  const count = useLiveQuery(() => db.cvs.count())
  if (count === undefined) return null
  return <Navigate to={count === 0 ? '/sablonlar' : '/cvler'} replace />
}

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeRedirect })

const shellRoute = createRoute({ getParentRoute: () => rootRoute, id: 'shell', component: AppShell })

const listRoute = createRoute({ getParentRoute: () => shellRoute, path: '/cvler', component: CvListPage })
const templatesRoute = createRoute({ getParentRoute: () => shellRoute, path: '/sablonlar', component: TemplatesPage })
const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/ayarlar',
  component: lazyRouteComponent(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
})
/** CV İnceleme; ?cv=<id> o CV'yi seçili açar. pdfjs ve kurallar ayrı parçada. */
export const reviewRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/inceleme',
  validateSearch: (search: Record<string, unknown>): { cv?: string } =>
    typeof search.cv === 'string' && search.cv ? { cv: search.cv } : {},
  component: lazyRouteComponent(() => import('@/features/review/ReviewPage'), 'ReviewPage'),
})

export const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/editor/$cvId',
  // Editör (TipTap, sürükle-bırak) ayrı parça: ilk açılış hafif kalsın.
  component: lazyRouteComponent(() => import('@/features/editor/EditorPage'), 'EditorPage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  shellRoute.addChildren([listRoute, templatesRoute, settingsRoute, reviewRoute]),
  editorRoute,
])

export const router = createRouter({
  routeTree,
  defaultViewTransition: true,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
