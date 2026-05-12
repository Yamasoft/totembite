import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { categories, initialDailyPromotions, initialMenuItems } from '../src/data/menu.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const workspaceDataDir = join(rootDir, 'data')
const legacyJsonPath = join(workspaceDataDir, 'totem-bite-store.json')
const sqlitePath = process.env.FARMAVET_DB_PATH || 'C:/Farmavet/data/farmavet.db'
const serverPort = parseInt(process.env.PORT || '3002', 10)
const authSecret = process.env.ADMIN_AUTH_SECRET || 'farmavet-local-secret'
const defaultAdminUser = process.env.ADMIN_USER || 'admin'
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123'
const appTimeZone = 'America/Sao_Paulo'

mkdirSync(workspaceDataDir, { recursive: true })
mkdirSync(dirname(sqlitePath), { recursive: true })

const db = new Database(sqlitePath)
db.pragma('foreign_keys = ON')

const migrations = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL,
        promo INTEGER NOT NULL DEFAULT 0,
        combo INTEGER NOT NULL DEFAULT 0,
        image TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY,
        tag TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        highlight TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        mode TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        subtotal REAL NOT NULL,
        delivery_fee REAL NOT NULL,
        total REAL NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `,
  },
  {
    id: '002_appointments',
    sql: `
      CREATE TABLE IF NOT EXISTS appointments (
        id                TEXT PRIMARY KEY,
        cliente_nome      TEXT NOT NULL,
        cliente_telefone  TEXT NOT NULL,
        pet_nome          TEXT NOT NULL,
        pet_tipo          TEXT NOT NULL,
        pet_porte         TEXT NOT NULL,
        servico_tipo      TEXT NOT NULL,
        servico_nome      TEXT NOT NULL,
        profissional      TEXT NOT NULL,
        data              TEXT NOT NULL,
        hora_inicio       TEXT NOT NULL,
        hora_fim          TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'agendado',
        observacoes       TEXT NOT NULL DEFAULT '',
        created_at        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_data
        ON appointments(data);
      CREATE INDEX IF NOT EXISTS idx_appointments_profissional_data
        ON appointments(profissional, data);
    `,
  },
  {
    id: '003_pets',
    sql: `
      CREATE TABLE IF NOT EXISTS pets (
        id                TEXT PRIMARY KEY,
        nome              TEXT NOT NULL,
        tipo              TEXT NOT NULL,
        raca              TEXT NOT NULL DEFAULT '',
        porte             TEXT NOT NULL DEFAULT '',
        sexo              TEXT NOT NULL DEFAULT '',
        data_nascimento   TEXT NOT NULL DEFAULT '',
        cor               TEXT NOT NULL DEFAULT '',
        responsavel_nome  TEXT NOT NULL,
        responsavel_tel   TEXT NOT NULL,
        responsavel_email TEXT NOT NULL DEFAULT '',
        observacoes       TEXT NOT NULL DEFAULT '',
        ativo             INTEGER NOT NULL DEFAULT 1,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pets_responsavel_tel
        ON pets(responsavel_tel);
      CREATE INDEX IF NOT EXISTS idx_pets_nome
        ON pets(nome);
    `,
  },
  {
    id: '003b_appointments_pet_id',
    sql: `
      ALTER TABLE appointments ADD COLUMN pet_id TEXT REFERENCES pets(id);
    `,
  },
]

// ── Scheduling config ──────────────────────────────────────────────────────
const SERVICE_DURATION = {
  banho: 60,
  tosa: 90,
  banho_tosa: 120,
  hidratacao: 60,
  consulta_veterinaria: 30,
  vacinacao: 20,
  exame: 40,
}

const SERVICE_CAPACITY = {
  banho: 2,
  tosa: 2,
  banho_tosa: 2,
  hidratacao: 2,
  consulta_veterinaria: 1,
  vacinacao: 3,
  exame: 1,
}

const SERVICE_LABEL = {
  banho: 'Banho',
  tosa: 'Tosa',
  banho_tosa: 'Banho + Tosa',
  hidratacao: 'Hidratação',
  consulta_veterinaria: 'Consulta Veterinária',
  vacinacao: 'Vacinação',
  exame: 'Exame',
}

const PROFESSIONALS = {
  banho_tosa: ['Dani', 'Marcos'],
  clinica: ['Dr. Pedro', 'Dra. Ana'],
}

function serviceProfessionals(servicoTipo) {
  if (['banho', 'tosa', 'banho_tosa', 'hidratacao'].includes(servicoTipo)) {
    return PROFESSIONALS.banho_tosa
  }
  return PROFESSIONALS.clinica
}

/** Adds HH:MM + minutes → HH:MM (same day, no overflow guard needed for our ranges) */
function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Returns true if there is still capacity for the given slot.
 * Capacity is per (profissional, data) pair — counts non-cancelled appointments
 * whose time range overlaps [hora_inicio, hora_fim).
 */
function hasCapacity(data, hora_inicio, hora_fim, servico_tipo, profissional) {
  const count = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM appointments
       WHERE profissional = ?
         AND data = ?
         AND status != 'cancelado'
         AND hora_inicio < ?
         AND hora_fim > ?`,
    )
    .get(profissional, data, hora_fim, hora_inicio).cnt

  return count < (SERVICE_CAPACITY[servico_tipo] ?? 1)
}

