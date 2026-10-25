import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { snapshotFor, type OpenSnapshot } from '@/lib/integrations/dpwh/nationwide/source';
import { runDpwhSync } from '@/lib/integrations/dpwh/nationwide/sync';
import { realRow, rowWithId } from '../dpwh/fixtures';
import { USERS, as, createTestDb, pgliteStore } from './pglite';

/**
 * Migration + RPC tests against a local PGlite database (never the hosted
 * project). Exercises the real sync engine end to end through the real SQL.
 */

const SNAP_A = snapshotFor('a'.repeat(40), '2026-01-16T00:00:00.000Z');
const SNAP_B = snapshotFor('b'.repeat(40), '2026-02-16T00:00:00.000Z');
const rows = (n: number) => [realRow, ...Array.from({ length: n - 1 }, (_, i) => rowWithId(`DB${String(i).padStart(5, '0')}`))];
const open = (data: Record<string, unknown>[]) => async (): Promise<OpenSnapshot> => ({
  rows: data.length,
  readContractIds: async () => data.map((r) => r.contractId as string),
  readSlice: async (s, e) => data.slice(s, e),
});

let db: PGlite;
const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n);

before(async () => {
  db = await createTestDb();
});

test('migrations apply and leave existing data and roles alone', async () => {
  await db.exec(`insert into public.projects (reference_code, title, category, barangay)
                 values ('LGU-TEST-001', 'Existing local project', 'infrastructure_public_works', 'Tibanga')`);
  const roles = (await db.query<{ n: number }>(`select count(*)::int n from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'app_role'`)).rows[0].n;
  assert.equal(roles, 9);
});

test('ordinary users cannot invoke the sync functions or write source records', async () => {
  const source = JSON.stringify({ source_dataset: 'test/dataset', source_file: 'f.parquet', source_revision: 'c'.repeat(40), source_snapshot_at: '2026-01-01', source_rows: 1 });
  const begin = `select public.dpwh_sync_begin('manual', $1::jsonb)`;
  const anon = await as(db, 'anon', null, begin, [source]);
  assert.match(anon.error!.message, /permission denied/);
  for (const user of [USERS.citizen, USERS.planner, USERS.engineer]) {
    const r = await as(db, 'authenticated', user, begin, [source]);
    assert.equal(r.error?.code, '42501', `user ${user}`);
  }
  for (const sql of [
    `insert into public.dpwh_contracts (contract_id) values ('X0001')`,
    `update public.dpwh_contracts set progress = 1`,
    `delete from public.dpwh_contracts`,
    `insert into public.dpwh_sync_runs (trigger) values ('cli')`,
    `update public.dpwh_directory_stats set computed_at = now()`,
  ]) {
    const r = await as(db, 'authenticated', USERS.admin, sql);
    assert.match(r.error?.message ?? '', /permission denied/, sql);
  }
  assert.equal(await count(`select count(*)::int n from public.dpwh_sync_runs`), 0);
});

test('admin sync imports through the real SQL with source values intact', async () => {
  const data = rows(120);
  const outcome = await runDpwhSync({
    store: pgliteStore(db, 'authenticated', USERS.admin), trigger: 'manual', deadline: Infinity,
    snapshot: SNAP_A, openSnapshot: open(data), sliceSize: 50, batchSize: 20, minRows: 1,
  });
  assert.equal(outcome.status, 'succeeded', outcome.error);
  assert.deepEqual(outcome.totals, { inserted: 120, updated: 0, unchanged: 0, rejected: 0 });

  const c = (await db.query<Record<string, unknown>>(`select * from public.dpwh_contracts where contract_id = '20N00065'`)).rows[0];
  assert.equal(c.implementing_office, 'Region XIII');
  assert.equal(c.region, 'Region XIII');
  assert.equal(c.province, 'Agusan del Norte');
  assert.equal(c.municipality, null);
  assert.equal(String(c.contract_amount), '102410000');
  assert.equal(String(c.approved_budget), '102874773.39');
  assert.equal(c.category, 'flood_control_drainage');
  assert.equal(c.source_revision, SNAP_A.revision);
  assert.equal(c.contract_name, null);
  assert.equal((c.components as unknown[]).length, 1);

  const run = (await db.query<Record<string, unknown>>(`select * from public.dpwh_sync_runs`)).rows[0];
  assert.equal(run.triggered_by, USERS.admin);
  assert.equal(run.status, 'succeeded');
  const stats = (await db.query<{ stats: { total_contracts: number; by_region: unknown[] } }>(`select stats from public.dpwh_directory_stats`)).rows[0].stats;
  assert.equal(stats.total_contracts, 120);
});

