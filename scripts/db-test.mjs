#!/usr/bin/env node
// Writes supabase/.env.test from `supabase status -o env` so supabase/test.mjs
// can connect to the local stack without hardcoding keys. Run after the stack
// is up (`supabase start`) and migrated (`supabase db reset`).
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let out
try {
  out = execSync('supabase status -o env', { cwd: root, encoding: 'utf8' })
} catch {
  out = execSync('npx --yes supabase status -o env', { cwd: root, encoding: 'utf8' })
}

const env = {}
for (const line of out.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)
  if (m) env[m[1]] = m[2]
}

const url = env.API_URL
const anon = env.ANON_KEY
const service = env.SERVICE_ROLE_KEY
if (!url || !anon || !service) {
  console.error('Could not parse supabase status. Is the stack running? Got keys:', Object.keys(env).join(', '))
  process.exit(1)
}

const body =
  `SUPABASE_URL="${url}"\n` +
  `SUPABASE_ANON_KEY="${anon}"\n` +
  `SUPABASE_SERVICE_ROLE_KEY="${service}"\n` +
  // NEXT_PUBLIC_* names so the app's anon client (lib/supabase.ts) picks them up.
  `NEXT_PUBLIC_SUPABASE_URL="${url}"\n` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY="${anon}"\n`
writeFileSync(join(root, 'supabase', '.env.test'), body)
console.log('Wrote supabase/.env.test →', url)
