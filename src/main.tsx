import '@fontsource-variable/instrument-sans'
import './styles/app.css'
import './lib/prefs'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { router } from './router'
import { requestPersistence } from './lib/persistence'
import { fontFaceCss } from './render/fonts'

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
