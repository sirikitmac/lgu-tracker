import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DpwhSourceError, snapshotFor, type OpenSnapshot } from '@/lib/integrations/dpwh/nationwide/source';
import {
  SyncBusyError,
  runDpwhSync,
  type DpwhSyncStore,
  type SyncOptions,
  type SyncRun,
} from '@/lib/integrations/dpwh/nationwide/sync';
import type { DpwhContractRecord } from '@/types/dpwh';
import { rowWithId } from './fixtures';

const SNAP_A = snapshotFor('a'.repeat(40), '2026-01-16T00:00:00.000Z');
const SNAP_B = snapshotFor('b'.repeat(40), '2026-02-16T00:00:00.000Z');

/** In-memory store with the same rules as the dpwh_sync_* SQL functions. */
class MemoryStore implements DpwhSyncStore {
  contracts = new Map<string, DpwhContractRecord & { first_seen_run_id: string; last_changed_run_id: string }>();
  /** LGU-entered fields; the sync must never touch them. */
  reviews = new Map<string, { is_field_verified: boolean; notes: string }>();
  runs: (SyncRun & { error: string | null })[] = [];
  failures: string[] = [];
  busy = false;
  private seq = 0;

  async state() {
    const success = [...this.runs].reverse().find((r) => r.status === 'succeeded') ?? null;
    return { lastSuccess: success, running: this.runs.find((r) => r.status === 'running') ?? null };
  }
  async begin(_trigger: string, source: { source_revision: string; source_rows: number }, resumeRunId: string | null) {
    if (this.busy) throw new SyncBusyError('already running');
    const running = this.runs.find((r) => r.status === 'running');
    if (running) {
      if (running.id === resumeRunId && running.source_revision === source.source_revision) return { ...running };
      throw new SyncBusyError('already running');
    }
    const run = {
      id: `run-${++this.seq}`, status: 'running' as const, source_revision: source.source_revision,
      source_rows: source.source_rows, next_row: 0, inserted_count: 0, updated_count: 0, unchanged_count: 0,
      rejected_count: 0, heartbeat_at: new Date().toISOString(), error: null,
    };
    this.runs.push(run);
    return { ...run };
  }
  async applyBatch(runId: string, start: number, end: number, contracts: DpwhContractRecord[], rejected: unknown[]) {
    const run = this.runs.find((r) => r.id === runId)!;
    if (run.status !== 'running') throw new Error('not running');
    if (end <= run.next_row) return { already_applied: true, next_row: run.next_row };
    if (start !== run.next_row) throw new Error('out of order');
    let inserted = 0;
    let updated = 0;
    for (const c of contracts) {
      const existing = this.contracts.get(c.contract_id);
      if (!existing) {
        this.contracts.set(c.contract_id, { ...c, first_seen_run_id: runId, last_changed_run_id: runId });
        inserted++;
      } else if (existing.source_hash !== c.source_hash) {
        this.contracts.set(c.contract_id, { ...c, first_seen_run_id: existing.first_seen_run_id, last_changed_run_id: runId });
        updated++;
      }
    }
    const unchanged = contracts.length - inserted - updated;
    Object.assign(run, {
      next_row: end,
      inserted_count: run.inserted_count + inserted,
      updated_count: run.updated_count + updated,
      unchanged_count: run.unchanged_count + unchanged,
      rejected_count: run.rejected_count + rejected.length,
    });
    return { already_applied: false, inserted, updated, unchanged, rejected: rejected.length, next_row: end };
  }
  async finish(runId: string, status: 'succeeded' | 'failed' | 'no_new_snapshot', error: string | null) {
    const run = this.runs.find((r) => r.id === runId)!;
    if (status === 'succeeded' && run.next_row !== run.source_rows) throw new Error('incomplete');
    Object.assign(run, { status, error });
    return { ...run };
  }
  async logFailure(_trigger: string, error: string) {
    this.failures.push(error);
    return { id: `fail-${this.failures.length}`, status: 'failed' } as SyncRun;
  }
}

function fakeSnapshot(rows: Record<string, unknown>[], hooks: { failSliceAt?: number; failTimes?: number } = {}): (s: unknown) => Promise<OpenSnapshot> {
  let failures = 0;
  return async () => ({
    rows: rows.length,
    readContractIds: async () => rows.map((r) => (typeof r.contractId === 'string' ? r.contractId : null)),
    readSlice: async (start, end) => {
      if (hooks.failSliceAt !== undefined && start === hooks.failSliceAt && failures < (hooks.failTimes ?? Infinity)) {
        failures++;
        throw new Error('network reset');
      }
      return rows.slice(start, end);
    },
  });
}

const rows = (n: number, prefix = 'T') => Array.from({ length: n }, (_, i) => rowWithId(`${prefix}${String(i).padStart(5, '0')}`));

function options(store: MemoryStore, data: Record<string, unknown>[], extra: Partial<SyncOptions> = {}): SyncOptions {
  return {
    store, trigger: 'cli', deadline: Number.POSITIVE_INFINITY, snapshot: SNAP_A,
    openSnapshot: fakeSnapshot(data), sliceSize: 40, batchSize: 15, minRows: 1, ...extra,
  };
}

test('imports a full snapshot, then recognises it as already synced', async () => {
  const store = new MemoryStore();
  const data = rows(100);
  const first = await runDpwhSync(options(store, data));
  assert.equal(first.status, 'succeeded');
  assert.deepEqual(first.totals, { inserted: 100, updated: 0, unchanged: 0, rejected: 0 });
  assert.equal(store.contracts.size, 100);

  const again = await runDpwhSync(options(store, data));
  assert.equal(again.status, 'no_new_snapshot');
  assert.equal(store.contracts.size, 100);
});

