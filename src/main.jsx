import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

const canRegisterServiceWorker =
  'serviceWorker' in navigator &&
  (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname))

function blockMobileZoom() {
  document.addEventListener('gesturestart', (event) => event.preventDefault())
  document.addEventListener('gesturechange', (event) => event.preventDefault())
  document.addEventListener('gestureend', (event) => event.preventDefault())
}

blockMobileZoom()

if (canRegisterServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration can fail in dev or on insecure origins.
    })
  })
}
