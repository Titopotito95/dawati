import "server-only";
import path from "node:path";
import fs from "node:fs";
import { MIGRATIONS } from "./migrations";

/**
 * Database access layer.
 *  - Production: any PostgreSQL (e.g. Supabase) via DATABASE_URL using node-postgres.
 *  - Local/demo: embedded PostgreSQL (PGlite, WASM) persisted in .data/pglite — zero setup.
 *  - Tests: in-memory PGlite (DAWATI_TEST=1).
 * The server connects with a privileged role; authorization is enforced in server code by
 * always scoping queries to the session's subject (workspace / affiliate). RLS is enabled on
 * every table with no policies so Supabase's public anon/authenticated API roles get nothing.
 */
export type Row = Record<string, unknown>;
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  kind: "pg" | "pglite";
}

type G = typeof globalThis & { __dawatiDb?: Promise<Db> };
const g = globalThis as G;

async function createPg(rawUrl: string): Promise<Db> {
  const pg = await import("pg");
  pg.default.types.setTypeParser(20, (v: string) => Number(v)); // int8 → number (amounts are minor units)
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(rawUrl);
  // Managed Postgres (Neon / Supabase via Vercel) adds sslmode=… to the URL; TLS is configured explicitly instead.
  const u = new URL(rawUrl);
  u.searchParams.delete("sslmode");
  const pool = new pg.default.Pool({
    connectionString: u.toString(),
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const r = await c.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
  });
  const db: Db = {
    kind: "pg",
    ...wrap(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
  await migratePg(pool);
  return db;
}

/**
 * Migrations on a shared server: one transaction holding a transaction-scoped advisory lock, so
 * several serverless instances starting at once can never apply the same migration twice.
 * Works through transaction-mode poolers (pgbouncer / Neon / Supabase pooler).
 */
async function migratePg(pool: { connect: () => Promise<{ query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }>; release: () => void }> }) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("select pg_advisory_xact_lock(72027202)");
    await c.query(`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`);
    const done = new Set(((await c.query("select id from schema_migrations")).rows as { id: string }[]).map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await c.query(m.sql);
      await c.query("insert into schema_migrations(id) values ($1)", [m.id]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  let dataDir: string | undefined;
  if (process.env.DAWATI_TEST !== "1") {
    dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  }
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const r = await c.query(sql, params ?? []);
      return { rows: r.rows as T[], rowCount: r.affectedRows || r.rows.length };
    },
  });
  const db: Db = {
    kind: "pglite",
    ...wrap(pg),
    async tx(fn) {
      return pg.transaction(async (t) => fn(wrap(t)));
    },
  };
  await migrate(db, async (sql) => {
    await pg.exec(sql);
  });
  return db;
}

async function migrate(db: Db, exec: (sql: string) => Promise<void>) {
  await exec(`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query<{ id: string }>("select id from schema_migrations")).rows.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await exec(`begin;\n${m.sql}\ninsert into schema_migrations(id) values ('${m.id}');\ncommit;`);
  }
}

export function getDb(): Promise<Db> {
  if (!g.__dawatiDb) {
    // DATABASE_URL, or POSTGRES_URL as set automatically by Vercel's Neon / Supabase integrations
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url && process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "1") {
      throw new Error("DATABASE_URL is required in production (set ALLOW_EMBEDDED_DB=1 to use the embedded database).");
    }
    g.__dawatiDb = (url ? createPg(url) : createPglite()).catch((e) => {
      g.__dawatiDb = undefined;
      throw e;
    });
  }
  return g.__dawatiDb;
}

/** Test helper: drop the singleton so each test file gets a fresh in-memory database. */
export function __resetDbForTests() {
  g.__dawatiDb = undefined;
}

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "") return Number(v);
  return 0;
}