test('re-running is idempotent and only changed rows are updated', async () => {
  const store = new MemoryStore();
  await runDpwhSync(options(store, rows(60)));
  const changed = rows(60);
  changed[7] = rowWithId('T00007', { progress: 55 });
  const rerun = await runDpwhSync(options(store, changed, { snapshot: SNAP_B }));
  assert.equal(rerun.status, 'succeeded');
  assert.deepEqual(rerun.totals, { inserted: 0, updated: 1, unchanged: 59, rejected: 0 });
  assert.equal(store.contracts.size, 60);
  const updated = store.contracts.get('T00007')!;
  assert.equal(updated.progress, 55);
  assert.notEqual(updated.first_seen_run_id, updated.last_changed_run_id);
});

test('never touches LGU-entered review fields', async () => {
  const store = new MemoryStore();
  await runDpwhSync(options(store, rows(30)));
  store.reviews.set('T00003', { is_field_verified: true, notes: 'Inspected 2026-03-01' });
  const changed = rows(30).map((r) => ({ ...r, progress: 90 }));
  await runDpwhSync(options(store, changed, { snapshot: SNAP_B }));
  assert.deepEqual(store.reviews.get('T00003'), { is_field_verified: true, notes: 'Inspected 2026-03-01' });
});

test('pauses at the time budget and resumes from the saved cursor', async () => {
  const store = new MemoryStore();
  const data = rows(200);
  // Deadline already inside the 30 s safety margin: processes nothing, pauses.
  const paused = await runDpwhSync(options(store, data, { deadline: Date.now() + 1_000 }));
  assert.equal(paused.status, 'paused');
  assert.equal(paused.nextRow, 0);
  const resumed = await runDpwhSync(options(store, data, { resumeRunId: paused.runId }));
  assert.equal(resumed.status, 'succeeded');
  assert.equal(resumed.runId, paused.runId);
  assert.equal(store.contracts.size, 200);
  assert.equal(store.runs.length, 1);
});

test('retries a transient read failure', async () => {
  const store = new MemoryStore();
  const outcome = await runDpwhSync(options(store, rows(100), { openSnapshot: fakeSnapshot(rows(100), { failSliceAt: 40, failTimes: 1 }) }));
  assert.equal(outcome.status, 'succeeded');
  assert.equal(store.contracts.size, 100);
});

test('a persistent failure fails the run but keeps every applied record', async () => {
  const store = new MemoryStore();
  await runDpwhSync(options(store, rows(100)));
  const outcome = await runDpwhSync(options(store, rows(100), { snapshot: SNAP_B, openSnapshot: fakeSnapshot(rows(100), { failSliceAt: 40 }) }));
  assert.equal(outcome.status, 'failed');
  assert.match(outcome.error!, /network reset/);
  assert.equal(store.contracts.size, 100);
  assert.equal(store.runs.at(-1)!.status, 'failed');
});

test('source unavailable: fails safely without starting a run', async () => {
  const store = new MemoryStore();
  const outcome = await runDpwhSync({
    ...options(store, []),
    snapshot: undefined,
    resolveLatestSnapshot: async () => { throw new DpwhSourceError('unavailable', 'HTTP 503'); },
  });
  assert.equal(outcome.status, 'failed');
  assert.equal(store.runs.length, 0);
  assert.equal(store.failures.length, 1);
});

test('malformed snapshot schema: fails safely without starting a run', async () => {
  const store = new MemoryStore();
  const outcome = await runDpwhSync({
    ...options(store, rows(10)),
    openSnapshot: async () => { throw new DpwhSourceError('schema', 'Snapshot is missing required columns: components.'); },
  });
  assert.equal(outcome.status, 'failed');
  assert.equal(store.runs.length, 0);
  assert.match(store.failures[0], /components/);
});

test('incomplete snapshot (far fewer rows than the last success) is refused before writing', async () => {
  const store = new MemoryStore();
  await runDpwhSync(options(store, rows(100)));
  const outcome = await runDpwhSync(options(store, rows(50), { snapshot: SNAP_B }));
  assert.equal(outcome.status, 'failed');
  assert.match(outcome.error!, /incomplete/);
  assert.equal(store.runs.length, 1);
  assert.equal(store.contracts.size, 100);
});

test('duplicate contract IDs: the first row wins, later ones are rejected', async () => {
  const store = new MemoryStore();
  const data = [...rows(100), rowWithId('T00001', { progress: 1 })];
  const outcome = await runDpwhSync(options(store, data));
  assert.equal(outcome.status, 'succeeded');
  assert.equal(outcome.totals.rejected, 1);
  assert.equal(store.contracts.get('T00001')!.progress, 100);
});

test('too many bad IDs or rejections fail the run', async () => {
  const store = new MemoryStore();
  const badIds = [...rows(90), ...Array.from({ length: 10 }, () => rowWithId(''))];
  const outcome = await runDpwhSync(options(store, badIds));
  assert.equal(outcome.status, 'failed');
  assert.match(outcome.error!, /missing/);
});

test('another active sync: reports busy and changes nothing', async () => {
  const store = new MemoryStore();
  store.busy = true;
  const outcome = await runDpwhSync(options(store, rows(10)));
  assert.equal(outcome.status, 'busy');
  assert.equal(store.contracts.size, 0);
});