test('the public can read contracts and the summary; only admins see sync runs', async () => {
  const anon = await as<{ n: number }>(db, 'anon', null, `select count(*)::int n from public.dpwh_contracts`);
  assert.equal(anon.rows![0].n, 120);
  const summary = await as<{ n: number }>(db, 'anon', null, `select count(*)::int n from public.dpwh_directory_stats`);
  assert.equal(summary.rows![0].n, 1);
  const anonRuns = await as(db, 'anon', null, `select * from public.dpwh_sync_runs`);
  assert.match(anonRuns.error!.message, /permission denied/);
  const plannerRuns = await as<{ n: number }>(db, 'authenticated', USERS.planner, `select count(*)::int n from public.dpwh_sync_runs`);
  assert.equal(plannerRuns.rows![0].n, 0);
  const adminRuns = await as<{ n: number }>(db, 'authenticated', USERS.admin, `select count(*)::int n from public.dpwh_sync_runs`);
  assert.equal(adminRuns.rows![0].n, 1);
});

test('public map: anon reads coordinates through the directory view, but no private tables', async () => {
  const points = await as<{ n: number }>(db, 'anon', null, `
    select count(*)::int n from public.dpwh_contracts_directory
     where latitude is not null and longitude is not null
       and latitude between 4 and 22 and longitude between 116 and 127`);
  assert.ok(!points.error, points.error?.message);
  assert.ok(points.rows![0].n > 0);
  const cols = await as<{ contract_effectivity_date: string | null }>(db, 'anon', null,
    `select contract_effectivity_date from public.dpwh_contracts_directory order by region, province, contract_id limit 1`);
  assert.ok(!cols.error, cols.error?.message);
  for (const table of ['profiles', 'dpwh_sync_runs', 'dpwh_contract_reviews', 'audit_log']) {
    const res = await as(db, 'anon', null, `select * from public.${table} limit 1`);
    assert.match(res.error?.message ?? '', /permission denied/, `anon must not read ${table}`);
  }
  for (const fn of ['dpwh_sync_begin(\'cron\', \'{}\'::jsonb)', 'dpwh_sync_log_failure(\'cron\', \'x\')']) {
    const res = await as(db, 'anon', null, `select public.${fn}`);
    assert.match(res.error?.message ?? '', /permission denied/, `anon must not call ${fn}`);
  }
});

test('search, location filter, and sort work on the stored columns', async () => {
  const fts = await count(`select count(*)::int n from public.dpwh_contracts_directory where search @@ to_tsquery('simple', 'seawall:* & nasipit:*')`);
  assert.equal(fts, 120);
  const byId = await count(`select count(*)::int n from public.dpwh_contracts_directory where search @@ to_tsquery('simple', '20n00065:*')`);
  assert.equal(byId, 1);
  const province = await count(`select count(*)::int n from public.dpwh_contracts where provinces @> array['Agusan del Norte']`);
  assert.equal(province, 120);
  const contractor = await count(`select count(*)::int n from public.dpwh_contracts where contractor ilike 'mamsar%'`);
  assert.equal(contractor, 120);
});

