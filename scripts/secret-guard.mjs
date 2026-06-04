// scripts/secret-guard.mjs
//
// Build-time secret-leak guard. Static analysis (no bundler needed) that fails
// the build when a privilege-escalating secret can reach the browser bundle.
//
// Three rules, derived from the project's security contract:
//
//   RULE 1 — Guarded secret modules
//     Any SHARED module (under lib/ or components/, i.e. importable from
//     anywhere) that references a high-value secret env var (service_role key,
//     Stripe secret/webhook secret, generic *_SECRET / *_TOKEN / password) MUST
//     start with `import 'server-only'`. Route handlers (app/api/**) and pages
//     are never client-bundled by Next unless marked 'use client', so they are
//     exempt from this rule (but still subject to RULE 2).
//
//   RULE 2 — No secret in the client bundle
//     Starting from every `'use client'` file, follow VALUE imports transitively
//     (type-only imports are erased and do NOT count). No file in that
//     client-reachable closure may:
//       (a) import 'server-only', or
//       (b) reference a non-NEXT_PUBLIC_ env var.
//     This is the hard guarantee: it mirrors what Next.js itself would do at
//     bundle time, but reports a precise import chain instead of a cryptic error.
//
//   RULE 3 — No anon + admin client mix
//     A single module must not value-import both the anon client (@/lib/supabase)
//     and the service-role admin client (@/lib/supabase-admin).
//
// Usage:
//   node scripts/secret-guard.mjs            # scan repo root, exit 1 on violation
//   import { analyzeProject } from './secret-guard.mjs'   # for tests
//
// No third-party deps — pure Node + regex parsing. Good enough because the
// project uses plain ESM import syntax everywhere.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCAN_DIRS = ['app', 'components', 'lib', 'instrumentation']
const EXT_ORDER = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs']
const IGNORE_SEGMENTS = new Set(['node_modules', '.next', '.git', '.agents', 'coverage'])

// High-value secrets that must never sit in an unguarded shared module (RULE 1).
const HIGH_SECRET_RE = /SERVICE_ROLE|STRIPE_SECRET|STRIPE_WEBHOOK_SECRET|_SECRET\b|_TOKEN\b|PASSWORD/

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (IGNORE_SEGMENTS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
}

function collectFiles(rootDir) {
  const files = []
  for (const d of SCAN_DIRS) {
    const full = join(rootDir, d)
    if (existsSync(full)) {
      const st = statSync(full)
      if (st.isDirectory()) walk(full, files)
      else files.push(full)
    }
  }
  // also top-level instrumentation files (instrumentation.ts / .client.ts)
  for (const name of ['instrumentation.ts', 'instrumentation-client.ts', 'instrumentation.client.ts']) {
    const full = join(rootDir, name)
    if (existsSync(full)) files.push(full)
  }
  return [...new Set(files)]
}

// ---------------------------------------------------------------------------
// Parsing (regex-based, tolerant)
// ---------------------------------------------------------------------------

