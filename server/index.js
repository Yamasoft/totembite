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
const sqliteDir = process.env.TOTEM_BITE_DB_DIR || 'C:/Users/Roberto/.codex/memories/totem-bite'
const sqlitePath = join(sqliteDir, 'totem-bite.db')
const serverPort = 3001
const authSecret = process.env.ADMIN_AUTH_SECRET || 'totem-bite-local-secret'
const defaultAdminUser = process.env.ADMIN_USER || 'admin'
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123'

mkdirSync(workspaceDataDir, { recursive: true })
mkdirSync(sqliteDir, { recursive: true })

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
]

function nowIso() {
  return new Date().toISOString()
}

function hashPassword(password) {
  return createHmac('sha256', authSecret).update(password).digest('hex')
}

function signToken(username) {
  const payload = `${username}.${Date.now()}.${randomBytes(12).toString('hex')}`
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
  const orderId = `pedido-${Date.now()}`
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

    notFound(response)
  } catch (error) {
    sendJson(response, 500, {
      error: 'Erro interno no servidor.',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(serverPort, () => {
  console.log(`Pedido Direto API ativa em http://localhost:${serverPort}`)
  console.log(`Login admin inicial: ${defaultAdminUser} / ${defaultAdminPassword}`)
  console.log(`Banco SQLite em ${sqlitePath}`)
})
