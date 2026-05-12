/**
 * Farmavet — Cloudflare Worker (demo)
 *
 * • Rotas /api/* → dados de demonstração (sem banco, sem backend)
 * • Todas as outras rotas → arquivos estáticos do build Vite (env.ASSETS)
 * • Rotas SPA (404 nos assets) → index.html (client-side routing)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

function demoId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase()
}

function demoPassword() {
  return String(Math.floor(Math.random() * 90) + 10)
}

// ─── Dados de demonstração ────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: 'racao-caes-adultos',
    name: 'Ração para cães adultos 15 kg',
    description: 'Fórmula balanceada para manutenção, digestão saudável e pelagem.',
    category: 'produtos',
    categoryLabel: 'Produto pet',
    price: 189.9,
    stock: 20,
    promo: false,
    combo: false,
    image: '/images/racao-caes-adultos.png',
  },
  {
    id: 'racao-gatos-castrados',
    name: 'Ração para gatos castrados 7 kg',
    description: 'Controle de peso e saúde urinária com nutrientes específicos.',
    category: 'produtos',
    categoryLabel: 'Produto pet',
    price: 165.9,
    stock: 18,
    promo: false,
    combo: false,
    image: '/images/racao-gatos-castrados.png',
  },
  {
    id: 'antipulgas-carrapatos',
    name: 'Antipulgas e carrapatos (pipeta)',
    description: 'Proteção mensal recomendada por veterinários para cães e gatos.',
    category: 'produtos',
    categoryLabel: 'Produto pet',
    price: 72.9,
    stock: 40,
    promo: true,
    combo: false,
    image: '/images/antipulgas-pipeta.png',
  },
  {
    id: 'vermifugo',
    name: 'Vermífugo oral',
    description: 'Reposição conforme peso do pet e orientação clínica.',
    category: 'produtos',
    categoryLabel: 'Produto pet',
    price: 38.9,
    stock: 35,
    promo: false,
    combo: false,
    image: '/images/vermifugo.png',
  },
  {
    id: 'shampoo-neutro-pet',
    name: 'Shampoo pet dermatológico',
    description: 'Limpeza suave para peles sensíveis; uso domiciliar recomendado.',
    category: 'produtos',
    categoryLabel: 'Produto pet',
    price: 42.9,
    stock: 28,
    promo: false,
    combo: false,
    image: '/images/shampoo-pet.png',
  },
  {
    id: 'brinquedo-mordedor',
    name: 'Brinquedo para roer e distraction',
    description: 'Resistente, auxília no comportamento e entretenimento seguro.',
    category: 'produtos',
    categoryLabel: 'Produto pet',
    price: 34.9,
    stock: 22,
    promo: false,
    combo: false,
    image: '/images/brinquedo-pet.png',
  },
  {
    id: 'banho-completo-pet',
    name: 'Banho completo',
    description: 'Higiene completa com secagem, escovação e hidratação leve.',
    category: 'banho_tosa',
    categoryLabel: 'Banho e tosa',
    price: 69.9,
    stock: 15,
    promo: false,
    combo: false,
    image: '/images/banho-completo.png',
  },
  {
    id: 'pacote-banho-hidratacao',
    name: 'Banho + hidratação de pelagem',
    description: 'Pacote combinado para brilho e conforto da pele e pelo.',
    category: 'banho_tosa',
    categoryLabel: 'Banho e tosa',
    price: 94.9,
    stock: 12,
    promo: true,
    combo: true,
    image: '/images/banho-hidratacao.png',
  },
  {
    id: 'tosa-higienica',
    name: 'Tosa higiênica',
    description: 'Corte técnico para higiene e conforto no dia a dia.',
    category: 'banho_tosa',
    categoryLabel: 'Banho e tosa',
    price: 55.0,
    stock: 14,
    promo: false,
    combo: false,
    image: '/images/tosa-higienica.png',
  },
  {
    id: 'consulta-veterinaria',
    name: 'Consulta veterinária',
    description: 'Avaliação clínica com orientação e plano de cuidados.',
    category: 'clinica',
    categoryLabel: 'Clínica veterinária',
    price: 120.0,
    stock: 10,
    promo: false,
    combo: false,
    image: '/images/consulta-veterinaria.png',
  },
  {
    id: 'vacinacao-v8-v10',
    name: 'Vacinação (V8/V10 ou equivalente)',
    description: 'Aplicação com checagem prévia e registro do pet.',
    category: 'clinica',
    categoryLabel: 'Clínica veterinária',
    price: 135.0,
    stock: 12,
    promo: false,
    combo: false,
    image: '/images/vacinacao.png',
  },
  {
    id: 'exames-basicos',
    name: 'Exames básicos (pacote laboratorial)',
    description: 'Hemograma e bioquímica simples; indicação conforme avaliação.',
    category: 'clinica',
    categoryLabel: 'Clínica veterinária',
    price: 189.0,
    stock: 8,
    promo: false,
    combo: false,
    image: '/images/exames-basicos.png',
  },
  {
    id: 'promo-banho-semana',
    name: 'Promoção de banho (dias de semana)',
    description: 'Valor promocional para banho completo agendado pelo app.',
    category: 'promocoes',
    categoryLabel: 'Promoção',
    price: 59.9,
    stock: 25,
    promo: true,
    combo: false,
    image: '/images/promo-banho.png',
  },
  {
    id: 'pacote-vacinacao',
    name: 'Pacote de vacinação',
    description: 'Combo com vacinas essenciais e antirrábica conforme protocolo.',
    category: 'promocoes',
    categoryLabel: 'Promoção',
    price: 249.9,
    stock: 6,
    promo: true,
    combo: false,
    image: '/images/pacote-vacinacao.png',
  },
  {
    id: 'kit-petshop-desconto',
    name: 'Kit petshop (ração + antipulgas)',
    description: 'Oferta combinada para proteção e nutrição do mês.',
    category: 'promocoes',
    categoryLabel: 'Promoção',
    price: 218.0,
    stock: 10,
    promo: true,
    combo: true,
    image: '/images/kit-petshop-promo.png',
  },
]

const PROMOTIONS = [
  {
    id: 'promo-1',
    tag: 'Banho e Tosa',
    title: 'Promoção de banho para cães e gatos',
    description: 'Banho completo com secagem e finalização. Válido em dias da semana no app.',
    highlight: 'a partir de R$ 59,90',
    image: '/images/banho-hidratacao.png',
  },
  {
    id: 'promo-2',
    tag: 'Vacinação',
    title: 'Pacote de vacinação com condição especial',
    description: 'Combine V8/V10 e antirrábica com orientação pós-vacina.',
    highlight: 'pacote a partir de R$ 189,90',
    image: '/images/vacinacao.png',
  },
  {
    id: 'promo-3',
    tag: 'PetShop',
    title: 'Ração premium com preço especial',
    description: 'Seleção para diferentes portes e idades.',
    highlight: 'até 15% OFF',
    image: '/images/racao-caes-adultos.png',
  },
]

// ─── Roteador da API demo ─────────────────────────────────────────────────────

async function handleApi(request, url) {
  const { pathname, searchParams } = url
  const method = request.method

  // Preflight CORS
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // GET /api/products
  if (pathname === '/api/products' && method === 'GET') {
    return json(PRODUCTS)
  }

  // GET /api/promotions
  if (pathname === '/api/promotions' && method === 'GET') {
    return json(PROMOTIONS)
  }

  // GET /api/meta
  if (pathname === '/api/meta' && method === 'GET') {
    return json({
      name: 'Farmavet',
      open: true,
      demo: true,
      message: 'Demonstração — pedidos não são processados.',
    })
  }

  // POST /api/orders  — cria pedido demo e retorna token de rastreamento
  if (pathname === '/api/orders' && method === 'POST') {
    const id = 'DEMO-' + demoId()
    const password = demoPassword()
    const statusToken = 'demo-' + demoId() + demoId()
    const now = new Date().toISOString()

    return json({
      order: {
        id,
        password,
        status: 'received',
        total: 0,
        mode: 'pickup',
        customer_name: 'Cliente Demo',
        phone: '',
        address: '',
        created_at: now,
        statusToken,
      },
    })
  }

  // GET /api/status/:token  — status do pedido (tracking)
  if (pathname.startsWith('/api/status/') && method === 'GET') {
    return json({
      id: 'DEMO-' + demoId(),
      password: demoPassword(),
      status: 'received',
      total: 0,
      subtotal: 0,
      delivery_fee: 0,
      mode: 'pickup',
      customer_name: 'Cliente Demo',
      phone: '',
      address: '',
      created_at: new Date().toISOString(),
      items: [],
    })
  }

  // GET /api/orders  — lista de pedidos (admin)
  if (pathname === '/api/orders' && method === 'GET') {
    return json([])
  }

  // GET /api/dashboard  — painel admin (demo sem dados)
  if (pathname === '/api/dashboard' && method === 'GET') {
    return json({
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      todayRevenue: 0,
      demo: true,
    })
  }

  // GET /api/kitchen/orders
  if (pathname === '/api/kitchen/orders' && method === 'GET') {
    return json([])
  }

  // GET /api/pix/status/:txid
  if (pathname.startsWith('/api/pix/status/') && method === 'GET') {
    return json({ status: 'ATIVA', txid: pathname.split('/').pop(), sandbox: true })
  }

  // PUT /api/orders/:id/cancel
  if (pathname.includes('/cancel') && method === 'PUT') {
    return json({ ok: true })
  }

  // POST /api/admin/login  — bloquear acesso admin em demo
  if (pathname === '/api/admin/login' && method === 'POST') {
    return json({ error: 'Painel admin não disponível na demonstração.' }, 403)
  }

  // ── Appointments (demo) ─────────────────────────────────────────────────

  // GET /api/appointments/slots
  if (pathname === '/api/appointments/slots' && method === 'GET') {
    const data = url.searchParams.get('data') || ''
    const servicoTipo = url.searchParams.get('servico_tipo') || 'banho'
    const durations = { banho:60,tosa:90,banho_tosa:120,hidratacao:60,consulta_veterinaria:30,vacinacao:20,exame:40 }
    const capacities = { banho:2,tosa:2,banho_tosa:2,hidratacao:2,consulta_veterinaria:1,vacinacao:3,exame:1 }
    const profMap = {
      banho:['Dani','Marcos'],tosa:['Dani','Marcos'],banho_tosa:['Dani','Marcos'],hidratacao:['Dani','Marcos'],
      consulta_veterinaria:['Dr. Pedro','Dra. Ana'],vacinacao:['Dr. Pedro','Dra. Ana'],exame:['Dr. Pedro','Dra. Ana'],
    }
    const duration = durations[servicoTipo] ?? 60
    const capacity = capacities[servicoTipo] ?? 1
    const professionals = profMap[servicoTipo] ?? ['Profissional']
    const slots = []
    for (let min = 8*60; min + duration <= 18*60; min += 30) {
      const hh = String(Math.floor(min/60)).padStart(2,'0')
      const mm = String(min%60).padStart(2,'0')
      const endMin = min + duration
      const ehh = String(Math.floor(endMin/60)).padStart(2,'0')
      const emm = String(endMin%60).padStart(2,'0')
      for (const profissional of professionals) {
        slots.push({ hora_inicio:`${hh}:${mm}`, hora_fim:`${ehh}:${emm}`, profissional, capacity, booked:0, available:true })
      }
    }
    return json(slots)
  }

  // GET /api/appointments
  if (pathname === '/api/appointments' && method === 'GET') {
    return json([])
  }

  // POST /api/appointments
  if (pathname === '/api/appointments' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    return json({
      id: `ag-demo-${Date.now()}`,
      ...body,
      status: 'agendado',
      created_at: new Date().toISOString(),
    }, 201)
  }

  // PATCH /api/appointments/:id/status
  if (pathname.match(/^\/api\/appointments\/[^/]+\/status$/) && method === 'PATCH') {
    const body = await request.json().catch(() => ({}))
    return json({ ok: true, status: body.status })
  }

  // DELETE /api/appointments/:id
  if (pathname.match(/^\/api\/appointments\/[^/]+$/) && method === 'DELETE') {
    return new Response(null, { status: 204 })
  }

  // ── End appointments demo ───────────────────────────────────────────────

  // ── Pets (demo) ─────────────────────────────────────────────────────────

  // GET /api/pets/lookup?tel=  — retorna array vazio na demo
  if (pathname === '/api/pets/lookup' && method === 'GET') {
    return json([])
  }

  // GET /api/pets
  if (pathname === '/api/pets' && method === 'GET') {
    return json([])
  }

  // GET /api/pets/:id
  if (pathname.match(/^\/api\/pets\/[^/]+$/) && method === 'GET') {
    return json({ error: 'Pet não encontrado na demonstração.' }, 404)
  }

  // POST /api/pets
  if (pathname === '/api/pets' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    return json({
      id: `pet-demo-${Date.now()}`,
      ...body,
      ativo: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 201)
  }

  // PUT /api/pets/:id
  if (pathname.match(/^\/api\/pets\/[^/]+$/) && method === 'PUT') {
    const body = await request.json().catch(() => ({}))
    return json({ ...body, updated_at: new Date().toISOString() })
  }

  // DELETE /api/pets/:id
  if (pathname.match(/^\/api\/pets\/[^/]+$/) && method === 'DELETE') {
    return new Response(null, { status: 204 })
  }

  // ── End pets demo ────────────────────────────────────────────────────────

  // Qualquer outra rota /api não implementada
  return json({ error: 'Endpoint não disponível na demonstração.' }, 404)
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // API demo — intercepta antes dos assets
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(request, url)
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
