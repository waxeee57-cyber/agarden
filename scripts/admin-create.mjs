// scripts/admin-create.mjs — create (or reset) an owner account.
//
//   pnpm admin:create <email>
//
// Generates a strong random password, stores ONLY its scrypt hash in
// admin_users, and writes the plaintext to ./.admin-credentials (mode 0600,
// gitignored). The password is never printed, logged or committed.
// Target DB: ADMIN_DATABASE_URL, else DATABASE_URL_UNPOOLED (.env.local).

import { existsSync, writeFileSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env.local'))) process.loadEnvFile(join(root, '.env.local'))

const TENANT = '11111111-1111-1111-1111-111111111111'
const N = 1 << 15, R = 8, P = 1, KEYLEN = 64

// Same format as lib/admin/auth.ts hashPassword(): scrypt$N$r$p$salt$key
export function hashPassword(password) {
  const salt = randomBytes(16)
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 }, (err, key) =>
      err ? reject(err) : resolve(['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$'))
    )
  )
}

export async function upsertAdmin(url, email, password) {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const hash = await hashPassword(password)
    await client.query(
      `insert into admin_users (email, password_hash, tenant_id, role) values ($1, $2, $3, 'owner')
       on conflict (email) do update set password_hash = excluded.password_hash`,
      [email, hash, TENANT]
    )
  } finally {
    await client.end()
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const email = (process.argv[2] ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('usage: pnpm admin:create <email>')
    process.exit(1)
  }
  const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
  if (!url) {
    console.error('admin:create: DATABASE_URL_UNPOOLED missing (.env.local)')
    process.exit(1)
  }
  const password = randomBytes(18).toString('base64url') // 24 chars, ~144 bits
  await upsertAdmin(url, email, password)
  const file = join(root, '.admin-credentials')
  const prev = process.umask(0o077)
  writeFileSync(
    file,
    `# Garden / Napsugár admin — KEEP PRIVATE. Delete this file after storing the password in a password manager.\n` +
      `# Login: https://garden-vendeghaz-velence.vercel.app/admin  and  https://napsugar-vendeghaz-velence.vercel.app/admin\n` +
      `created=${new Date().toISOString()}\nemail=${email}\npassword=${password}\n`,
    { mode: 0o600 }
  )
  process.umask(prev)
  try { chmodSync(file, 0o600) } catch { /* Windows: ACLs, best effort */ }
  console.log(`admin:create: owner ${email} saved; credentials written to .admin-credentials (not printed).`)
}
