#!/usr/bin/env node
/**
 * Backup local do banco SQLite.
 * Uso: node tools/backup.js
 * Variáveis de ambiente:
 *   FARMAVET_DB_PATH  — caminho do banco (padrão: ./data/farmavet.db)
 *   BACKUP_DIR        — destino dos backups (padrão: ./data/backups)
 *   BACKUP_KEEP       — quantos backups reter (padrão: 7)
 */

import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const srcPath = process.env.FARMAVET_DB_PATH || join(rootDir, 'data', 'farmavet.db')
const backupDir = process.env.BACKUP_DIR || join(rootDir, 'data', 'backups')
const keepCount = parseInt(process.env.BACKUP_KEEP || '7', 10)

if (!existsSync(srcPath)) {
  console.error(`[backup] Banco não encontrado: ${srcPath}`)
  process.exit(1)
}

mkdirSync(backupDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const destPath = join(backupDir, `farmavet-${timestamp}.db`)

console.log(`[backup] ${srcPath} → ${destPath}`)
const db = new Database(srcPath, { readonly: true })
await db.backup(destPath)
db.close()
console.log(`[backup] OK — ${destPath}`)

// Reter apenas os N mais recentes
const files = readdirSync(backupDir)
  .filter(f => f.startsWith('farmavet-') && f.endsWith('.db'))
  .map(f => ({ name: f, mtime: statSync(join(backupDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

for (const f of files.slice(keepCount)) {
  unlinkSync(join(backupDir, f.name))
  console.log(`[backup] Removido (antigo): ${f.name}`)
}

console.log(`[backup] Backups retidos: ${Math.min(files.length, keepCount)}`)
