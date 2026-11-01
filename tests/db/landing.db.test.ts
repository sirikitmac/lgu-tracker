import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { as, createTestDb, USERS } from './pglite';

/**
 * Migration 20261106000100: the precomputed landing figures
 * (public.landing_stats), against a local PGlite database with every
 * migration applied in order. Never touches the hosted project.
 */

let db: PGlite;
const RUN = '00000000-0000-0000-0000-0000000000aa';
const HASH = 'a'.repeat(64);
const REV = 'b'.repeat(40);

interface LandingStats {
  points_per_region: number;
  region_points: { region: string; points: [number, number][] }[];
  nep_proposals: number;
  dilg_by_dataset: { dataset: string; count: number }[];
  dilg_regions: string[];
}

before(async () => {
  db = await createTestDb();
  await db.query(`insert into public.dpwh_sync_runs (id, trigger, status) values ($1, 'cli', 'failed')`, [RUN]);
  // Region X: 305 mapped contracts (amounts 1..305) and one without coordinates
  // but the largest amount; BARMM: 2 mapped.
  await db.query(`
    insert into public.dpwh_contracts (contract_id, title, category, category_method, category_reason, status, region,
                                       contract_amount, latitude, longitude, source_hash, source_revision, source_snapshot_at,
                                       first_seen_run_id, last_changed_run_id)
    select 'X' || lpad(i::text, 4, '0'), 'Road', 'roads_highways'::public.dpwh_category, 'none', 'test', 'completed'::public.dpwh_status, 'Region X',
           i, 8 + i / 10000.0, 124.123456, $1, $2, now(), $3::uuid, $3::uuid
      from generate_series(1, 305) i
    union all
    select 'XNOLOC', 'Bridge', 'bridges'::public.dpwh_category, 'none', 'test', 'ongoing'::public.dpwh_status, 'Region X', 1e12, null, null, $1, $2, now(), $3::uuid, $3::uuid
    union all
    select 'BAR' || i, 'Road', 'roads_highways'::public.dpwh_category, 'none', 'test', 'completed'::public.dpwh_status, 'Bangsamoro Autonomous Region in Muslim Mindanao',
           i * 10, 7.1, 124.2, $1, $2, now(), $3::uuid, $3::uuid
      from generate_series(1, 2) i`, [HASH, REV, RUN]);
  for (const [id, dataset, region] of [
    ['R1', 'rlip', 'REGION X - NORTHERN MINDANAO'],
    ['R2', 'rlip', 'REGION X - NORTHERN MINDANAO'],
    ['L1', 'lgsf', 'MIMAROPA'],
  ]) {
    await db.query(
      `insert into public.subaybayan_projects (id, source_dataset, project_code, title, sector_category, sector_subcategory,
         classification_reason, latitude, longitude, location_precision, status, project_owner, source_url, retrieved_at, source_hash, region)
       values ($1, $2, $1, 'Road', 'infrastructure', 'Roads and bridges', 'test', 8.2, 124.2, 'barangay_centroid', 'completed',
               'Citymun', 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip', '2026-10-31', 'abc', $3)`,
      [id, dataset, region]
    );
  }
});

async function landing(): Promise<{ computed_at: string; stats: LandingStats }> {
  const res = await as<{ computed_at: string; stats: LandingStats }>(db, 'anon', null, `select computed_at, stats from public.landing_stats where id = 1`);
  assert.equal(res.error, undefined, String(res.error));
  assert.equal(res.rows!.length, 1);
  return res.rows![0];
}

test('a DPWH stats refresh rebuilds the landing figures, readable by anon', async () => {
  await db.query(`select private.refresh_dpwh_directory_stats()`);
  const { stats } = await landing();
  assert.equal(stats.points_per_region, 300);
  const x = stats.region_points.find((r) => r.region === 'Region X')!;
  assert.equal(x.points.length, 300, 'capped at 300 per region');
  // Largest amount first, unmapped contracts skipped, rounded to 4 decimals.
  assert.deepEqual(x.points[0], [124.1235, 8.0305]);
  assert.deepEqual(x.points[299], [124.1235, 8.0006]);
  const barmm = stats.region_points.find((r) => r.region.startsWith('Bangsamoro'))!;
  assert.deepEqual(barmm.points, [[124.2, 7.1], [124.2, 7.1]]);
  assert.equal(stats.nep_proposals, 0);
  assert.deepEqual(stats.dilg_by_dataset, [{ dataset: 'lgsf', count: 1 }, { dataset: 'rlip', count: 2 }]);
  assert.deepEqual(stats.dilg_regions, ['MIMAROPA', 'REGION X - NORTHERN MINDANAO']);
});

test('only admins and the service role can trigger a refresh; nobody else can write', async () => {
  const before = (await landing()).computed_at;
  const call = `select public.refresh_landing_stats()`;
  assert.match((await as(db, 'anon', null, call)).error?.message ?? '', /permission denied/);
  assert.equal((await as(db, 'authenticated', USERS.citizen, call)).error?.code, '42501');
  for (const sql of [`update public.landing_stats set computed_at = now()`, `delete from public.landing_stats`]) {
    assert.match((await as(db, 'anon', null, sql)).error?.message ?? '', /permission denied/, sql);
    assert.match((await as(db, 'authenticated', USERS.admin, sql)).error?.message ?? '', /permission denied/, sql);
  }
  assert.equal((await as(db, 'authenticated', USERS.admin, call)).error, undefined);
  assert.equal((await as(db, 'service_role', null, call)).error, undefined);
  assert.ok((await landing()).computed_at >= before);
});