const IMPORT_RE =
  /import\s+(type\s+)?([^'"]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|export\s+(type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g

function stripComments(src) {
  // remove block + line comments so commented-out code is not analysed
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function firstCodeLine(src) {
  for (const raw of src.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue
    return line
  }
  return ''
}

function parseFile(absPath) {
  const raw = readFileSync(absPath, 'utf8')
  const code = stripComments(raw)
  const hasUseClient = /^['"]use client['"]/.test(firstCodeLine(raw))
  const hasServerOnly = /import\s+['"]server-only['"]/.test(code)

  // env var references (dot + bracket access)
  const envVars = new Set()
  for (const m of code.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) envVars.add(m[1])
  for (const m of code.matchAll(/process\.env\[\s*['"]([A-Za-z0-9_]+)['"]\s*\]/g)) envVars.add(m[1])

  // imports: { spec, typeOnly }
  const imports = []
  for (const m of code.matchAll(IMPORT_RE)) {
    const sideEffectSpec = m[4]
    if (sideEffectSpec) {
      imports.push({ spec: sideEffectSpec, typeOnly: false })
      continue
    }
    const isTypeImport = !!(m[1] || m[5]) // `import type` or `export type`
    const clause = m[2] || ''
    const spec = m[3] || m[6]
    if (!spec) continue
    // `import { type Foo, bar }` — only a value edge if at least one specifier
    // is NOT prefixed with `type `. Whole-clause `import type` is never an edge.
    let valueEdge = !isTypeImport
    if (valueEdge && clause.includes('{')) {
      const names = clause
        .slice(clause.indexOf('{') + 1, clause.lastIndexOf('}'))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const hasValue = names.some((n) => !/^type\s/.test(n))
      // default/namespace part outside braces also counts as value
      const beforeBrace = clause.slice(0, clause.indexOf('{')).trim().replace(/,$/, '').trim()
      valueEdge = hasValue || beforeBrace.length > 0
    }
    imports.push({ spec, typeOnly: !valueEdge })
  }

  return { absPath, hasUseClient, hasServerOnly, envVars, imports }
}

// ---------------------------------------------------------------------------
// Module resolution (relative + @/ alias)
// ---------------------------------------------------------------------------

function resolveSpec(spec, fromFile, rootDir) {
  let base
  if (spec.startsWith('@/')) base = join(rootDir, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec)
  else return null // bare package import — external, ignore

  // exact file
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of EXT_ORDER) {
    if (existsSync(base + ext)) return base + ext
  }
  // index file in a directory
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXT_ORDER) {
      const idx = join(base, 'index' + ext)
      if (existsSync(idx)) return idx
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function isSharedModule(absPath, rootDir) {
  const rel = relative(rootDir, absPath).replace(/\\/g, '/')
  return rel.startsWith('lib/') || rel.startsWith('components/')
}

// Framework-provided, non-secret env vars that Next.js itself exposes/inlines.
// These are safe in client code and must not be treated as leaked secrets.
const PUBLIC_SAFE_ENV = new Set(['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE'])

function nonPublicSecretEnv(envVars) {
  return [...envVars].filter((v) => !v.startsWith('NEXT_PUBLIC_') && !PUBLIC_SAFE_ENV.has(v))
}

// A file is a client bundle root if it is 'use client' OR is the Next.js
// client instrumentation entry (instrumentation-client.*), which always ships
// to the browser even without a directive.
function isClientRoot(info, rootDir) {
  if (info.hasUseClient) return true
  const rel = relative(rootDir, info.absPath).replace(/\\/g, '/')
  return /^(src\/)?instrumentation-client\.(ts|tsx|js|jsx|mts|mjs)$/.test(rel)
}

export function analyzeProject(rootDir) {
  const files = collectFiles(rootDir)
  const byPath = new Map()
  for (const f of files) byPath.set(f, parseFile(f))

  const violations = []
  const rel = (p) => relative(rootDir, p).replace(/\\/g, '/')

  // ---- RULE 1: shared modules touching high-value secrets need server-only ----
  for (const info of byPath.values()) {
    if (!isSharedModule(info.absPath, rootDir)) continue
    const secrets = nonPublicSecretEnv(info.envVars).filter((v) => HIGH_SECRET_RE.test(v))
    if (secrets.length && !info.hasServerOnly) {
      violations.push({
        rule: 'RULE1',
        file: rel(info.absPath),
        message: `shared module references secret(s) ${secrets.join(', ')} but is missing \`import 'server-only'\``,
      })
    }
  }

  // ---- RULE 3: anon + admin client mix in one module ----
  for (const info of byPath.values()) {
    const specs = info.imports.filter((i) => !i.typeOnly).map((i) => i.spec)
    const hasAnon = specs.some((s) => /(^|\/)lib\/supabase$/.test(s) || s === '@/lib/supabase' || /\.\.?\/supabase$/.test(s))
    const hasAdmin = specs.some((s) => /lib\/supabase-admin$/.test(s) || /\.\.?\/supabase-admin$/.test(s))
    if (hasAnon && hasAdmin) {
      violations.push({
        rule: 'RULE3',
        file: rel(info.absPath),
        message: 'imports BOTH the anon client (lib/supabase) and the admin client (lib/supabase-admin) in one module',
      })
    }
  }

  // ---- RULE 2: client-reachable closure must contain no secret ----
  // BFS over value-import edges starting from every 'use client' file.
  const parent = new Map() // child absPath -> { from, spec }
  const reachable = new Set()
  const queue = []
  for (const info of byPath.values()) {
    if (isClientRoot(info, rootDir)) {
      reachable.add(info.absPath)
      queue.push(info.absPath)
    }
  }
  while (queue.length) {
    const cur = queue.shift()
    const info = byPath.get(cur)
    if (!info) continue
    for (const imp of info.imports) {
      if (imp.typeOnly) continue
      const target = resolveSpec(imp.spec, cur, rootDir)
      if (!target || !byPath.has(target)) continue
      if (!reachable.has(target)) {
        reachable.add(target)
        parent.set(target, { from: cur, spec: imp.spec })
        queue.push(target)
      }
    }
  }

  function chain(absPath) {
    const parts = [rel(absPath)]
    let p = parent.get(absPath)
    while (p) {
      parts.push(rel(p.from))
      p = parent.get(p.from)
    }
    return parts.reverse().join(' -> ')
  }

  for (const absPath of reachable) {
    const info = byPath.get(absPath)
    if (!info) continue
    // a 'use client' file legitimately reads NEXT_PUBLIC_ vars; only flag secrets
    const secrets = nonPublicSecretEnv(info.envVars)
    if (info.hasServerOnly) {
      violations.push({
        rule: 'RULE2',
        file: rel(absPath),
        message: `server-only module is reachable from a client component. Chain: ${chain(absPath)}`,
      })
    }
    if (secrets.length) {
      violations.push({
        rule: 'RULE2',
        file: rel(absPath),
        message: `client-reachable module references non-public env var(s) ${secrets.join(', ')}. Chain: ${chain(absPath)}`,
      })
    }
  }

  return { files: files.map(rel), violations }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const rootDir = process.argv[2] ? resolve(process.argv[2]) : process.cwd()
  const { files, violations } = analyzeProject(rootDir)
  if (violations.length === 0) {
    console.log(`secret-guard: OK — scanned ${files.length} files, no secret-leak violations.`)
    process.exit(0)
  }
  console.error(`secret-guard: FAILED — ${violations.length} violation(s):\n`)
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}\n         ${v.message}\n`)
  }
  console.error('Build blocked. A privilege-escalating secret can reach the client bundle.')
  process.exit(1)
}
