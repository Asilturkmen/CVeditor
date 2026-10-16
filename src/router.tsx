import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/Toaster'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { AiAuthDialog } from '@/features/ai/AiAuthDialog'
import { AppShell } from '@/features/shell/AppShell'
import { HomeRedirect } from '@/features/shell/HomeRedirect'
import { CvListPage } from '@/features/cv-list/CvListPage'
import { TemplatesPage } from '@/features/templates/TemplatesPage'
import { NotFound } from '@/features/shell/NotFound'

const rootRoute = createRootRoute({
  component: () => (
    <TooltipProvider delayDuration={350}>
      <Outlet />
      <Toaster />
      <AiAuthDialog />
    </TooltipProvider>
  ),
  notFoundComponent: NotFound,
})

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