// ── End scheduling config ───────────────────────────────────────────────────

function timeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )
  return Math.round((zonedAsUtc - date.getTime()) / 60000)
}

function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-'
  const absolute = Math.abs(minutes)
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

function nowIso() {
  const date = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${formatOffset(timeZoneOffsetMinutes(date, appTimeZone))}`
}

function nowTimestampMs() {
  return Date.now()
}

function hashPassword(password) {
  return createHmac('sha256', authSecret).update(password).digest('hex')
}

function signToken(username) {
  const payload = `${username}.${nowTimestampMs()}.${randomBytes(12).toString('hex')}`
  const signature = createHmac('sha256', authSecret).update(payload).digest('hex')
  return `${payload}.${signature}`
}

function verifyToken(token) {
  if (!token) {
    return false
  }

  const parts = token.split('.')

  if (parts.length < 4) {
    return false
  }

  const signature = parts.pop()
  const payload = parts.join('.')
  const expected = createHmac('sha256', authSecret).update(payload).digest('hex')

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

function applyMigrations() {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  const applied = new Set(
    db.prepare('SELECT id FROM migrations ORDER BY applied_at').all().map((row) => row.id),
  )
  const insertMigration = db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)')

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue
    }

    db.exec(migration.sql)
    insertMigration.run(migration.id, nowIso())
  }
}

function seedAdmin() {
  const existing = db
    .prepare('SELECT id FROM admin_users WHERE username = ?')
    .get(defaultAdminUser)

  if (existing) {
    return
  }

  db.prepare(`
    INSERT INTO admin_users (id, username, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run('admin-1', defaultAdminUser, hashPassword(defaultAdminPassword), nowIso())
}

function countTable(tableName) {
  return db.prepare(`SELECT COUNT(*) AS total FROM ${tableName}`).get().total
}

function seedProducts() {
  if (countTable('products') > 0) {
    return
  }

  const insert = db.prepare(`
    INSERT INTO products (
      id, name, description, category, category_label, price, stock, promo, combo, image, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const item of initialMenuItems) {
    const timestamp = nowIso()
    insert.run(
      item.id,
      item.name,
      item.description,
      item.category,
      item.categoryLabel,
      item.price,
      item.stock,
      item.promo ? 1 : 0,
      item.combo ? 1 : 0,
      item.image,
      timestamp,
      timestamp,
    )
  }
}

function seedPromotions() {
  if (countTable('promotions') > 0) {
    return
  }

  const insert = db.prepare(`
    INSERT INTO promotions (id, tag, title, description, highlight, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const promotion of initialDailyPromotions) {
    const timestamp = nowIso()
    insert.run(
      promotion.id,
      promotion.tag,
      promotion.title,
      promotion.description,
      promotion.highlight,
      timestamp,
      timestamp,
    )
  }
}

function importLegacyJsonStore() {
  if (!existsSync(legacyJsonPath)) {
    return
  }

  if (countTable('orders') > 0 || countTable('products') > 0 || countTable('promotions') > 0) {
    return
  }

  const legacyStore = JSON.parse(readFileSync(legacyJsonPath, 'utf-8'))
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, description, category, category_label, price, stock, promo, combo, image, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertPromotion = db.prepare(`
    INSERT INTO promotions (id, tag, title, description, highlight, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, created_at, mode, customer_name, phone, address, subtotal, delivery_fee, total, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, price, quantity)
    VALUES (?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const item of legacyStore.products || []) {
      const timestamp = item.updatedAt || item.createdAt || nowIso()
      insertProduct.run(
        item.id,
        item.name,
        item.description,
        item.category,
        item.categoryLabel,
        Number(item.price),
        Number(item.stock),
        item.promo ? 1 : 0,
        item.combo ? 1 : 0,
        item.image,
        item.createdAt || timestamp,
        timestamp,
      )
    }

    for (const promo of legacyStore.promotions || []) {
      const timestamp = promo.updatedAt || promo.createdAt || nowIso()
      insertPromotion.run(
        promo.id,
        promo.tag,
        promo.title,
        promo.description,
        promo.highlight,
        promo.createdAt || timestamp,
        timestamp,
      )
    }

    for (const order of legacyStore.orders || []) {
      insertOrder.run(
        order.id,
        order.createdAt || nowIso(),
        order.mode,
        order.customerName,
        order.phone,
        order.address,
        Number(order.subtotal),
        Number(order.deliveryFee),
        Number(order.total),
        order.status || 'confirmado',
      )

      for (const item of order.items || []) {
        insertOrderItem.run(
          order.id,
          item.id || item.productId || '',
          item.name,
          Number(item.price),
          Number(item.quantity),
        )
      }
    }
  })

  transaction()
  unlinkSync(legacyJsonPath)
}

applyMigrations()
seedAdmin()
importLegacyJsonStore()
seedProducts()
seedPromotions()

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

function notFound(response) {
  sendJson(response, 404, { error: 'Rota nao encontrada.' })
}

function unauthorized(response) {
  sendJson(response, 401, { error: 'Autenticacao obrigatoria.' })
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

function requireAuth(request, response) {
  const authHeader = request.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!verifyToken(token)) {
    unauthorized(response)
    return false
  }

  return true
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    categoryLabel: row.category_label,
    price: row.price,
    stock: row.stock,
    promo: Boolean(row.promo),
    combo: Boolean(row.combo),
    image: row.image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPromotion(row) {
  return {
    id: row.id,
    tag: row.tag,
    title: row.title,
    description: row.description,
    highlight: row.highlight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function listProducts() {
  return db.prepare('SELECT * FROM products ORDER BY created_at DESC').all().map(mapProduct)
}

function listPromotions() {
  return db.prepare('SELECT * FROM promotions ORDER BY created_at DESC').all().map(mapPromotion)
}

function listOrders(limit = 50) {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit)
  const itemQuery = db.prepare(`
    SELECT order_id, product_id, name, price, quantity
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `)

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    mode: row.mode,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    items: itemQuery.all(row.id).map((item) => ({
      id: item.product_id,
      productId: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
  }))
}

function dashboardSummary() {
  return {
    totalProducts: countTable('products'),
    lowStock: db.prepare('SELECT COUNT(*) AS total FROM products WHERE stock > 0 AND stock <= 5').get().total,
    outOfStock: db.prepare('SELECT COUNT(*) AS total FROM products WHERE stock = 0').get().total,
    totalPromotions: countTable('promotions'),
    totalOrders: countTable('orders'),
  }
}

const insertProductStatement = db.prepare(`
  INSERT INTO products (
    id, name, description, category, category_label, price, stock, promo, combo, image, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const updateProductStatement = db.prepare(`
  UPDATE products
  SET name = ?, description = ?, category = ?, category_label = ?, price = ?, stock = ?, promo = ?, combo = ?, image = ?, updated_at = ?
  WHERE id = ?
`)

const deleteProductStatement = db.prepare('DELETE FROM products WHERE id = ?')

const insertPromotionStatement = db.prepare(`
  INSERT INTO promotions (id, tag, title, description, highlight, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const updatePromotionStatement = db.prepare(`
  UPDATE promotions
  SET tag = ?, title = ?, description = ?, highlight = ?, updated_at = ?
  WHERE id = ?
`)

const deletePromotionStatement = db.prepare('DELETE FROM promotions WHERE id = ?')

const insertOrderStatement = db.prepare(`
  INSERT INTO orders (
    id, created_at, mode, customer_name, phone, address, subtotal, delivery_fee, total, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertOrderItemStatement = db.prepare(`
  INSERT INTO order_items (order_id, product_id, name, price, quantity)
  VALUES (?, ?, ?, ?, ?)
`)

const updateStockStatement = db.prepare(`
  UPDATE products
  SET stock = CASE WHEN stock - ? < 0 THEN 0 ELSE stock - ? END, updated_at = ?
  WHERE id = ?
`)

const createOrderTransaction = db.transaction((body) => {
  const orderId = `pedido-${nowTimestampMs()}`
  const timestamp = nowIso()

  insertOrderStatement.run(
    orderId,
    timestamp,
    body.mode,
    body.customerName,
    body.phone,
    body.address,
    Number(body.subtotal),
    Number(body.deliveryFee),
    Number(body.total),
    'confirmado',
  )

  for (const item of body.items || []) {
    insertOrderItemStatement.run(orderId, item.id, item.name, Number(item.price), Number(item.quantity))
    updateStockStatement.run(Number(item.quantity), Number(item.quantity), timestamp, item.id)
  }

  return orderId
})

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  try {
    if (url.pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      const body = await parseBody(request)
      const user = db
        .prepare('SELECT username, password_hash FROM admin_users WHERE username = ?')
        .get(body.username || '')

      if (!user || user.password_hash !== hashPassword(body.password || '')) {
        sendJson(response, 401, { error: 'Usuario ou senha invalidos.' })
        return
      }

      sendJson(response, 200, {
        token: signToken(user.username),
        user: {
          username: user.username,
        },
      })
      return
    }

    if (url.pathname === '/api/products' && request.method === 'GET') {
      sendJson(response, 200, listProducts())
      return
    }

    if (url.pathname === '/api/products' && request.method === 'POST') {
      if (!requireAuth(request, response)) return
      const body = await parseBody(request)
      const timestamp = nowIso()

      insertProductStatement.run(
        body.id,
        body.name,
        body.description,
        body.category,
        body.categoryLabel,
        Number(body.price),
        Number(body.stock),
        body.promo ? 1 : 0,
        body.combo ? 1 : 0,
        body.image,
        timestamp,
        timestamp,
      )

      sendJson(response, 201, { ok: true })
      return
    }

    if (url.pathname.startsWith('/api/products/') && request.method === 'PUT') {
      if (!requireAuth(request, response)) return
      const productId = url.pathname.split('/').pop()
      const body = await parseBody(request)

      updateProductStatement.run(
        body.name,
        body.description,
        body.category,
        body.categoryLabel,
        Number(body.price),
        Number(body.stock),
        body.promo ? 1 : 0,
        body.combo ? 1 : 0,
        body.image,
        nowIso(),
        productId,
      )

      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname.startsWith('/api/products/') && request.method === 'DELETE') {
      if (!requireAuth(request, response)) return
      const productId = url.pathname.split('/').pop()
      deleteProductStatement.run(productId)
      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname === '/api/promotions' && request.method === 'GET') {
      sendJson(response, 200, listPromotions())
      return
    }

    if (url.pathname === '/api/promotions' && request.method === 'POST') {
      if (!requireAuth(request, response)) return
      const body = await parseBody(request)
      const timestamp = nowIso()

      insertPromotionStatement.run(
        body.id,
        body.tag,
        body.title,
        body.description,
        body.highlight,
        timestamp,
        timestamp,
      )

      sendJson(response, 201, { ok: true })
      return
    }

    if (url.pathname.startsWith('/api/promotions/') && request.method === 'PUT') {
      if (!requireAuth(request, response)) return
      const promotionId = url.pathname.split('/').pop()
      const body = await parseBody(request)

      updatePromotionStatement.run(
        body.tag,
        body.title,
        body.description,
        body.highlight,
        nowIso(),
        promotionId,
      )

      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname.startsWith('/api/promotions/') && request.method === 'DELETE') {
      if (!requireAuth(request, response)) return
      const promotionId = url.pathname.split('/').pop()
      deletePromotionStatement.run(promotionId)
      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname === '/api/orders' && request.method === 'GET') {
      if (!requireAuth(request, response)) return
      sendJson(response, 200, listOrders())
      return
    }

    if (url.pathname === '/api/orders' && request.method === 'POST') {
      const body = await parseBody(request)
      const orderId = createOrderTransaction(body)
      sendJson(response, 201, { ok: true, id: orderId })
      return
    }

    if (url.pathname === '/api/dashboard' && request.method === 'GET') {
      if (!requireAuth(request, response)) return
      sendJson(response, 200, dashboardSummary())
      return
    }

    if (url.pathname === '/api/meta' && request.method === 'GET') {
      sendJson(response, 200, {
        categories,
        adminUser: defaultAdminUser,
      })
      return
    }

    // ── Pets ──────────────────────────────────────────────────────────────

    // GET /api/pets/lookup?tel=  — público, para o booking flow
    if (url.pathname === '/api/pets/lookup' && request.method === 'GET') {
      const tel = (url.searchParams.get('tel') || '').replace(/\D/g, '')
      if (!tel || tel.length < 8) {
        sendJson(response, 400, { error: 'Telefone inválido.' })
        return
      }
      const rows = db
        .prepare(`SELECT * FROM pets WHERE replace(replace(replace(replace(responsavel_tel,' ',''),'-',''),'(',''),')','') LIKE ? AND ativo = 1 ORDER BY nome`)
        .all(`%${tel}%`)
      sendJson(response, 200, rows)
      return
    }

    // GET /api/pets  — admin
    if (url.pathname === '/api/pets' && request.method === 'GET') {
      if (!requireAuth(request, response)) return
      const busca  = url.searchParams.get('busca') || ''
      const tipo   = url.searchParams.get('tipo') || ''
      const ativo  = url.searchParams.get('ativo') || '1'

      let query = 'SELECT * FROM pets WHERE 1=1'
      const params = []
      if (ativo !== '') { query += ' AND ativo = ?'; params.push(Number(ativo)) }
      if (tipo)  { query += ' AND tipo = ?'; params.push(tipo) }
      if (busca) {
        query += ' AND (nome LIKE ? OR responsavel_nome LIKE ? OR responsavel_tel LIKE ?)'
        const like = `%${busca}%`
        params.push(like, like, like)
      }
      query += ' ORDER BY nome ASC'

      const rows = db.prepare(query).all(...params)
      sendJson(response, 200, rows)
      return
    }

    // GET /api/pets/:id  — admin, retorna pet + histórico
    const petIdMatch = url.pathname.match(/^\/api\/pets\/([^/]+)$/)
    if (petIdMatch && request.method === 'GET') {
      if (!requireAuth(request, response)) return
      const id = decodeURIComponent(petIdMatch[1])
      const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(id)
      if (!pet) { sendJson(response, 404, { error: 'Pet não encontrado.' }); return }

      // Busca histórico: por pet_id se vinculado, ou por nome+telefone como fallback
      const history = db.prepare(`
        SELECT * FROM appointments
        WHERE (pet_id = ? OR (pet_nome = ? AND cliente_telefone = ?))
        ORDER BY data DESC, hora_inicio DESC
        LIMIT 50
      `).all(id, pet.nome, pet.responsavel_tel)

      sendJson(response, 200, { ...pet, historico: history })
      return
    }

    // POST /api/pets  — admin
    if (url.pathname === '/api/pets' && request.method === 'POST') {
      if (!requireAuth(request, response)) return
      const body = await parseBody(request)
      if (!body.nome || !body.tipo || !body.responsavel_nome || !body.responsavel_tel) {
        sendJson(response, 400, { error: 'Campos obrigatórios: nome, tipo, responsavel_nome, responsavel_tel.' })
        return
      }
      const id  = `pet-${nowTimestampMs()}-${randomBytes(4).toString('hex')}`
      const now = nowIso()
      db.prepare(`
        INSERT INTO pets
          (id, nome, tipo, raca, porte, sexo, data_nascimento, cor,
           responsavel_nome, responsavel_tel, responsavel_email,
           observacoes, ativo, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
      `).run(
        id,
        body.nome,
        body.tipo,
        body.raca              || '',
        body.porte             || '',
        body.sexo              || '',
        body.data_nascimento   || '',
        body.cor               || '',
        body.responsavel_nome,
        body.responsavel_tel,
        body.responsavel_email || '',
        body.observacoes       || '',
        now, now,
      )
      sendJson(response, 201, db.prepare('SELECT * FROM pets WHERE id = ?').get(id))
      return
    }

    // PUT /api/pets/:id  — admin
    if (petIdMatch && request.method === 'PUT') {
      if (!requireAuth(request, response)) return
      const id   = decodeURIComponent(petIdMatch[1])
      const body = await parseBody(request)
      const now  = nowIso()
      const result = db.prepare(`
        UPDATE pets SET
          nome = ?, tipo = ?, raca = ?, porte = ?, sexo = ?,
          data_nascimento = ?, cor = ?,
          responsavel_nome = ?, responsavel_tel = ?, responsavel_email = ?,
          observacoes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        body.nome              ?? '',
        body.tipo              ?? '',
        body.raca              ?? '',
        body.porte             ?? '',
        body.sexo              ?? '',
        body.data_nascimento   ?? '',
        body.cor               ?? '',
        body.responsavel_nome  ?? '',
        body.responsavel_tel   ?? '',
        body.responsavel_email ?? '',
        body.observacoes       ?? '',
        now,
        id,
      )
      if (result.changes === 0) { sendJson(response, 404, { error: 'Pet não encontrado.' }); return }
      sendJson(response, 200, db.prepare('SELECT * FROM pets WHERE id = ?').get(id))
      return
    }

    // DELETE /api/pets/:id  — soft-delete
    if (petIdMatch && request.method === 'DELETE') {
      if (!requireAuth(request, response)) return
      const id = decodeURIComponent(petIdMatch[1])
      const result = db.prepare('UPDATE pets SET ativo = 0, updated_at = ? WHERE id = ?').run(nowIso(), id)
      if (result.changes === 0) { sendJson(response, 404, { error: 'Pet não encontrado.' }); return }
      response.writeHead(204); response.end()
      return
    }

    // ── End pets ───────────────────────────────────────────────────────────

    // ── Appointments ──────────────────────────────────────────────────────

    if (url.pathname === '/api/appointments' && request.method === 'GET') {
      if (!requireAuth(request, response)) return
      const filterData = url.searchParams.get('data') || ''
      const filterTipo = url.searchParams.get('servico_tipo') || ''
      const filterStatus = url.searchParams.get('status') || ''

      let query = 'SELECT * FROM appointments WHERE 1=1'
      const params = []
      if (filterData) { query += ' AND data = ?'; params.push(filterData) }
      if (filterTipo) { query += ' AND servico_tipo = ?'; params.push(filterTipo) }
      if (filterStatus) { query += ' AND status = ?'; params.push(filterStatus) }
      query += ' ORDER BY data ASC, hora_inicio ASC'

      const rows = db.prepare(query).all(...params)
      sendJson(response, 200, rows)
      return
    }

    if (url.pathname === '/api/appointments' && request.method === 'POST') {
      const body = await parseBody(request)
      if (!body) return

      const required = ['cliente_nome', 'cliente_telefone', 'pet_nome', 'pet_tipo', 'pet_porte',
                        'servico_tipo', 'profissional', 'data', 'hora_inicio']
      for (const field of required) {
        if (!body[field]) {
          sendJson(response, 400, { error: `Campo obrigatório ausente: ${field}` })
          return
        }
      }

      const duration = SERVICE_DURATION[body.servico_tipo] ?? 60
      const hora_fim = addMinutes(body.hora_inicio, duration)

      if (!hasCapacity(body.data, body.hora_inicio, hora_fim, body.servico_tipo, body.profissional)) {
        sendJson(response, 409, { error: 'Horário sem capacidade disponível para este serviço.' })
        return
      }

      const id = `ag-${nowTimestampMs()}-${randomBytes(4).toString('hex')}`
      const now = nowIso()
      db.prepare(`
        INSERT INTO appointments
          (id, pet_id, cliente_nome, cliente_telefone, pet_nome, pet_tipo, pet_porte,
           servico_tipo, servico_nome, profissional, data, hora_inicio, hora_fim,
           status, observacoes, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        id,
        body.pet_id || null,
        body.cliente_nome,
        body.cliente_telefone,
        body.pet_nome,
        body.pet_tipo,
        body.pet_porte,
        body.servico_tipo,
        body.servico_nome || SERVICE_LABEL[body.servico_tipo] || body.servico_tipo,
        body.profissional,
        body.data,
        body.hora_inicio,
        hora_fim,
        'agendado',
        body.observacoes || '',
        now,
      )

      sendJson(response, 201, db.prepare('SELECT * FROM appointments WHERE id = ?').get(id))
      return
    }

    const appointmentStatusMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)\/status$/)
    if (appointmentStatusMatch && request.method === 'PATCH') {
      if (!requireAuth(request, response)) return
      const id = decodeURIComponent(appointmentStatusMatch[1])
      const body = await parseBody(request)
      if (!body) return

      const validStatuses = ['agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado']
      if (!validStatuses.includes(body.status)) {
        sendJson(response, 400, { error: 'Status inválido.' })
        return
      }

      const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(body.status, id)
      if (result.changes === 0) {
        sendJson(response, 404, { error: 'Agendamento não encontrado.' })
        return
      }
      sendJson(response, 200, db.prepare('SELECT * FROM appointments WHERE id = ?').get(id))
      return
    }

    const appointmentDeleteMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)$/)
    if (appointmentDeleteMatch && request.method === 'DELETE') {
      if (!requireAuth(request, response)) return
      const id = decodeURIComponent(appointmentDeleteMatch[1])
      const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(id)
      if (result.changes === 0) {
        sendJson(response, 404, { error: 'Agendamento não encontrado.' })
        return
      }
      response.writeHead(204)
      response.end()
      return
    }

    if (url.pathname === '/api/appointments/slots' && request.method === 'GET') {
      const data = url.searchParams.get('data') || ''
      const servicoTipo = url.searchParams.get('servico_tipo') || ''
      if (!data || !servicoTipo) {
        sendJson(response, 400, { error: 'Parâmetros data e servico_tipo são obrigatórios.' })
        return
      }

      const duration = SERVICE_DURATION[servicoTipo] ?? 60
      const professionals = serviceProfessionals(servicoTipo)
      // Slots: 08:00 to 18:00 in 30-minute increments
      const startHour = 8 * 60
      const endHour = 18 * 60
      const slots = []

      for (let min = startHour; min + duration <= endHour; min += 30) {
        const hora_inicio = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
        const hora_fim = addMinutes(hora_inicio, duration)

        for (const profissional of professionals) {
          const capacity = SERVICE_CAPACITY[servicoTipo] ?? 1
          const count = db
            .prepare(
              `SELECT COUNT(*) as cnt FROM appointments
               WHERE profissional = ? AND data = ? AND status != 'cancelado'
               AND hora_inicio < ? AND hora_fim > ?`,
            )
            .get(profissional, data, hora_fim, hora_inicio).cnt

          slots.push({
            hora_inicio,
            hora_fim,
            profissional,
            capacity,
            booked: count,
            available: count < capacity,
          })
        }
      }

      sendJson(response, 200, slots)
      return
    }

    // ── End appointments ──────────────────────────────────────────────────

    notFound(response)
  } catch (error) {
    sendJson(response, 500, {
      error: 'Erro interno no servidor.',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(serverPort, () => {
  console.log(`Farmavet API ativa em http://localhost:${serverPort}`)
  console.log(`Login admin inicial: ${defaultAdminUser} / ${defaultAdminPassword}`)
  console.log(`Banco SQLite em ${sqlitePath}`)
})
