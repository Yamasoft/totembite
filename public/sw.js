const CACHE_NAME = 'farmavet-shell-v1'
const PRECACHE_URLS = [
  '/',
  '/instalar.html',
  '/limpar.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-icon.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/pwa-splash.svg',
  '/apple-touch-icon.png',
  '/apple-splash-1290-2796.png',
  '/apple-splash-1179-2556.png',
  '/apple-splash-1170-2532.png',
  '/apple-splash-1125-2436.png',
  '/apple-splash-828-1792.png',
  '/apple-splash-750-1334.png',
]

function offlineHtml() {
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#c82e24">
  <title>Farmavet indisponivel</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8ef;font-family:Arial,sans-serif;color:#2b1406}
    main{width:min(520px,100%);padding:28px;text-align:center}
    h1{margin:0 0 12px;font-size:28px}
    p{margin:0 0 18px;font-size:17px;line-height:1.4;color:#7a5448}
    button{width:100%;min-height:54px;border:0;border-radius:14px;background:#c82e24;color:#fff;font:inherit;font-weight:900}
  </style>
</head>
<body>
  <main>
    <h1>Farmavet indisponivel</h1>
    <p>O servidor da loja nao esta conectado agora. Verifique a conexao e tente novamente.</p>
    <button onclick="location.reload()">Tentar novamente</button>
  </main>
</body>
</html>`,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE_NAME ? Promise.resolve() : caches.delete(key)))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Sem conexao com o servidor.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })),
    )
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status >= 500) {
            return offlineHtml()
          }
          return response
        })
        .catch(() => offlineHtml()),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const shouldPreferNetwork =
        requestUrl.pathname === '/sw.js' ||
        requestUrl.pathname === '/manifest.webmanifest' ||
        requestUrl.pathname.endsWith('.html')

      if (cachedResponse && !shouldPreferNetwork) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && response.type !== 'opaque') {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
          }
          return response
        })
        .catch(() => cachedResponse)
    }),
  )
})
