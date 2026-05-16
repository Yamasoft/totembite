import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { categories, initialDailyPromotions, initialMenuItems } from '../src/data/menu.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const workspaceDataDir = join(rootDir, 'data')
const legacyJsonPath = join(workspaceDataDir, 'totem-bite-store.json')
const sqlitePath = process.env.FARMAVET_DB_PATH || join(rootDir, 'data', 'farmavet.db')
const serverPort = parseInt(process.env.PORT || '3002', 10)
const authSecret = process.env.ADMIN_AUTH_SECRET || 'farmavet-local-secret'
const customerAuthSecret = process.env.CUSTOMER_AUTH_SECRET || 'farmavet-customer-secret-dev'
const authMode = process.env.AUTH_MODE || 'test'
const defaultAdminUser = process.env.ADMIN_USER || 'admin'
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123'
const appTimeZone = 'America/Sao_Paulo'
const ADMIN_TOKEN_TTL_MS = parseInt(process.env.ADMIN_TOKEN_TTL_HOURS || '12', 10) * 60 * 60 * 1000
const BACKUP_SECRET = process.env.BACKUP_SECRET || ''

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
  {
    id: '005_product_ativo',
    sql: `
      ALTER TABLE products ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
    `,
  },
  {
    id: '006_product_tipo',
    sql: `
      ALTER TABLE products ADD COLUMN tipo TEXT NOT NULL DEFAULT 'produto';
      ALTER TABLE products ADD COLUMN duracao_min INTEGER;
      UPDATE products SET tipo = 'servico' WHERE category IN ('banho_tosa', 'clinica', 'comunidade');
    `,
  },
  {
    id: '004_auth',
    sql: `
      CREATE TABLE IF NOT EXISTS customers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        phone         TEXT    NOT NULL UNIQUE,
        name          TEXT,
        verified      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT    NOT NULL,
        updated_at    TEXT,
        last_login_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

      CREATE TABLE IF NOT EXISTS otp_codes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT    NOT NULL,
        code_hash  TEXT    NOT NULL,
        expires_at TEXT    NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        used_at    TEXT,
        created_at TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_otp_phone_expires ON otp_codes(phone, expires_at);

      CREATE TABLE IF NOT EXISTS customer_sessions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        token_hash   TEXT    NOT NULL UNIQUE,
        expires_at   TEXT    NOT NULL,
        created_at   TEXT    NOT NULL,
        last_used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON customer_sessions(token_hash);

      CREATE TABLE IF NOT EXISTS test_phones (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT NOT NULL UNIQUE,
        label      TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
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
  if (!token) return false
  const parts = token.split('.')
  if (parts.length < 4) return false
  const signature = parts.pop()
  const payload = parts.join('.')
  const expected = createHmac('sha256', authSecret).update(payload).digest('hex')
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false
  // parts = [username, issuedAtMs, randomHex] — check TTL
  const issuedAt = parseInt(parts[1], 10)
  if (isNaN(issuedAt) || Date.now() - issuedAt > ADMIN_TOKEN_TTL_MS) return false
  return true
}

// ── Login rate limiting ────────────────────────────────────────────────────

const loginFailureLog = new Map() // ip -> number[]  (timestamps of failures)
const LOGIN_MAX_FAILURES = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function getClientIp(request) {
  const fwd = request.headers['x-forwarded-for']
  return fwd ? fwd.split(',')[0].trim() : (request.socket?.remoteAddress || 'unknown')
}

function isLoginLocked(ip) {
  const now = Date.now()
  const recent = (loginFailureLog.get(ip) || []).filter(t => now - t < LOGIN_LOCKOUT_MS)
  loginFailureLog.set(ip, recent)
  return recent.length >= LOGIN_MAX_FAILURES
}

function recordLoginFailure(ip) {
  const now = Date.now()
  const recent = (loginFailureLog.get(ip) || []).filter(t => now - t < LOGIN_LOCKOUT_MS)
  recent.push(now)
  loginFailureLog.set(ip, recent)
}

function clearLoginFailures(ip) {
  loginFailureLog.delete(ip)
}

// ── OTP / Customer auth ────────────────────────────────────────────────────

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 3
const OTP_RATE_LIMIT_COUNT = 3
const OTP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hora
const SESSION_TTL_DAYS = 30

// Timestamp list per phone — keeps only entries within the rate-limit window.
const otpRequestLog = new Map()

function normalizePhoneNational(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  return d.slice(0, 11)
}

function normalizePhone(raw) {
  const phone = normalizePhoneNational(raw)
  return isNationalMobilePhone(phone) ? phone : null
}

function isNationalMobilePhone(phone) {
  return /^\d{11}$/.test(phone)
}

function normalizePersistedPhones() {
  const updates = [
    ['pets', 'id', 'responsavel_tel'],
    ['appointments', 'id', 'cliente_telefone'],
    ['orders', 'id', 'phone'],
    ['customers', 'id', 'phone'],
    ['test_phones', 'id', 'phone'],
    ['otp_codes', 'id', 'phone'],
  ]

  for (const [table, idColumn, phoneColumn] of updates) {
    const rows = db.prepare(`SELECT ${idColumn} AS id, ${phoneColumn} AS phone FROM ${table}`).all()
    const update = db.prepare(`UPDATE ${table} SET ${phoneColumn} = ? WHERE ${idColumn} = ?`)

    for (const row of rows) {
      const normalized = normalizePhoneNational(row.phone)
      if (normalized && normalized !== row.phone) {
        try {
          update.run(normalized, row.id)
        } catch (error) {
          console.warn(`[PHONE] Nao foi possivel normalizar ${table}.${phoneColumn} id=${row.id}: ${error.message}`)
        }
      }
    }
  }
}

function generateOtpCode() {
  // 6 dígitos com padding zero (000000–999999)
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

function hashOtp(code, phone) {
  return createHmac('sha256', customerAuthSecret).update(`${phone}:${code}`).digest('hex')
}

function signCustomerToken(customerId) {
  const payload = `cust.${customerId}.${nowTimestampMs()}.${randomBytes(12).toString('hex')}`
  const sig = createHmac('sha256', customerAuthSecret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function verifyCustomerToken(token) {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length < 5) return false
  const sig = parts.pop()
  const payload = parts.join('.')
  const expected = createHmac('sha256', customerAuthSecret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

function requireCustomerAuth(request, response) {
  const authHeader = request.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!verifyCustomerToken(token)) {
    unauthorized(response)
    return null
  }

  const tokenHash = createHmac('sha256', customerAuthSecret).update(token).digest('hex')
  const session = db
    .prepare(`SELECT * FROM customer_sessions WHERE token_hash = ? AND expires_at > ?`)
    .get(tokenHash, nowIso())

  if (!session) {
    unauthorized(response)
    return null
  }

  db.prepare(`UPDATE customer_sessions SET last_used_at = ? WHERE id = ?`).run(nowIso(), session.id)
  return session
}

function isRateLimited(phone) {
  const now = Date.now()
  const window = OTP_RATE_LIMIT_WINDOW_MS
  const entries = (otpRequestLog.get(phone) || []).filter((ts) => now - ts < window)
  if (entries.length >= OTP_RATE_LIMIT_COUNT) return true
  entries.push(now)
  otpRequestLog.set(phone, entries)
  return false
}

function addOtpIsoMinutes(minutes) {
  const ms = Date.now() + minutes * 60 * 1000
  const date = new Date(ms)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const off = formatOffset(timeZoneOffsetMinutes(date, appTimeZone))
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}${off}`
}

