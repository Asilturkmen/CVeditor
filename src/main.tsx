import '@fontsource-variable/instrument-sans'
import './styles/app.css'
import './lib/prefs'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { router } from './router'
import { requestPersistence } from './lib/persistence'
import { fontFaceCss } from './render/fonts'
import { getLocale } from './paraglide/runtime'
import { m } from './paraglide/messages'
import { toast } from './components/ui/toast'
import { db, watchVersionChange } from './db/db'

// Arayüz dili (Paraglide: localStorage, yoksa Türkçe). CV iframe'inin lang'ı ayrı, CV dilinden gelir.
document.documentElement.lang = getLocale()

// CV yazı tipleri arayüzde de görünsün (Görünüm sekmesindeki yazı tipi listesi).
const fontStyle = document.createElement('style')
fontStyle.textContent = fontFaceCss()
document.head.appendChild(fontStyle)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

void requestPersistence()

// Başka sekmede daha yeni sürüm veritabanını yükseltirse: bağlantı kapanır, kullanıcı sayfayı yeniler.
watchVersionChange(db, (event) =>
  event === 'versionchange'
    ? toast({
        message: m.db_version_changed(),
        tone: 'error',
        duration: Infinity,
        action: { label: m.db_reload(), run: () => window.location.reload() },
      })
    : // Bu sekme yeni sürüm; eski sekme kapanınca yükseltme kendiliğinden sürer.
      toast({ message: m.db_upgrade_blocked(), tone: 'error', duration: 12_000 }),
)

// Uçtan uca testler ve geliştirme için veritabanına erişim (yalnız geliştirme sunucusunda).
if (import.meta.env.DEV) {
  ;(window as unknown as { __cveditorDb: unknown }).__cveditorDb = db
}
