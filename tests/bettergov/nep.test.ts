import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv } from '@/lib/integrations/bettergov/csv';
import type { HubSnapshot } from '@/lib/integrations/bettergov/hub';
import { normalizeNepRow } from '@/lib/integrations/bettergov/nep/normalize';
import { nepAdapter } from '@/lib/integrations/bettergov/nep/source';
import {
  runSourceSync,
  type SourceAdapter,
  type SourceMeta,
  type SourceSyncRun,
  type SourceSyncStore,
} from '@/lib/integrations/bettergov/sync';
import type { InfrastructureProjectRecord } from '@/types/infrastructureProject';

/**
 * The first two data rows of dpwh-nep-projects-2027.csv at revision a7594ab7,
 * verbatim, plus row 2027DPWH-Proposal-00325 (region "Nationwide").
 */
const HEADER = 'code,fiscal_year,region,office,project_name,program,sub_program,project_type,amount_php_thousands,amount_php,document_count,document_types';
const REAL_CSV = [
  HEADER,
  '2027DPWH-Proposal-00001,2027,Region IV-A,Batangas 2nd District Engineering Office,"Improvement of Road along Poblacion Road, San Pascual, Batangas",CONVERGENCE AND SPECIAL SUPPORT PROGRAM,Basic Infrastructure Program,BIP - Access Roads and/or Bridges from the National Roads leading to Major/ Strategic Public Buildings/ Facilities,33000,33000000,5,BP 202; Certificate of Implementability; Geotagged Photos; POW; RDC Endorsement',
  '2027DPWH-Proposal-00002,2027,Region IV-A,Batangas 2nd District Engineering Office,"Improvement of Road along Balimbing Road, San Pascual, Batangas",CONVERGENCE AND SPECIAL SUPPORT PROGRAM,Basic Infrastructure Program,BIP - Access Roads and/or Bridges from the National Roads leading to Major/ Strategic Public Buildings/ Facilities,20000,20000000,5,BP 202; Certificate of Implementability; Geotagged Photos; PDC Endorsement; POW',
  '2027DPWH-Proposal-00325,2027,Nationwide,Central Office,Rainwater Collector System - BARMM,CONVERGENCE AND SPECIAL SUPPORT PROGRAM,Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rain Water Collectors,Rainwater Collector System,38400,38400000,1,BP 202',
].join('\n') + '\n';

const rowsOf = (csv: string) => parseCsv(csv).rows;

test('CSV parser handles quotes, doubled quotes, embedded newlines, CRLF, and BOM', () => {
  const { header, rows } = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\n1,,3');
  assert.deepEqual(header, ['a', 'b', 'c']);
  assert.deepEqual(rows, [
    { a: 'x, y', b: 'he said "hi"', c: 'line1\nline2' },
    { a: '1', b: '', c: '3' },
  ]);
  assert.throws(() => parseCsv('a,b\n1,2,3\n'), /row 2 has 3 fields/);
  assert.throws(() => parseCsv('a\n"open'), /inside a quoted field/);
});

test('normalizes a real NEP row without inventing location', () => {
  const [row] = rowsOf(REAL_CSV);
  const result = normalizeNepRow(row);
  assert.ok(result.ok);
  const r = result.record;
  assert.equal(r.source, 'dpwh_nep_2027');
  assert.equal(r.source_id, '2027DPWH-Proposal-00001');
  assert.equal(r.title, 'Improvement of Road along Poblacion Road, San Pascual, Batangas');
  assert.equal(r.status, 'proposed');
  assert.equal(r.region, 'Region IV-A');
  assert.equal(r.province, null);
  assert.equal(r.municipality, null);
  assert.equal(r.latitude, null);
  assert.equal(r.implementing_office, 'Batangas 2nd District Engineering Office');
  assert.equal(r.amount, 33_000_000);
  assert.equal(r.fiscal_year, 2027);
  assert.equal(r.category, 'roads_highways');
  assert.equal(r.category_method, 'description_keywords');
  assert.deepEqual(r.source_record, row);
  assert.deepEqual(r.data_warnings, []);
  assert.match(r.source_hash, /^[0-9a-f]{64}$/);
  const again = normalizeNepRow({ ...row });
  assert.ok(again.ok);
  assert.equal(again.record.source_hash, r.source_hash, 'hash is deterministic');
});

test('maps region abbreviations, flags nationwide programs, and rejects malformed rows', () => {
  const nationwide = normalizeNepRow(rowsOf(REAL_CSV)[2]);
  assert.ok(nationwide.ok);
  assert.equal(nationwide.record.region, null);
  assert.deepEqual(nationwide.record.data_warnings, ['nationwide_program']);
  assert.equal(nationwide.record.category, 'water_infrastructure');

  const base = rowsOf(REAL_CSV)[0];
  for (const [abbr, name] of [['NCR', 'National Capital Region'], ['CAR', 'Cordillera Administrative Region'], ['NIR', 'Negros Island Region'], ['MIMAROPA', 'Region IV-B']]) {
    const r = normalizeNepRow({ ...base, region: abbr });
    assert.ok(r.ok && r.record.region === name, abbr);
  }
  const mismatch = normalizeNepRow({ ...base, amount_php: '1' });
  assert.ok(mismatch.ok && mismatch.record.data_warnings.includes('amount_mismatch'));
  assert.equal(normalizeNepRow({ ...base, code: '' }).ok, false);
  assert.equal(normalizeNepRow({ ...base, code: 'bad code!' }).ok, false);
  assert.equal(normalizeNepRow({ ...base, project_name: ' ' }).ok, false);
});