function sessionExpiresAt() {
  return addOtpIsoMinutes(SESSION_TTL_DAYS * 24 * 60)
}

// ── End OTP / Customer auth ────────────────────────────────────────────────

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
normalizePersistedPhones()
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
    ativo: row.ativo === undefined ? true : Boolean(row.ativo),
    tipo: row.tipo ?? 'produto',
    duracao_min: row.duracao_min ?? null,
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

function listProducts(forAdmin = false) {
  const sql = forAdmin
    ? 'SELECT * FROM products ORDER BY name ASC'
    : "SELECT * FROM products WHERE tipo = 'produto' AND ativo = 1 ORDER BY name ASC"
  return db.prepare(sql).all().map(mapProduct)
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
    id, name, description, category, category_label, price, stock, promo, combo, ativo, tipo, duracao_min, image, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const updateProductStatement = db.prepare(`
  UPDATE products
  SET name = ?, description = ?, category = ?, category_label = ?, price = ?, stock = ?, promo = ?, combo = ?, ativo = ?, tipo = ?, duracao_min = ?, image = ?, updated_at = ?
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
    normalizePhoneNational(body.phone),
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
      const ip = getClientIp(request)
      if (isLoginLocked(ip)) {
        sendJson(response, 429, { error: 'Muitas tentativas de login. Aguarde 15 minutos.' })
        return
      }
      const body = await parseBody(request)
      const user = db
        .prepare('SELECT username, password_hash FROM admin_users WHERE username = ?')
        .get(body.username || '')

      if (!user || user.password_hash !== hashPassword(body.password || '')) {
        recordLoginFailure(ip)
        sendJson(response, 401, { error: 'Usuario ou senha invalidos.' })
        return
      }

      clearLoginFailures(ip)
      sendJson(response, 200, {
        token: signToken(user.username),
        user: { username: user.username },
      })
      return
    }

    if (url.pathname === '/api/products' && request.method === 'GET') {
      const authHeader = request.headers.authorization || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      sendJson(response, 200, listProducts(verifyToken(token)))
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
        Number(body.stock ?? 0),
        body.promo ? 1 : 0,
        body.combo ? 1 : 0,
        body.ativo === false ? 0 : 1,
        body.tipo === 'servico' ? 'servico' : 'produto',
        body.duracao_min ? Number(body.duracao_min) : null,
        body.image,
        timestamp,
        timestamp,
      )

      sendJson(response, 201, { ok: true })
      return
    }

    if (url.pathname === '/api/products/upload-image' && request.method === 'POST') {
      if (!requireAuth(request, response)) return
      const body = await parseBody(request)
      const { data, name } = body

      if (!data || !name) {
        sendJson(response, 400, { error: 'data e name são obrigatórios' })
        return
      }

      const base64 = data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      const ext = name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const uploadDir = join(rootDir, 'public', 'images', 'produtos')
      mkdirSync(uploadDir, { recursive: true })
      writeFileSync(join(uploadDir, filename), buffer)

      sendJson(response, 200, { path: `/images/produtos/${filename}` })
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
        Number(body.stock ?? 0),
        body.promo ? 1 : 0,
        body.combo ? 1 : 0,
        body.ativo === false ? 0 : 1,
        body.tipo === 'servico' ? 'servico' : 'produto',
        body.duracao_min ? Number(body.duracao_min) : null,
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
      const rawTel = url.searchParams.get('tel') || ''
      const tel = normalizePhoneNational(rawTel)
      if (!tel || tel.length < 10) {
        sendJson(response, 400, { error: 'Telefone inválido.' })
        return
      }
      if (!isNationalMobilePhone(tel)) {
        sendJson(response, 400, { error: 'Telefone deve ter 11 dígitos nacionais.' })
        return
      }
      const rows = db
        .prepare(`
          SELECT * FROM pets
          WHERE ativo = 1
            AND responsavel_tel = ?
          ORDER BY nome
        `)
        .all(tel)
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
        const phoneLike = `%${normalizePhoneNational(busca) || busca}%`
        params.push(like, like, phoneLike)
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
      `).all(id, pet.nome, normalizePhoneNational(pet.responsavel_tel))

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
      const responsavelTel = normalizePhoneNational(body.responsavel_tel)
      if (!isNationalMobilePhone(responsavelTel)) {
        sendJson(response, 400, { error: 'Telefone deve ter 11 dígitos nacionais.' })
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
        responsavelTel,
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
      const responsavelTel = normalizePhoneNational(body.responsavel_tel ?? '')
      if (!isNationalMobilePhone(responsavelTel)) {
        sendJson(response, 400, { error: 'Telefone deve ter 11 dígitos nacionais.' })
        return
      }
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
        responsavelTel,
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

    // Endpoint público: cliente busca seus próprios agendamentos por telefone
    if (url.pathname === '/api/appointments/my' && request.method === 'GET') {
      const rawTel = url.searchParams.get('tel') || ''
      const tel = normalizePhoneNational(rawTel)

      if (!tel || tel.length < 10) {
        sendJson(response, 400, { error: 'Parâmetro tel inválido.' })
        return
      }

      // Retorna agendamentos dos últimos 30 dias + futuros, ordenados por data/hora
      // Data atual em Brasília, menos 30 dias
      const brDate = nowIso().slice(0, 10) // "YYYY-MM-DD" no fuso America/Sao_Paulo
      const cutoff = new Date(brDate + 'T12:00:00')
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffDate = cutoff.toISOString().slice(0, 10) // YYYY-MM-DD

      const rows = db.prepare(`
        SELECT id, servico_nome, servico_tipo, profissional,
               data, hora_inicio, hora_fim, status,
               pet_nome, pet_tipo, observacoes, created_at
        FROM appointments
        WHERE cliente_telefone = ?
          AND data >= ?
        ORDER BY data ASC, hora_inicio ASC
      `).all(tel, cutoffDate)

      sendJson(response, 200, rows)
      return
    }

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
      const clienteTelefone = normalizePhoneNational(body.cliente_telefone)

      if (!isNationalMobilePhone(clienteTelefone)) {
        sendJson(response, 400, { error: 'Telefone deve ter 11 dígitos nacionais.' })
        return
      }

      if (!hasCapacity(body.data, body.hora_inicio, hora_fim, body.servico_tipo, body.profissional)) {
        sendJson(response, 409, { error: 'Horário sem capacidade disponível para este serviço.' })
        return
      }

      const id = `ag-${nowTimestampMs()}-${randomBytes(4).toString('hex')}`
      const now = nowIso()
      let petId = body.pet_id || null

      if (!petId) {
        const existingPet = db.prepare(`
          SELECT id FROM pets
          WHERE ativo = 1
            AND responsavel_tel = ?
            AND lower(nome) = lower(?)
          ORDER BY created_at DESC
          LIMIT 1
        `).get(clienteTelefone, body.pet_nome)

        if (existingPet) {
          petId = existingPet.id
        } else {
          petId = `pet-${nowTimestampMs()}-${randomBytes(4).toString('hex')}`
          db.prepare(`
            INSERT INTO pets
              (id, nome, tipo, raca, porte, sexo, data_nascimento, cor,
               responsavel_nome, responsavel_tel, responsavel_email,
               observacoes, ativo, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
          `).run(
            petId,
            body.pet_nome,
            body.pet_tipo,
            '',
            body.pet_porte,
            '',
            '',
            '',
            body.cliente_nome,
            clienteTelefone,
            '',
            body.observacoes || '',
            now,
            now,
          )
        }
      }

      db.prepare(`
        INSERT INTO appointments
          (id, pet_id, cliente_nome, cliente_telefone, pet_nome, pet_tipo, pet_porte,
           servico_tipo, servico_nome, profissional, data, hora_inicio, hora_fim,
           status, observacoes, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        id,
        petId,
        body.cliente_nome,
        clienteTelefone,
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

    // ── Auth OTP ──────────────────────────────────────────────────────────

    if (url.pathname === '/api/auth/otp/send' && request.method === 'POST') {
      const body = await parseBody(request)
      const phone = normalizePhone(body.phone)

      // Resposta genérica independente do resultado — não revela se número existe
      const genericOk = () => sendJson(response, 200, { sent: true })

      if (!phone) {
        genericOk()
        return
      }

      if (isRateLimited(phone)) {
        genericOk()
        return
      }

      if (authMode === 'test') {
        const allowed = db.prepare('SELECT id FROM test_phones WHERE phone = ?').get(phone)
        if (!allowed) {
          genericOk()
          return
        }
      }

      const code = generateOtpCode()
      const codeHash = hashOtp(code, phone)
      const expiresAt = addOtpIsoMinutes(OTP_TTL_MINUTES)
      const timestamp = nowIso()

      // Invalida OTPs anteriores não utilizados do mesmo número
      db.prepare(`UPDATE otp_codes SET used_at = ? WHERE phone = ? AND used_at IS NULL`).run(timestamp, phone)

      db.prepare(`
        INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, created_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(phone, codeHash, expiresAt, timestamp)

      if (authMode === 'test') {
        console.log(`\n[AUTH TEST] OTP para ${phone}: ${code}  (válido até ${expiresAt})\n`)
      }

      genericOk()
      return
    }

    if (url.pathname === '/api/auth/otp/verify' && request.method === 'POST') {
      const body = await parseBody(request)
      const phone = normalizePhone(body.phone)
      const code = String(body.code || '').trim()

      if (!phone || !code) {
        sendJson(response, 400, { error: 'Telefone e código são obrigatórios.' })
        return
      }

      const otpRow = db.prepare(`
        SELECT * FROM otp_codes
        WHERE phone = ?
          AND used_at IS NULL
          AND expires_at > ?
          AND attempts < ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(phone, nowIso(), OTP_MAX_ATTEMPTS)

      // Incrementa tentativas antes de validar — evita timing oracle
      if (otpRow) {
        db.prepare(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`).run(otpRow.id)
      }

      const expectedHash = hashOtp(code, phone)
      const valid = otpRow && otpRow.code_hash === expectedHash

      if (!valid) {
        sendJson(response, 401, { error: 'Código inválido ou expirado.' })
        return
      }

      // Marca OTP como utilizado
      db.prepare(`UPDATE otp_codes SET used_at = ? WHERE id = ?`).run(nowIso(), otpRow.id)

      // Upsert cliente
      const now = nowIso()
      let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone)

      if (!customer) {
        db.prepare(`
          INSERT INTO customers (phone, verified, created_at, updated_at)
          VALUES (?, 1, ?, ?)
        `).run(phone, now, now)
        customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone)
      } else {
        db.prepare(`UPDATE customers SET verified = 1, last_login_at = ?, updated_at = ? WHERE id = ?`)
          .run(now, now, customer.id)
        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer.id)
      }

      // Cria sessão
      const token = signCustomerToken(customer.id)
      const tokenHash = createHmac('sha256', customerAuthSecret).update(token).digest('hex')
      db.prepare(`
        INSERT INTO customer_sessions (customer_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(customer.id, tokenHash, sessionExpiresAt(), now)

      sendJson(response, 200, {
        token,
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.name,
          verified: Boolean(customer.verified),
        },
      })
      return
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const session = requireCustomerAuth(request, response)
      if (!session) return

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(session.customer_id)
      if (!customer) {
        sendJson(response, 404, { error: 'Cliente não encontrado.' })
        return
      }

      sendJson(response, 200, {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        verified: Boolean(customer.verified),
        createdAt: customer.created_at,
        lastLoginAt: customer.last_login_at,
      })
      return
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const authHeader = request.headers.authorization || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

      if (token) {
        const tokenHash = createHmac('sha256', customerAuthSecret).update(token).digest('hex')
        db.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(tokenHash)
      }

      sendJson(response, 200, { ok: true })
      return
    }

    // ── End Auth OTP ──────────────────────────────────────────────────────

    // ── Admin: whitelist test_phones ──────────────────────────────────────

    if (url.pathname === '/api/admin/test-phones' && request.method === 'GET') {
      if (!requireAuth(request, response)) return
      const rows = db.prepare('SELECT * FROM test_phones ORDER BY created_at DESC').all()
      sendJson(response, 200, rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        label: r.label,
        createdAt: r.created_at,
      })))
      return
    }

    if (url.pathname === '/api/admin/test-phones' && request.method === 'POST') {
      if (!requireAuth(request, response)) return
      const body = await parseBody(request)
      const phone = normalizePhone(body.phone)

      if (!phone) {
        sendJson(response, 400, { error: 'Telefone inválido.' })
        return
      }

      const label = String(body.label || '').trim()
      const existing = db.prepare('SELECT id FROM test_phones WHERE phone = ?').get(phone)

      if (existing) {
        sendJson(response, 409, { error: 'Telefone já está na whitelist.' })
        return
      }

      const result = db.prepare(`
        INSERT INTO test_phones (phone, label, created_at) VALUES (?, ?, ?)
      `).run(phone, label, nowIso())

      sendJson(response, 201, { id: result.lastInsertRowid, phone, label })
      return
    }

    const testPhoneDeleteMatch = url.pathname.match(/^\/api\/admin\/test-phones\/(\d+)$/)
    if (testPhoneDeleteMatch && request.method === 'DELETE') {
      if (!requireAuth(request, response)) return
      const id = Number(testPhoneDeleteMatch[1])
      const result = db.prepare('DELETE FROM test_phones WHERE id = ?').run(id)

      if (result.changes === 0) {
        sendJson(response, 404, { error: 'Telefone não encontrado.' })
        return
      }

      response.writeHead(204)
      response.end()
      return
    }

    // ── End Admin: whitelist test_phones ──────────────────────────────────

    // ── Admin: backup download ─────────────────────────────────────────────
    if (url.pathname === '/api/admin/backup/download' && request.method === 'GET') {
      // Accepts either admin token or dedicated BACKUP_SECRET header
      const providedSecret = request.headers['x-backup-secret'] || ''
      const hasValidBackupSecret = BACKUP_SECRET && providedSecret === BACKUP_SECRET
      if (!hasValidBackupSecret && !requireAuth(request, response)) return

      const tmpPath = `${sqlitePath}.download.tmp`
      try {
        await db.backup(tmpPath)
        const data = readFileSync(tmpPath)
        unlinkSync(tmpPath)
        const dateStr = new Date().toISOString().slice(0, 10)
        response.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="farmavet-backup-${dateStr}.db"`,
          'Content-Length': data.length,
          'Access-Control-Allow-Origin': '*',
        })
        response.end(data)
      } catch (err) {
        sendJson(response, 500, { error: 'Falha ao gerar backup.', detail: err.message })
      }
      return
    }
    // ── End Admin: backup download ─────────────────────────────────────────

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
