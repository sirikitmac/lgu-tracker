import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { snapshotFor, type OpenSnapshot } from '@/lib/integrations/dpwh/nationwide/source';
import { runDpwhSync } from '@/lib/integrations/dpwh/nationwide/sync';
import { realRow, rowWithId } from '../dpwh/fixtures';
import { USERS, as, createTestDb, pgliteStore } from './pglite';

/** The map's bubble table and function, against local PGlite through the real migrations and sync. */

const SNAP = snapshotFor('a'.repeat(40), '2026-01-16T00:00:00.000Z');
const data = [realRow, ...Array.from({ length: 29 }, (_, i) => rowWithId(`BB${String(i).padStart(5, '0')}`))];
const open = async (): Promise<OpenSnapshot> => ({
  rows: data.length,
  readContractIds: async () => data.map((r) => r.contractId as string),
  readSlice: async (s, e) => data.slice(s, e),
});

let db: PGlite;
type Bubble = { lat: number; lng: number; n: string | number; region: string | null; statuses: Record<string, number> };
const bubbles = (level: number, bbox: [number, number, number, number], filters: [string | null, string | null, string | null] = [null, null, null]) =>
  as<Bubble>(db, 'anon', null, `select * from public.dpwh_map_bubbles($1::smallint, $2, $3, $4, $5, $6, $7, $8)`, [level, ...bbox, ...filters]);

before(async () => {
  db = await createTestDb();
  const outcome = await runDpwhSync({
    store: pgliteStore(db, 'authenticated', USERS.admin), trigger: 'manual', deadline: Infinity,
    snapshot: SNAP, openSnapshot: open, sliceSize: 50, batchSize: 20, minRows: 1,
  });
  assert.equal(outcome.status, 'succeeded', outcome.error);
  // Spread some contracts out: Cebu / Davao, different statuses and regions. (Test setup writes as the owner.)
  await db.exec(`
    update public.dpwh_contracts set latitude = 10.31, longitude = 123.89, region = 'Region VII', status = 'ongoing'
     where contract_id in (select contract_id from public.dpwh_contracts where contract_id like 'BB%' order by contract_id limit 8);
    update public.dpwh_contracts set latitude = 7.07, longitude = 125.61, region = 'Region XI', status = 'completed'
     where contract_id in (select contract_id from public.dpwh_contracts where contract_id like 'BB%' order by contract_id desc limit 5);
    update public.dpwh_contracts set latitude = null, longitude = null where contract_id in
      (select contract_id from public.dpwh_contracts where contract_id like 'BB%' and latitude = 8.9909486 order by contract_id limit 3);
  `);
  await db.exec(`select private.refresh_dpwh_map_cells()`);
});

test('a successful sync rebuilt the cells through the trigger', async () => {
  const n = (await db.query<{ n: number }>(`select count(*)::int n from public.dpwh_map_cells`)).rows[0].n;
  assert.ok(n > 0);
});

test('counts add up: every mapped contract is in exactly one bubble per level', async () => {
  const mapped = (await db.query<{ n: number }>(`select count(*)::int n from public.dpwh_contracts where latitude is not null`)).rows[0].n;
  for (const level of [0, 1, 2]) {
    const r = await bubbles(level, [114, 3, 129.5, 22.5]);
    assert.equal(r.error, undefined);
    assert.equal(r.rows!.reduce((sum, b) => sum + Number(b.n), 0), mapped, `level ${level}`);
  }
});

test('bubbles carry the dominant region and a status breakdown at the contracts\' average position', async () => {
  const r = await bubbles(1, [123, 9.5, 124.5, 11]);
  assert.equal(r.rows!.length, 1);
  const b = r.rows![0];
  assert.equal(Number(b.n), 8);
  assert.equal(b.region, 'Region VII');
  assert.deepEqual(b.statuses, { ongoing: 8 });
  assert.ok(Math.abs(b.lat - 10.31) < 1e-9 && Math.abs(b.lng - 123.89) < 1e-9);
});

test('the viewport and the region / category / status filters narrow the bubbles', async () => {
  assert.equal((await bubbles(0, [114, 3, 129.5, 22.5], ['Region XI', null, null])).rows!.reduce((s, b) => s + Number(b.n), 0), 5);
  assert.equal((await bubbles(0, [114, 3, 129.5, 22.5], [null, null, 'ongoing'])).rows!.reduce((s, b) => s + Number(b.n), 0), 8);
  assert.equal((await bubbles(0, [114, 3, 129.5, 22.5], [null, 'bridges', null])).rows!.length, 0);
  assert.equal((await bubbles(2, [125, 6.5, 126, 7.5])).rows!.reduce((s, b) => s + Number(b.n), 0), 5);
});

test('everyone can read bubbles, nobody can write the table, and only the owner can rebuild', async () => {
  for (const [role, sub] of [['anon', null], ['authenticated', USERS.citizen]] as const) {
    assert.ok((await as(db, role, sub, `select count(*)::int n from public.dpwh_map_cells`)).rows![0]);
    for (const sql of [`delete from public.dpwh_map_cells`, `insert into public.dpwh_map_cells values (0,0,0,'','','',1,0,0)`]) {
      assert.match((await as(db, role, sub, sql)).error?.message ?? '', /permission denied|row-level security/, `${role}: ${sql}`);
    }
    assert.match((await as(db, role, sub, `select private.refresh_dpwh_map_cells()`)).error?.message ?? '', /permission denied/);
  }
});
