import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { parseCsv } from '@/lib/integrations/bettergov/csv';
import { nepAdapter } from '@/lib/integrations/bettergov/nep/source';
import { runSourceSync, type SourceAdapter, type SourceSyncRun, type SourceSyncStore } from '@/lib/integrations/bettergov/sync';
import { snapshotFor, type OpenSnapshot } from '@/lib/integrations/dpwh/nationwide/source';
import { runDpwhSync } from '@/lib/integrations/dpwh/nationwide/sync';
import { realRow, rowWithId } from '../dpwh/fixtures';
import { USERS, as, createTestDb, pgliteStore, type Role } from './pglite';

/**
 * Migration 8 (scoped DPWH sync, infrastructure_projects, project_directory)
 * against a local PGlite database. Never touches the hosted project.
 */

let db: PGlite;
const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n);

before(async () => {
  db = await createTestDb();
});

const inRegion = (id: string, region: string) =>
  rowWithId(id, { components: [{ ...(realRow.components as Record<string, unknown>[])[0], region }] });
const open = (data: Record<string, unknown>[]) => async (): Promise<OpenSnapshot> => ({
  rows: data.length,
  readContractIds: async () => data.map((r) => r.contractId as string),
  readSlice: async (s, e) => data.slice(s, e),
});

function sourceStore(role: Role, sub: string | null): SourceSyncStore {
  const call = async <T>(sql: string, params: unknown[]): Promise<T> => {
    const res = await as<{ r: T }>(db, role, sub, sql, params);
    if (res.error) throw res.error;
    return res.rows[0].r;
  };
  return {
    async lastSuccess(source) {
      const res = await as<{ r: SourceSyncRun }>(db, role, sub,
        `select row_to_json(x) r from (select * from public.source_sync_runs where source = $1 and status = 'succeeded'
          order by finished_at desc limit 1) x`, [source]);
      if (res.error) throw res.error;
      return res.rows[0]?.r ?? null;
    },
    begin: (source, trigger, meta) =>
      call(`select row_to_json(r) r from public.source_sync_begin($1, $2, $3::jsonb) r`, [source, trigger, JSON.stringify(meta)]),
    applyBatch: (runId, seen, records, rejected) =>
      call(`select public.source_sync_apply_batch($1::uuid, $2, $3::jsonb, $4::jsonb) r`, [runId, seen, JSON.stringify(records), JSON.stringify(rejected)]),
    finish: (runId, status, error) =>
      call(`select row_to_json(r) r from public.source_sync_finish($1::uuid, $2::public.dpwh_sync_status, $3) r`, [runId, status, error]),
    logFailure: (source, trigger, error, meta) =>
      call(`select row_to_json(r) r from public.source_sync_log_failure($1, $2, $3, $4::jsonb) r`, [source, trigger, error, meta && JSON.stringify(meta)]),
  };
}

const NEP_CSV = [
  'code,fiscal_year,region,office,project_name,program,sub_program,project_type,amount_php_thousands,amount_php,document_count,document_types',
  '2027DPWH-Proposal-00001,2027,Region IV-A,Batangas 2nd District Engineering Office,"Improvement of Road along Poblacion Road, San Pascual, Batangas",CONVERGENCE AND SPECIAL SUPPORT PROGRAM,Basic Infrastructure Program,BIP - Access Roads and/or Bridges from the National Roads leading to Major/ Strategic Public Buildings/ Facilities,33000,33000000,5,BP 202; Certificate of Implementability; Geotagged Photos; POW; RDC Endorsement',
].join('\n');
const nepRows = (n: number) => {
  const [base] = parseCsv(NEP_CSV).rows;
  return [base, ...Array.from({ length: n - 1 }, (_, i) => ({ ...base, code: `2027DPWH-Proposal-T${String(i).padStart(4, '0')}`, region: i % 2 ? 'Region X' : 'NCR' }))];
};
const nep = (rows: Record<string, string>[], revision = 'a'.repeat(40)): SourceAdapter => ({
  ...nepAdapter,
  resolveSnapshot: async () => ({
    dataset: 'bettergovph/dpwh-nep-2027', file: 'dpwh-nep-projects-2027.csv', revision,
    committedAt: '2026-10-08T08:42:47.000Z', fileUrl: 'https://example.invalid', sizeBytes: null,
  }),
  readRows: async () => rows,
});

