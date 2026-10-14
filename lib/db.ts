import 'server-only'
import { Pool, type PoolClient, type QueryResultRow } from 'pg'

// The ONLY database entry point. Server Components, route handlers and
// server-side libs import this; client components never can (server-only +
// scripts/secret-guard.mjs). Every query is parameterized ($1, $2 …) — never
// build SQL by string concatenation.
//
// DATABASE_URL is Neon's pooled (PgBouncer) endpoint, so a small per-instance
// pool is enough on serverless.

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // pg warns that sslmode=require will change meaning; pin today's behaviour.
  return url.replace('sslmode=require', 'sslmode=verify-full')
}

const globalForPg = globalThis as unknown as { __agardenPool?: Pool }

function pool(): Pool {
  if (!globalForPg.__agardenPool) {
    globalForPg.__agardenPool = new Pool({
      connectionString: connectionString(),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return globalForPg.__agardenPool
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query<T>(sql, params)
  return res.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

/** Run fn inside a single transaction on one connection. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('begin')
    const out = await fn(client)
    await client.query('commit')
    return out
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
