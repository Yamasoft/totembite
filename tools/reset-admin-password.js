import { createHmac } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const sqliteDir = process.env.TOTEM_BITE_DB_DIR || 'C:/Users/Roberto/.codex/memories/totem-bite'
const sqlitePath = join(sqliteDir, 'totem-bite.db')
const authSecret = process.env.ADMIN_AUTH_SECRET || 'totem-bite-local-secret'

const username = process.argv[2] || process.env.ADMIN_USER || 'admin'
const password = process.argv[3] || process.env.ADMIN_PASSWORD

if (!password) {
  console.error('Uso: npm run admin:reset -- <usuario> <nova-senha>')
  console.error('Exemplo: npm run admin:reset -- admin MinhaSenhaNova123!')
  process.exit(1)
}

function nowIso() {
  return new Date().toISOString()
}

function hashPassword(value) {
  return createHmac('sha256', authSecret).update(value).digest('hex')
}

mkdirSync(sqliteDir, { recursive: true })

const db = new Database(sqlitePath)
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username)

if (existing) {
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(
    hashPassword(password),
    username,
  )
  console.log(`Senha atualizada para o usuario "${username}".`)
} else {
  db.prepare(`
    INSERT INTO admin_users (id, username, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run(`admin-${Date.now()}`, username, hashPassword(password), nowIso())
  console.log(`Usuario "${username}" criado com a nova senha.`)
}

db.close()
