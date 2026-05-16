/**
 * Farmavet — Cloudflare Worker
 *
 * • Rotas /api/* → proxy para o backend Node.js (Railway / Render)
 *   configurado via variável de ambiente API_BACKEND_URL no wrangler.toml
 * • Todas as outras rotas → arquivos estáticos do build Vite (env.ASSETS)
 * • Rotas SPA (404 nos assets) → index.html (client-side routing)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// ─── Proxy para o backend real ────────────────────────────────────────────────

async function proxyToBackend(request, env) {
  const backendUrl = (env.API_BACKEND_URL || '').replace(/\/$/, '')

  if (!backendUrl) {
    return json(
      { error: 'Backend não configurado. Defina API_BACKEND_URL no wrangler.toml.' },
      503,
    )
  }

  const url = new URL(request.url)
  const targetUrl = backendUrl + url.pathname + url.search

  // Preflight CORS — responder imediatamente sem ir ao backend
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // Encaminhar a requisição original ao backend com headers preservados
  const proxyReq = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  })

  try {
    const resp = await fetch(proxyReq)
    // Repassar a resposta do backend adicionando CORS para garantir compatibilidade
    const respHeaders = new Headers(resp.headers)
    respHeaders.set('Access-Control-Allow-Origin', '*')
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    })
  } catch (err) {
    console.error('[proxy] Falha ao conectar ao backend:', err)
    return json({ error: 'Backend indisponível. Tente novamente em instantes.' }, 502)
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Todas as rotas /api/* são encaminhadas ao backend real
    if (url.pathname.startsWith('/api/')) {
      return proxyToBackend(request, env)
    }

    // Assets estáticos (Vite build)
    const assetRes = await env.ASSETS.fetch(request)

    // SPA fallback: rotas client-side (ex.: /s/TOKEN, /admin, /pedidos)
    // que não existem como arquivo → servir index.html
    if (assetRes.status === 404) {
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request))
    }

    return assetRes
  },
}
