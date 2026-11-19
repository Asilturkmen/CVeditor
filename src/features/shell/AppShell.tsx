import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Moon, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { buttonClass } from '@/components/ui/buttonClass'
import { IconButton } from '@/components/ui/IconButton'
import { NavPills, navPillClass } from '@/components/ui/NavPills'
import { FloatingNotice } from '@/components/ui/Notice'
import { Toolbar } from '@/components/ui/Toolbar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useScrollEdge } from '@/components/ui/useScrollEdge'
import { cn } from '@/lib/cn'
import { isChromium, isSafari } from '@/lib/persistence'
import { usePrefs } from '@/lib/prefs'
import { m } from '@/paraglide/messages'
import { Wordmark } from './Wordmark'

const TABS = [
  { to: '/cvler', label: () => m.nav_my_cvs() },
  { to: '/sablonlar', label: () => m.nav_templates() },
  { to: '/inceleme', label: () => m.rv_nav() },
] as const

/** Tema anahtarı (ay/güneş). Galeri sayfalarının üst çubuğunda ve editörde. */
export function ThemeToggle() {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const dark = theme === 'dark'
  const label = dark ? m.theme_to_light() : m.theme_to_dark()
  return (
    <IconButton
      label={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      icon={
        <span key={theme} className="inline-flex animate-[pop-in_200ms_var(--ease-out)]">
          {dark ? <Sun /> : <Moon />}
        </span>
      }
    />
  )
}

const BROWSER_NOTE_KEY = 'cveditor:browserNoteDismissed'

/**
 * Chromium dışı tarayıcıda bir kez gösterilen sakin not (önizleme = PDF garantisi Chromium'da).
 * Renkli bant değil: içeriğin başında tek uyarı kapsülü, "Tamam" ile kalıcı kapanır.
 */
function BrowserNote() {
  const [hidden, setHidden] = useState(() => {
    try {
      return isChromium() || localStorage.getItem(BROWSER_NOTE_KEY) === '1'
    } catch {
      return isChromium()
    }
  })
  if (hidden) return null
  // Safari ayrıca 7 gün ziyaret edilmeyen sitenin verisini silebilir (ITP): yedek hatırlatması.
  const safari = isSafari()
  return (
    <FloatingNotice
      tone="warn"
      className="mb-6 max-w-[720px] rounded-xl"
      action={
        <Button
          size="sm"
          variant="plain"
          onClick={() => {
            try {
              localStorage.setItem(BROWSER_NOTE_KEY, '1')
            } catch {
              // yalnız bu oturumda gizlenir
            }
            setHidden(true)
          }}
        >
          {m.common_ok()}
        </Button>
      }
    >
      {m.browser_note()}
      {safari && <span className="mt-1 block">{m.browser_note_safari()}</span>}
    </FloatingNotice>
  )
}

/**
 * Galeri sayfalarının kabuğu (CV'lerim, Şablonlar, İnceleme, Ayarlar): 52px malzemeli yapışkan üst çubuk,
 * içerik kabıyla aynı genişlik ve sol kenar (1240, yatay 24; telefonda 16). Solda yazı logosu, 24px
 * sonra hap sekmeler; sağda tema ve Ayarlar (4px ara). Dar ekranda sekmeler ikinci satıra iner
 * (DOM sırası aynı kalır: logo, gezinme, eylemler).
 */
export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const scrolled = useScrollEdge()
  const settingsActive = pathname.startsWith('/ayarlar')
  return (
    <div className="min-h-dvh bg-window">
      <Toolbar scrolled={scrolled} className="sticky top-0 pt-[env(safe-area-inset-top)]">
        <div
          className={cn(
            'mx-auto grid w-full max-w-[1240px] items-center gap-x-6 px-6 max-sm:px-4',
            'grid-cols-[auto_1fr_auto] [grid-template-areas:"brand_nav_actions"]',
            'max-sm:grid-cols-[1fr_auto] max-sm:gap-y-1 max-sm:pb-2 max-sm:[grid-template-areas:"brand_actions""nav_nav"]',
          )}
        >
          <Link
            to="/"
            className="flex h-13 items-center rounded-md [grid-area:brand] max-sm:h-11"
            aria-label={m.app_name()}
          >
            <Wordmark />
          </Link>
          <NavPills aria-label={m.nav_label()} className="min-w-0 [grid-area:nav] max-sm:-ml-3">
            {TABS.map((tab) => (
              <Link key={tab.to} to={tab.to} className={navPillClass}>
                {tab.label()}
              </Link>
            ))}
          </NavPills>
          <div className="flex items-center gap-1 [grid-area:actions]">
            <ThemeToggle />
            <Tooltip content={m.nav_settings()}>
              <Link
                to="/ayarlar"
                aria-label={m.nav_settings()}
                className={buttonClass({ variant: 'ghost', size: 'icon', className: cn(settingsActive && 'bg-fill-2') })}
              >
                <Settings />
              </Link>
            </Tooltip>
          </div>
        </div>
      </Toolbar>
      <main className="mx-auto max-w-[1240px] px-6 pt-8 pb-12 max-sm:px-4 max-sm:pt-6">
        <BrowserNote />
        <Outlet />
      </main>
    </div>
  )
}