test('LGU review fields: reviewers can write, the public cannot read, syncs never overwrite', async () => {
  const insert = `insert into public.dpwh_contract_reviews (contract_id, is_field_verified, verified_at, verified_by, verification_notes)
                  values ('20N00065', true, now(), $1, 'Inspected on site')`;
  const citizen = await as(db, 'authenticated', USERS.citizen, insert, [USERS.citizen]);
  assert.ok(citizen.error, 'citizen cannot create a review');
  const engineer = await as(db, 'authenticated', USERS.engineer, insert, [USERS.engineer]);
  assert.ok(!engineer.error, engineer.error?.message);
  const anon = await as(db, 'anon', null, `select * from public.dpwh_contract_reviews`);
  assert.match(anon.error!.message, /permission denied/);

  // A newer snapshot changes the reviewed contract's source values.
  const changed = rows(120).map((r, i) => (i === 0 ? { ...r, progress: 75, status: 'On-Going' } : r));
  const outcome = await runDpwhSync({
    store: pgliteStore(db, 'service_role', null), trigger: 'cron', deadline: Infinity,
    snapshot: SNAP_B, openSnapshot: open(changed), sliceSize: 50, batchSize: 20, minRows: 1,
  });
  assert.equal(outcome.status, 'succeeded', outcome.error);
  assert.deepEqual(outcome.totals, { inserted: 0, updated: 1, unchanged: 119, rejected: 0 });

  const contract = (await db.query<{ progress: string; status: string; first: string; last: string }>(
    `select progress::text, status, first_seen_run_id::text first, last_changed_run_id::text last from public.dpwh_contracts where contract_id = '20N00065'`)).rows[0];
  assert.equal(contract.progress, '75');
  assert.equal(contract.status, 'ongoing');
  assert.notEqual(contract.first, contract.last);
  const review = (await db.query<{ is_field_verified: boolean; verification_notes: string }>(
    `select is_field_verified, verification_notes from public.dpwh_contract_reviews where contract_id = '20N00065'`)).rows[0];
  assert.deepEqual(review, { is_field_verified: true, verification_notes: 'Inspected on site' });
});

test('re-running the same snapshot writes nothing new', async () => {
  const before = await count(`select count(*)::int n from public.dpwh_contracts`);
  const updatedBefore = (await db.query<{ t: string }>(`select max(updated_at)::text t from public.dpwh_contracts`)).rows[0].t;
  const outcome = await runDpwhSync({
    store: pgliteStore(db, 'service_role', null), trigger: 'cron', deadline: Infinity,
    snapshot: SNAP_B, openSnapshot: open(rows(120)), minRows: 1,
  });
  assert.equal(outcome.status, 'no_new_snapshot');
  const forced = await runDpwhSync({
    store: pgliteStore(db, 'service_role', null), trigger: 'cron', deadline: Infinity, force: true,
    snapshot: SNAP_B, openSnapshot: open(rows(120).map((r, i) => (i === 0 ? { ...r, progress: 75, status: 'On-Going' } : r))),
    minRows: 1, batchSize: 30,
  });
  assert.equal(forced.status, 'succeeded', forced.error);
  assert.deepEqual(forced.totals, { inserted: 0, updated: 0, unchanged: 120, rejected: 0 });
  assert.equal(await count(`select count(*)::int n from public.dpwh_contracts`), before);
  assert.equal((await db.query<{ t: string }>(`select max(updated_at)::text t from public.dpwh_contracts`)).rows[0].t, updatedBefore);
});

test('batches must be contiguous; replays are acknowledged, not re-applied', async () => {
  const store = pgliteStore(db, 'service_role', null);
  const source = { source_dataset: 'test/dataset', source_file: 'f.parquet', source_revision: 'e'.repeat(40), source_snapshot_at: '2026-03-01T00:00:00Z', source_rows: 10 };
  const run = await store.begin('cli', source, null);
  await assert.rejects(store.begin('cli', { ...source, source_revision: 'f'.repeat(40) }, null), /already running/);
  await assert.rejects(store.applyBatch(run.id, 5, 10, [], []), /does not continue/);
  const first = await store.applyBatch(run.id, 0, 5, [], []);
  assert.equal(first.already_applied, false);
  const replay = await store.applyBatch(run.id, 0, 5, [], []);
  assert.equal(replay.already_applied, true);
  await assert.rejects(store.finish(run.id, 'succeeded', null), /cannot mark succeeded/);
  const failed = await store.finish(run.id, 'failed', 'test');
  assert.equal(failed.status, 'failed');
  assert.equal(await count(`select count(*)::int n from public.dpwh_contracts`), 120);
});

test('existing LGU projects are untouched by all of the above', async () => {
  assert.equal(await count(`select count(*)::int n from public.projects`), 1);
  assert.equal(await count(`select count(*)::int n from public.projects where reference_code = 'LGU-TEST-001' and title = 'Existing local project'`), 1);
});
