import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Moon, Settings, Sun } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'
import { usePrefs } from '@/lib/prefs'
import { m } from '@/paraglide/messages'
import { Wordmark } from './Wordmark'

const TABS = [
  { to: '/cvler', label: () => m.nav_my_cvs() },
  { to: '/sablonlar', label: () => m.nav_templates() },
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
            'flex items-center px-3 text-sm font-medium transition-colors duration-150',
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

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-[1240px] items-stretch gap-6 px-6">
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
      <main className="mx-auto max-w-[1240px] px-6 pt-8 pb-24">
        <Outlet />
      </main>
    </div>
  )
}