test('a scoped DPWH sync stores only in-scope contracts and logs the scope and skipped count', async () => {
  const data = [
    ...Array.from({ length: 40 }, (_, i) => inRegion(`SX${String(i).padStart(4, '0')}`, 'Region X')),
    ...Array.from({ length: 25 }, (_, i) => inRegion(`SL${String(i).padStart(4, '0')}`, 'Region I')),
  ];
  const outcome = await runDpwhSync({
    store: pgliteStore(db, 'service_role', null), trigger: 'cron', deadline: Infinity,
    snapshot: snapshotFor('a'.repeat(40), '2026-01-16T00:00:00.000Z'), openSnapshot: open(data),
    sliceSize: 30, batchSize: 10, minRows: 1, scopeRegions: ['Region X'],
  });
  assert.equal(outcome.status, 'succeeded', outcome.error);
  assert.deepEqual(outcome.totals, { inserted: 40, updated: 0, unchanged: 0, rejected: 0, outOfScope: 25 });
  assert.equal(await count(`select count(*)::int n from public.dpwh_contracts`), 40);
  assert.equal(await count(`select count(*)::int n from public.dpwh_contracts where region <> 'Region X'`), 0);
  const run = (await db.query<{ scope_regions: string[]; out_of_scope_count: number }>(
    `select scope_regions, out_of_scope_count from public.dpwh_sync_runs`)).rows[0];
  assert.deepEqual(run.scope_regions, ['Region X']);
  assert.equal(run.out_of_scope_count, 25);
});