/** In-memory store with the same rules as the source_sync_* SQL functions. */
class MemoryStore implements SourceSyncStore {
  records = new Map<string, InfrastructureProjectRecord & { first_seen_run_id: string; last_changed_run_id: string }>();
  runs: (SourceSyncRun & { source: string; error: string | null })[] = [];
  failures: string[] = [];
  private seq = 0;
  async lastSuccess(source: string) {
    return [...this.runs].reverse().find((r) => r.source === source && r.status === 'succeeded') ?? null;
  }
  async begin(source: string, _trigger: string, meta: SourceMeta) {
    const run = {
      id: `run-${++this.seq}`, source, status: 'running' as const, source_revision: meta.source_revision, source_rows: meta.source_rows,
      processed_rows: 0, inserted_count: 0, updated_count: 0, unchanged_count: 0, rejected_count: 0, error: null,
    };
    this.runs.push(run);
    return { ...run };
  }
  async applyBatch(runId: string, rowsSeen: number, records: InfrastructureProjectRecord[], rejected: unknown[]) {
    const run = this.runs.find((r) => r.id === runId)!;
    assert.equal(rowsSeen, records.length + rejected.length);
    let inserted = 0;
    let updated = 0;
    for (const rec of records) {
      const key = `${rec.source}:${rec.source_id}`;
      const existing = this.records.get(key);
      if (!existing) {
        this.records.set(key, { ...rec, first_seen_run_id: runId, last_changed_run_id: runId });
        inserted++;
      } else if (existing.source_hash !== rec.source_hash) {
        this.records.set(key, { ...rec, first_seen_run_id: existing.first_seen_run_id, last_changed_run_id: runId });
        updated++;
      }
    }
    run.processed_rows += rowsSeen;
    return { inserted, updated, unchanged: records.length - inserted - updated, rejected: rejected.length };
  }
  async finish(runId: string, status: 'succeeded' | 'failed' | 'no_new_snapshot', error: string | null) {
    const run = this.runs.find((r) => r.id === runId)!;
    if (status === 'succeeded') assert.equal(run.processed_rows, run.source_rows);
    Object.assign(run, { status, error });
    return { ...run };
  }
  async logFailure(_source: string, _trigger: string, error: string) {
    this.failures.push(error);
    return { id: `fail-${this.failures.length}`, status: 'failed' } as SourceSyncRun;
  }
}

const snapshot = (revision: string): HubSnapshot => ({
  dataset: 'bettergovph/dpwh-nep-2027', file: 'dpwh-nep-projects-2027.csv', revision,
  committedAt: '2026-10-08T08:42:47.000Z', fileUrl: 'https://example.invalid', sizeBytes: null,
});
const adapter = (rows: Record<string, string>[], revision = 'a'.repeat(40)): SourceAdapter => ({
  ...nepAdapter,
  resolveSnapshot: async () => snapshot(revision),
  readRows: async () => rows,
});
const synthetic = (n: number) => {
  const base = rowsOf(REAL_CSV)[0];
  return Array.from({ length: n }, (_, i) => ({ ...base, code: `2027DPWH-Proposal-T${String(i).padStart(4, '0')}` }));
};

test('source sync imports, skips an unchanged snapshot, and updates only changed rows', async () => {
  const store = new MemoryStore();
  const data = synthetic(250);
  const first = await runSourceSync({ store, adapter: adapter(data), trigger: 'cli', batchSize: 100 });
  assert.equal(first.status, 'succeeded', first.error);
  assert.deepEqual(first.totals, { inserted: 250, updated: 0, unchanged: 0, rejected: 0 });

  const same = await runSourceSync({ store, adapter: adapter(data), trigger: 'cron' });
  assert.equal(same.status, 'no_new_snapshot');
  assert.equal(store.records.size, 250);

  const changed = data.map((r, i) => (i === 5 ? { ...r, amount_php: '34000000', amount_php_thousands: '34000' } : r));
  const next = await runSourceSync({ store, adapter: adapter(changed, 'b'.repeat(40)), trigger: 'cron' });
  assert.deepEqual(next.totals, { inserted: 0, updated: 1, unchanged: 249, rejected: 0 });
  const rec = store.records.get('dpwh_nep_2027:2027DPWH-Proposal-T0005')!;
  assert.equal(rec.amount, 34_000_000);
  assert.notEqual(rec.first_seen_run_id, rec.last_changed_run_id);
});

test('source sync keeps the first of duplicate IDs and refuses an incomplete snapshot', async () => {
  const store = new MemoryStore();
  const data = synthetic(200);
  const dupes = [...data, data[0]];
  const outcome = await runSourceSync({ store, adapter: adapter(dupes), trigger: 'cli', maxRejectRate: 0.5 });
  assert.equal(outcome.status, 'succeeded', outcome.error);
  assert.equal(outcome.totals.rejected, 1);
  assert.equal(store.records.size, 200);

  const shrunk = await runSourceSync({ store, adapter: adapter(data.slice(0, 120), 'c'.repeat(40)), trigger: 'cron' });
  assert.equal(shrunk.status, 'failed');
  assert.match(shrunk.error ?? '', /looks incomplete/);
  assert.equal(store.records.size, 200, 'nothing deleted or overwritten');
});

test('source sync logs a failure when the source is unavailable', async () => {
  const store = new MemoryStore();
  const outcome = await runSourceSync({
    store, trigger: 'cron',
    adapter: { ...nepAdapter, resolveSnapshot: async () => { throw new Error('HTTP 503'); } },
  });
  assert.equal(outcome.status, 'failed');
  assert.match(store.failures[0], /Source unavailable: HTTP 503/);
});
