import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { as, createTestDb } from './pglite';

/**
 * Migration 20261103000100 (subaybayan_projects + subaybayan_dpwh_matches)
 * against a local PGlite database with every migration applied in order.
 * Never touches the hosted project.
 */

let db: PGlite;
before(async () => {
  db = await createTestDb();
});

const row = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  source_dataset: 'rlip',
  project_code: id,
  title: 'Concreting of Barangay Road',
  sector_category: 'infrastructure',
  sector_subcategory: 'Roads and bridges',
  classification_reason: 'title keyword "road"',
  latitude: 8.2,
  longitude: 124.2,
  location_precision: 'barangay_centroid',
  status: 'completed',
  source_url: 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip',
  retrieved_at: '2026-10-31',
  source_hash: 'abc',
  ...patch,
});

async function insert(role: 'anon' | 'authenticated' | 'service_role', r: Record<string, unknown>) {
  const cols = Object.keys(r);
  return as(db, role, null, `insert into public.subaybayan_projects (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(r));
}

test('migration is additive: existing tables keep their shape', async () => {
  const res = await db.query<{ n: number }>(`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'dpwh_contracts'`);
  assert.ok(res.rows[0].n > 50);
  const fk = await db.query<{ n: number }>(`
    select count(*)::int n from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu using (constraint_name, constraint_schema)
    where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'dpwh_contracts' and tc.table_name like 'subaybayan%'`);
  assert.equal(fk.rows[0].n, 0, 'no foreign key into dpwh_contracts');
});

test('service role writes; anon and authenticated can only read', async () => {
  assert.equal((await insert('service_role', row('RLIP-1'))).error, undefined);
  const anonWrite = await insert('anon', row('RLIP-2'));
  assert.equal(anonWrite.error?.code, '42501');
  const authWrite = await insert('authenticated', row('RLIP-3'));
  assert.equal(authWrite.error?.code, '42501');
  const read = await as<{ id: string; source_agency: string }>(db, 'anon', null, `select id, source_agency from public.subaybayan_projects`);
  assert.deepEqual(read.rows, [{ id: 'RLIP-1', source_agency: 'DILG' }]);
});

test('checks: category, status, precision, coordinates, unresolved ↔ no coordinates', async () => {
  for (const bad of [
    row('B1', { sector_category: 'roads' }),
    row('B2', { status: 'proposed' }),
    row('B3', { location_precision: 'exact' }),
    row('B4', { latitude: 91 }),
    row('B5', { longitude: null }),
    row('B6', { location_precision: 'unresolved' }),
    row('B7', { latitude: null, longitude: null }),
    row('B8', { owpa: 101 }),
    row('B9', { source_dataset: 'dpwh' }),
  ]) {
    const res = await insert('service_role', bad);
    assert.equal(res.error?.code, '23514', `${bad.id} should violate a check`);
  }
  assert.equal((await insert('service_role', row('OK-UNRES', { location_precision: 'unresolved', latitude: null, longitude: null }))).error, undefined);
});

test('updated_at is maintained by the shared trigger', async () => {
  await db.exec(`update public.subaybayan_projects set updated_at = '2000-01-01' where id = 'RLIP-1'`);
  await as(db, 'service_role', null, `update public.subaybayan_projects set title = 'Changed' where id = 'RLIP-1'`);
  const res = await db.query<{ recent: boolean }>(`select updated_at > now() - interval '1 minute' recent from public.subaybayan_projects where id = 'RLIP-1'`);
  assert.equal(res.rows[0].recent, true);
});

test('duplicate flags: service role writes, public reads, review status survives a re-flag', async () => {
  const flag = (score: number) =>
    as(db, 'service_role', null, `
      insert into public.subaybayan_dpwh_matches (subaybayan_id, dpwh_contract_id, match_class, rank, score, reasons, evidence)
      values ('RLIP-1', '24KL0017', 'potential', 1, $1, array['title 100%'], '{}'::jsonb)
      on conflict (subaybayan_id, dpwh_contract_id) do update set score = excluded.score, reasons = excluded.reasons`, [score]);
  assert.equal((await flag(0.75)).error, undefined);
  await db.exec(`update public.subaybayan_dpwh_matches set review_status = 'same_project'`);
  assert.equal((await flag(0.8)).error, undefined);
  const res = await as<{ review_status: string; score: string }>(db, 'anon', null, `select review_status, score from public.subaybayan_dpwh_matches`);
  assert.deepEqual(res.rows, [{ review_status: 'same_project', score: '0.800' }]);
  const anonWrite = await as(db, 'anon', null, `delete from public.subaybayan_dpwh_matches`);
  assert.equal(anonWrite.error?.code, '42501');
  const badClass = await as(db, 'service_role', null, `insert into public.subaybayan_dpwh_matches values ('RLIP-1', 'X', 'merged', 1, 0.5, '{}', '{}')`);
  assert.equal(badClass.error?.code, '23514');
});
