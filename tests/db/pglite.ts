import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { DpwhSyncStore, SyncRun } from '@/lib/integrations/dpwh/nationwide/sync';
import { SyncBusyError } from '@/lib/integrations/dpwh/nationwide/sync';

/**
 * Local Postgres (PGlite, WASM) with a minimal stand-in for what Supabase
 * provides: the anon/authenticated/service_role roles, Supabase's default
 * privileges (so the migrations' revokes are exercised), and auth.users /
 * auth.uid() / auth.jwt(). Never touches the hosted database.
 */

export const USERS = {
  admin: '77777777-7777-7777-7777-777777777777',
  planner: '66666666-6666-6666-6666-666666666666',
  engineer: '44444444-4444-4444-4444-444444444444',
  citizen: '11111111-1111-1111-1111-111111111111',
};

/** In memory by default; pass a directory for large (on-disk) runs. */
export async function createTestDb(dataDir?: string): Promise<PGlite> {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
                             raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
  `);
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(dir, file), 'utf8'));
  }
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USERS.admin}', 'admin@test.local'), ('${USERS.planner}', 'planner@test.local'),
      ('${USERS.engineer}', 'engineer@test.local'), ('${USERS.citizen}', 'citizen@test.local');
    update public.profiles set role = 'lgu_admin' where id = '${USERS.admin}';
    update public.profiles set role = 'planning_officer' where id = '${USERS.planner}';
    update public.profiles set role = 'project_engineer' where id = '${USERS.engineer}';
  `);
  return db;
}

/** Reopens an on-disk test database created by createTestDb. */
export async function openTestDb(dataDir: string): Promise<PGlite> {
  return new PGlite(dataDir);
}

export type Role = 'anon' | 'authenticated' | 'service_role';

/** Runs one statement the way PostgREST would for this role and user. */
export async function as<T = Record<string, unknown>>(
  db: PGlite, role: Role, sub: string | null, sql: string, params: unknown[] = []
): Promise<{ rows: T[]; error?: undefined } | { rows?: undefined; error: Error & { code?: string } }> {
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(sub ? { sub, role } : { role })]);
    await db.exec(`set local role ${role}`);
    const res = await db.query<T>(sql, params);
    await db.exec('commit');
    return { rows: res.rows };
  } catch (error) {
    await db.exec('rollback');
    return { error: error as Error & { code?: string } };
  }
}

/** DpwhSyncStore over the real dpwh_sync_* functions, acting as `role`. */
export function pgliteStore(db: PGlite, role: Role, sub: string | null): DpwhSyncStore {
  const call = async <T>(sql: string, params: unknown[]): Promise<T> => {
    const res = await as<{ r: T }>(db, role, sub, sql, params);
    if (res.error) {
      if (res.error.code === '55P03') throw new SyncBusyError(res.error.message);
      throw res.error;
    }
    return res.rows[0].r;
  };
  const runCols = `select row_to_json(x) as r from (select id, status, source_revision, source_rows, next_row, inserted_count,
    updated_count, unchanged_count, rejected_count, heartbeat_at from public.dpwh_sync_runs`;
  return {
    async state() {
      const success = await as<{ r: SyncRun }>(db, role, sub, `${runCols} where status = 'succeeded' order by finished_at desc limit 1) x`);
      const running = await as<{ r: SyncRun }>(db, role, sub, `${runCols} where status = 'running') x`);
      if (success.error) throw success.error;
      if (running.error) throw running.error;
      return { lastSuccess: success.rows[0]?.r ?? null, running: running.rows[0]?.r ?? null };
    },
    begin: (trigger, source, resume) =>
      call(`select row_to_json(r) as r from public.dpwh_sync_begin($1, $2::jsonb, $3::uuid) r`, [trigger, JSON.stringify(source), resume]),
    applyBatch: (runId, start, end, contracts, rejected) =>
      call(`select public.dpwh_sync_apply_batch($1::uuid, $2, $3, $4::jsonb, $5::jsonb) as r`,
        [runId, start, end, JSON.stringify(contracts), JSON.stringify(rejected)]),
    finish: (runId, status, error) =>
      call(`select row_to_json(r) as r from public.dpwh_sync_finish($1::uuid, $2::public.dpwh_sync_status, $3) r`, [runId, status, error]),
    logFailure: (trigger, error, source) =>
      call(`select row_to_json(r) as r from public.dpwh_sync_log_failure($1, $2, $3::jsonb) r`, [trigger, error, source && JSON.stringify(source)]),
  };
}
