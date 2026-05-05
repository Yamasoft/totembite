import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration can fail in dev or on insecure origins.
    })
  })
}
