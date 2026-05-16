import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

function stripDevPwaLinks() {
  if (!import.meta.env.DEV) {
    return
  }

  document
    .querySelectorAll('link[rel="manifest"], link[rel="apple-touch-icon"], link[rel="mask-icon"], link[rel="apple-touch-startup-image"]')
    .forEach((element) => element.remove())
}

async function disableDevServiceWorker() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return
  }

  const hadController = Boolean(navigator.serviceWorker.controller)

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    if (hadController && !sessionStorage.getItem('farmavet-dev-sw-cleaned')) {
      sessionStorage.setItem('farmavet-dev-sw-cleaned', '1')
      window.location.reload()
    }
  } catch {
    // Dev cleanup is best-effort; the app should keep rendering.
  }
}

const canRegisterServiceWorker =
  !import.meta.env.DEV &&
  'serviceWorker' in navigator &&
  (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname))

function blockMobileZoom() {
  document.addEventListener('gesturestart', (event) => event.preventDefault())
  document.addEventListener('gesturechange', (event) => event.preventDefault())
  document.addEventListener('gestureend', (event) => event.preventDefault())
}

blockMobileZoom()
stripDevPwaLinks()
disableDevServiceWorker()

if (canRegisterServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration can fail in dev or on insecure origins.
    })
  })
}