test('the database refuses contracts outside a run\'s scope', async () => {
  const store = pgliteStore(db, 'service_role', null);
  const source = { source_dataset: 'test/dataset', source_file: 'f.parquet', source_revision: 'd'.repeat(40),
    source_snapshot_at: '2026-03-01T00:00:00Z', source_rows: 1, scope_regions: ['Region X'] };
  const run = await store.begin('cli', source, null);
  const { normalizeDetailsRow } = await import('@/lib/integrations/dpwh/nationwide/normalize');
  const outside = normalizeDetailsRow(inRegion('OUT0001', 'Region I'), { sha: 'd'.repeat(40), committedAt: '2026-03-01T00:00:00Z', fileUrl: 'x' });
  assert.ok(outside.ok);
  await assert.rejects(store.applyBatch(run.id, 0, 1, [outside.record], []), /outside the run's scope/);
  await store.finish(run.id, 'failed', 'test');
  assert.equal(await count(`select count(*)::int n from public.dpwh_contracts where contract_id = 'OUT0001'`), 0);
});

test('storage usage is readable by admins and the server only', async () => {
  for (const [role, sub] of [['anon', null], ['authenticated', USERS.citizen], ['authenticated', USERS.planner]] as const) {
    const r = await as(db, role, sub, `select public.sync_storage_usage() n`);
    assert.ok(r.error, `${role} ${sub} must be refused`);
  }
  const admin = await as<{ n: string }>(db, 'authenticated', USERS.admin, `select public.sync_storage_usage() n`);
  assert.ok(Number(admin.rows![0].n) > 0);
});

test('NEP projects import through the real SQL, idempotently, with the original row kept', async () => {
  const rows = nepRows(30);
  const first = await runSourceSync({ store: sourceStore('service_role', null), adapter: nep(rows), trigger: 'cron', minRows: 1, batchSize: 7 });
  assert.equal(first.status, 'succeeded', first.error);
  assert.deepEqual(first.totals, { inserted: 30, updated: 0, unchanged: 0, rejected: 0 });

  const p = (await db.query<Record<string, unknown>>(
    `select * from public.infrastructure_projects where source = 'dpwh_nep_2027' and source_id = '2027DPWH-Proposal-00001'`)).rows[0];
  assert.equal(p.status, 'proposed');
  assert.equal(p.region, 'Region IV-A');
  assert.equal(String(p.amount), '33000000');
  assert.equal(p.source_dataset, 'bettergovph/dpwh-nep-2027');
  assert.equal((p.source_record as Record<string, string>).document_types, 'BP 202; Certificate of Implementability; Geotagged Photos; POW; RDC Endorsement');
  assert.equal(await count(`select count(*)::int n from public.infrastructure_projects where region = 'National Capital Region'`), 15);

  const same = await runSourceSync({ store: sourceStore('service_role', null), adapter: nep(rows), trigger: 'cron', minRows: 1 });
  assert.equal(same.status, 'no_new_snapshot');
  const forced = await runSourceSync({ store: sourceStore('authenticated', USERS.admin), adapter: nep(rows), trigger: 'manual', minRows: 1, force: true });
  assert.deepEqual(forced.totals, { inserted: 0, updated: 0, unchanged: 30, rejected: 0 });
  assert.equal(await count(`select count(*)::int n from public.infrastructure_projects`), 30);
  const runs = (await db.query<{ status: string }>(`select status from public.source_sync_runs order by started_at`)).rows.map((r) => r.status);
  assert.deepEqual(runs, ['succeeded', 'no_new_snapshot', 'succeeded']);
});

test('only admins and the server can import sources or read the import log', async () => {
  const meta = JSON.stringify({ source_dataset: 'x/y', source_file: 'f.csv', source_revision: 'b'.repeat(40), source_snapshot_at: '2026-01-01', source_rows: 1 });
  const anon = await as(db, 'anon', null, `select public.source_sync_begin('dpwh_nep_2027', 'cron', $1::jsonb)`, [meta]);
  assert.match(anon.error!.message, /permission denied/);
  for (const user of [USERS.citizen, USERS.planner, USERS.engineer]) {
    const r = await as(db, 'authenticated', user, `select public.source_sync_begin('dpwh_nep_2027', 'cron', $1::jsonb)`, [meta]);
    assert.equal(r.error?.code, '42501');
  }
  for (const sql of [`delete from public.infrastructure_projects`, `update public.infrastructure_projects set title = 'x'`]) {
    const r = await as(db, 'authenticated', USERS.admin, sql);
    assert.match(r.error?.message ?? '', /permission denied/, sql);
  }
  assert.match((await as(db, 'anon', null, `select * from public.source_sync_runs`)).error!.message, /permission denied/);
  const planner = await as<{ n: number }>(db, 'authenticated', USERS.planner, `select count(*)::int n from public.source_sync_runs`);
  assert.equal(planner.rows![0].n, 0);
});

test('project_directory lists every source for the public, with search and filters', async () => {
  const all = await as<{ source: string; n: number }>(db, 'anon', null,
    `select source, count(*)::int n from public.project_directory group by source order by source`);
  assert.ok(!all.error, all.error?.message);
  assert.deepEqual(all.rows, [{ source: 'dpwh_contracts', n: 40 }, { source: 'dpwh_nep_2027', n: 30 }]);

  const search = await as<{ record_id: string }>(db, 'anon', null,
    `select record_id from public.project_directory where search @@ to_tsquery('simple', 'poblacion:* & batangas:*')`);
  assert.deepEqual(search.rows!.map((r) => r.record_id).sort()[0], '2027DPWH-Proposal-00001');

  const regionX = await as<{ source: string; n: number }>(db, 'anon', null,
    `select source, count(*)::int n from public.project_directory where region = 'Region X' group by source order by source`);
  assert.deepEqual(regionX.rows, [{ source: 'dpwh_contracts', n: 40 }, { source: 'dpwh_nep_2027', n: 14 }]);

  const proposed = await as<{ n: number }>(db, 'anon', null, `select count(*)::int n from public.project_directory where status = 'proposed'`);
  assert.equal(proposed.rows![0].n, 30);
  const mapped = await as<{ n: number }>(db, 'anon', null,
    `select count(*)::int n from public.project_directory where latitude is not null and source = 'dpwh_nep_2027'`);
  assert.equal(mapped.rows![0].n, 0, 'NEP has no coordinates; nothing is placed on the map');
});
