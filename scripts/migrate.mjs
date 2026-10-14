// scripts/migrate.mjs — apply db/migrations/*.sql in order, once each.
//
//   pnpm db:migrate                       # uses DATABASE_URL_UNPOOLED (direct, not pooled)
//   MIGRATE_DATABASE_URL=... pnpm db:migrate
//
// Each file runs in its own transaction and is recorded in applied_migrations,
// so a re-run is a no-op. The SQL itself is also written idempotently.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env.local'))) process.loadEnvFile(join(root, '.env.local'))

export async function migrate(url, { log = console.log } = {}) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(`create table if not exists applied_migrations (
      name text primary key, applied_at timestamptz not null default now())`)
    const done = new Set((await client.query('select name from applied_migrations')).rows.map((r) => r.name))
    const dir = join(root, 'db', 'migrations')
    const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort()
    for (const f of files) {
      if (done.has(f)) continue
      const sql = readFileSync(join(dir, f), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into applied_migrations (name) values ($1)', [f])
        await client.query('commit')
        log(`migrate: applied ${f}`)
      } catch (e) {
        await client.query('rollback')
        throw new Error(`migrate: ${f} failed: ${e.message}`)
      }
    }
    log(`migrate: up to date (${files.length} files)`)
  } finally {
    await client.end()
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!url) {
    console.error('migrate: set DATABASE_URL_UNPOOLED (or MIGRATE_DATABASE_URL)')
    process.exit(1)
  }
  migrate(url).catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
