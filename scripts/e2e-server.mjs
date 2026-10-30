// scripts/e2e-server.mjs — `next dev -p 3100` on the throwaway agarden_test DB
// (reset + migrated first), for tests/admin-e2e.mjs. Production data is never
// touched; the connection string is passed via env, never printed.
//
//   node scripts/e2e-server.mjs            (Ctrl+C to stop)
//   writes .e2e-env (gitignored) with the test DB URL for the e2e runner

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { testDatabaseUrl, resetTestDatabase } from './test-db.mjs'

await resetTestDatabase({ quiet: true })
const env = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl(true),
  DATABASE_URL_UNPOOLED: testDatabaseUrl(),
  SITE_HOST_MAP: 'velence.localhost:3100=velence,napsugar.localhost:3100=napsugar',
  EMAIL_ENABLED: 'false',
}
// the e2e runner needs the direct test URL to create its throwaway admin (gitignored, 0600)
writeFileSync('.e2e-env', `ADMIN_DATABASE_URL=${testDatabaseUrl()}\n`, { mode: 0o600 })
console.log('e2e-server: agarden_test reset; starting next dev on :3100')
const child = spawn('pnpm', ['exec', 'next', 'dev', '-p', '3100'], { env, stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
