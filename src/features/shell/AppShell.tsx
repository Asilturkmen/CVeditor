import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Info, Moon, Settings, Sun } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'
import { isChromium } from '@/lib/persistence'
import { usePrefs } from '@/lib/prefs'
import { m } from '@/paraglide/messages'
import { Wordmark } from './Wordmark'

const TABS = [
  { to: '/cvler', label: () => m.nav_my_cvs() },
  { to: '/sablonlar', label: () => m.nav_templates() },
  { to: '/inceleme', label: () => m.rv_nav() },
] as const

function NavTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const refs = useRef(new Map<string, HTMLAnchorElement>())
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null)
  const active = TABS.find((t) => pathname.startsWith(t.to))?.to ?? null

  useLayoutEffect(() => {
    const el = active ? refs.current.get(active) : null
    setBar(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [active])

  return (
    <nav className="relative flex h-full items-stretch gap-1" aria-label={m.nav_label()}>
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          ref={(el) => {
            if (el) refs.current.set(tab.to, el)
          }}
          className={cn(
            'flex items-center px-2 text-sm sm:px-3 font-medium transition-colors duration-150',
            active === tab.to ? 'text-text' : 'text-muted hover:text-text',
          )}
        >
          {tab.label()}
        </Link>
      ))}
      {bar && (
        <span
          aria-hidden
          className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-[left,width] duration-250 ease-[var(--ease-out-soft)]"
          style={{ left: bar.left + 10, width: bar.width - 20 }}
        />
      )}
    </nav>
  )
}

export function ThemeToggle() {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const dark = theme === 'dark'
  return (
    <Tooltip content={dark ? m.theme_to_light() : m.theme_to_dark()}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={dark ? m.theme_to_light() : m.theme_to_dark()}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        <span key={theme} className="animate-[pop-in_220ms_var(--ease-out-soft)]">
          {dark ? <Sun /> : <Moon />}
        </span>
      </Button>
    </Tooltip>
  )
}

const BROWSER_NOTE_KEY = 'cveditor:browserNoteDismissed'

/** Chromium dışı tarayıcıda bir kez gösterilen sakin not (önizleme = PDF garantisi Chromium'da). */
function BrowserNote() {
  const [hidden, setHidden] = useState(() => {
    try {
      return isChromium() || localStorage.getItem(BROWSER_NOTE_KEY) === '1'
    } catch {
      return isChromium()
    }
  })
  if (hidden) return null
  return (
    <div className="border-b border-warn/25 bg-warn-soft">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-6 py-2 text-[13px]">
        <Info className="size-4 shrink-0 text-warn" />
        <p className="flex-1">{m.browser_note()}</p>
        <Button
          size="sm"
          variant="ghost"
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
      </div>
    </div>
  )
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="min-h-dvh">
      <BrowserNote />
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-[1240px] items-stretch gap-3 px-4 sm:gap-6 sm:px-6">
          <Link to="/" className="flex items-center" aria-label={m.app_name()}>
            <Wordmark />
          </Link>
          <NavTabs />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Tooltip content={m.nav_settings()}>
              <Link
                to="/ayarlar"
                aria-label={m.nav_settings()}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-lg transition-colors',
                  pathname.startsWith('/ayarlar') ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                <Settings className="size-4" />
              </Link>
            </Tooltip>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 pb-24">
        <Outlet />
      </main>
    </div>
  )
}
