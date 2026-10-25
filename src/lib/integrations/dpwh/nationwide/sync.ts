import type { DpwhContractRecord } from '@/types/dpwh';
import { normalizeDetailsRow } from './normalize';
import {
  DpwhSourceError,
  openSnapshot as openSnapshotDefault,
  resolveLatestSnapshot as resolveLatestDefault,
  type DpwhSnapshot,
  type OpenSnapshot,
} from './source';

/**
 * Resumable, idempotent nationwide DPWH sync.
 *
 * One invocation processes the snapshot in row slices until it finishes or
 * its time budget runs low, then returns "paused"; the next invocation
 * resumes from the run's saved cursor. Every write goes through the
 * dpwh_sync_* database functions, keyed on contract_id. Nothing is ever
 * deleted, so a failed or partial run leaves existing records intact.
 */

export type SyncTrigger = 'cron' | 'manual' | 'cli';

export interface SyncRun {
  id: string;
  status: 'running' | 'succeeded' | 'failed' | 'no_new_snapshot';
  source_revision: string | null;
  source_rows: number | null;
  next_row: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  rejected_count: number;
  heartbeat_at: string;
}

export interface RejectedRow {
  row: number;
  contract_id: string | null;
  reason: string;
}

export interface BatchResult {
  already_applied: boolean;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  rejected?: number;
  next_row: number;
}

export interface SourceInfo {
  source_dataset: string;
  source_file: string;
  source_revision: string;
  source_snapshot_at: string;
  source_rows: number;
}

/** Database operations the engine needs (Supabase RPCs in production). */
export interface DpwhSyncStore {
  state(): Promise<{ lastSuccess: SyncRun | null; running: SyncRun | null }>;
  begin(trigger: SyncTrigger, source: SourceInfo, resumeRunId: string | null): Promise<SyncRun>;
  applyBatch(runId: string, rowStart: number, rowEnd: number, contracts: DpwhContractRecord[], rejected: RejectedRow[]): Promise<BatchResult>;
  finish(runId: string, status: 'succeeded' | 'failed' | 'no_new_snapshot', error: string | null): Promise<SyncRun>;
  logFailure(trigger: SyncTrigger, error: string, source: Partial<SourceInfo> | null): Promise<SyncRun>;
}

/** Thrown by a store when another sync is actively running. */
export class SyncBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncBusyError';
  }
}

export interface SyncOptions {
  store: DpwhSyncStore;
  trigger: SyncTrigger;
  /** Absolute deadline (ms since epoch) for this invocation. */
  deadline: number;
  snapshot?: DpwhSnapshot;
  resumeRunId?: string | null;
  /** Re-import even when this snapshot already succeeded. */
  force?: boolean;
  sliceSize?: number;
  batchSize?: number;
  /** Refuse snapshots smaller than this. */
  minRows?: number;
  /** Refuse snapshots with fewer rows than this share of the last successful one. */
  minRowsRatio?: number;
  /** Fail the run when more than this share of rows is rejected. */
  maxRejectRate?: number;
  /** Refuse snapshots where more than this share of IDs is missing or duplicated. */
  maxBadIdRate?: number;
  log?: (message: string) => void;
  /** Injectable for tests. */
  resolveLatestSnapshot?: () => Promise<DpwhSnapshot>;
  openSnapshot?: (snapshot: DpwhSnapshot) => Promise<OpenSnapshot>;
}

export interface SyncOutcome {
  status: 'succeeded' | 'failed' | 'no_new_snapshot' | 'paused' | 'busy';
  runId: string | null;
  snapshot: DpwhSnapshot | null;
  sourceRows: number | null;
  nextRow: number | null;
  /** Counts for the whole run so far (all invocations). */
  totals: { inserted: number; updated: number; unchanged: number; rejected: number };
  error?: string;
}

const RETRIES = 3;

async function withRetry<T>(fn: () => Promise<T>, log: (m: string) => void): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SyncBusyError || error instanceof DpwhSourceError) throw error;
      lastError = error;
      if (attempt < RETRIES) {
        log(`  attempt ${attempt} failed (${(error as Error).message}); retrying`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

function totalsOf(run: SyncRun) {
  return {
    inserted: run.inserted_count,
    updated: run.updated_count,
    unchanged: run.unchanged_count,
    rejected: run.rejected_count,
  };
}

/** First row index per contract ID; later occurrences are duplicates. */
export function indexContractIds(ids: (string | null)[]) {
  const first = new Map<string, number>();
  let missing = 0;
  let duplicates = 0;
  ids.forEach((id, i) => {
    if (!id) missing += 1;
    else if (first.has(id)) duplicates += 1;
    else first.set(id, i);
  });
  return { first, missing, duplicates };
}

/** Normalizes rows [start, start + raw.length) into records and rejections. */
export function prepareRows(
  raw: Record<string, unknown>[],
  start: number,
  firstIndex: Map<string, number>,
  snapshot: DpwhSnapshot
): { contracts: DpwhContractRecord[]; rejected: RejectedRow[] } {
  const contracts: DpwhContractRecord[] = [];
  const rejected: RejectedRow[] = [];
  const revision = { sha: snapshot.revision, committedAt: snapshot.committedAt, fileUrl: snapshot.fileUrl };
  raw.forEach((row, offset) => {
    const index = start + offset;
    const id = typeof row.contractId === 'string' ? row.contractId.trim() : null;
    if (id && firstIndex.get(id) !== undefined && firstIndex.get(id) !== index) {
      rejected.push({ row: index, contract_id: id, reason: 'Duplicate contractId in snapshot; first occurrence kept.' });
      return;
    }
    const result = normalizeDetailsRow(row, revision);
    if (result.ok) contracts.push(result.record);
    else rejected.push({ row: index, contract_id: result.contractId, reason: result.reason });
  });
  return { contracts, rejected };
}

export async function runDpwhSync(options: SyncOptions): Promise<SyncOutcome> {
  const {
    store,
    trigger,
    deadline,
    sliceSize = 10_000,
    batchSize = 500,
    minRows = 1_000,
    minRowsRatio = 0.9,
    maxRejectRate = 0.02,
    maxBadIdRate = 0.01,
    log = () => {},
  } = options;
  const resolveLatest = options.resolveLatestSnapshot ?? (() => resolveLatestDefault());
  const open = options.openSnapshot ?? openSnapshotDefault;
  const empty = { inserted: 0, updated: 0, unchanged: 0, rejected: 0 };

  // 1. Identify and open the snapshot. Failures here never touch contracts.
  let snapshot: DpwhSnapshot;
  let opened: OpenSnapshot;
  try {
    snapshot = options.snapshot ?? (await resolveLatest());
    log(`Snapshot ${snapshot.revision} (${snapshot.committedAt})`);
  } catch (error) {
    const message = (error as Error).message;
    await store.logFailure(trigger, `Source unavailable: ${message}`, null).catch(() => undefined);
    return { status: 'failed', runId: null, snapshot: null, sourceRows: null, nextRow: null, totals: empty, error: message };
  }
  const partialSource = {
    source_dataset: snapshot.dataset,
    source_file: snapshot.file,
    source_revision: snapshot.revision,
    source_snapshot_at: snapshot.committedAt,
  };
  try {
    opened = await open(snapshot);
  } catch (error) {
    const message = (error as Error).message;
    await store.logFailure(trigger, message, partialSource).catch(() => undefined);
    return { status: 'failed', runId: null, snapshot, sourceRows: null, nextRow: null, totals: empty, error: message };
  }
  const source: SourceInfo = { ...partialSource, source_rows: opened.rows };
  log(`Rows in snapshot: ${opened.rows.toLocaleString('en-US')}`);

  // 2. Refuse incomplete snapshots before writing anything.
  const { lastSuccess, running } = await store.state();
  const floor = Math.max(minRows, Math.ceil((lastSuccess?.source_rows ?? 0) * minRowsRatio));
  if (opened.rows < floor) {
    const message = `Snapshot looks incomplete: ${opened.rows} rows, expected at least ${floor}.`;
    await store.logFailure(trigger, message, source).catch(() => undefined);
    return { status: 'failed', runId: null, snapshot, sourceRows: opened.rows, nextRow: null, totals: empty, error: message };
  }

  // 3. Nothing new to import.
  if (!running && !options.force && !options.resumeRunId && lastSuccess?.source_revision === snapshot.revision) {
    const run = await store.begin(trigger, source, null);
    const done = await store.finish(run.id, 'no_new_snapshot', null);
    log('No new snapshot since the last successful sync.');
    return { status: 'no_new_snapshot', runId: done.id, snapshot, sourceRows: opened.rows, nextRow: null, totals: empty };
  }

  // 4. Start or resume a run.
  let run: SyncRun;
  try {
    run = await store.begin(trigger, source, options.resumeRunId ?? null);
  } catch (error) {
    if (error instanceof SyncBusyError) {
      return { status: 'busy', runId: running?.id ?? null, snapshot, sourceRows: opened.rows, nextRow: running?.next_row ?? null, totals: empty, error: error.message };
    }
    throw error;
  }
  log(`Run ${run.id} ${run.next_row > 0 ? `resuming at row ${run.next_row}` : 'started'}`);

  try {
    // 5. Validate identifiers across the whole snapshot (one cheap column).
    const ids = await opened.readContractIds();
    if (ids.length !== opened.rows) {
      throw new DpwhSourceError('incomplete', `Read ${ids.length} contract IDs, expected ${opened.rows}.`);
    }
    const { first, missing, duplicates } = indexContractIds(ids);
    if ((missing + duplicates) / opened.rows > maxBadIdRate) {
      throw new DpwhSourceError('incomplete', `${missing} missing and ${duplicates} duplicate contract IDs exceed the ${maxBadIdRate * 100}% limit.`);
    }

    // 6. Process slices until done or out of time.
    let cursor = run.next_row;
    let lastSliceMs = 0;
    while (cursor < opened.rows) {
      const remaining = deadline - Date.now();
      if (remaining < Math.max(30_000, lastSliceMs * 1.5)) {
        log(`Pausing at row ${cursor} (time budget).`);
        return { status: 'paused', runId: run.id, snapshot, sourceRows: opened.rows, nextRow: cursor, totals: totalsOf(run) };
      }
      const sliceStart = Date.now();
      const end = Math.min(cursor + sliceSize, opened.rows);
      const raw = await withRetry(() => opened.readSlice(cursor, end), log);
      if (raw.length !== end - cursor) {
        throw new DpwhSourceError('incomplete', `Slice [${cursor}, ${end}) returned ${raw.length} rows.`);
      }
      for (let a = cursor; a < end; a += batchSize) {
        const b = Math.min(a + batchSize, end);
        const { contracts, rejected } = prepareRows(raw.slice(a - cursor, b - cursor), a, first, snapshot);
        const result = await withRetry(() => store.applyBatch(run.id, a, b, contracts, rejected), log);
        if (!result.already_applied) {
          run = {
            ...run,
            next_row: result.next_row,
            inserted_count: run.inserted_count + (result.inserted ?? 0),
            updated_count: run.updated_count + (result.updated ?? 0),
            unchanged_count: run.unchanged_count + (result.unchanged ?? 0),
            rejected_count: run.rejected_count + (result.rejected ?? 0),
          };
        }
      }
      cursor = end;
      lastSliceMs = Date.now() - sliceStart;
      log(`Rows ${end.toLocaleString('en-US')}/${opened.rows.toLocaleString('en-US')} ` +
        `(+${run.inserted_count} ins, ${run.updated_count} upd, ${run.unchanged_count} same, ${run.rejected_count} rej) ${lastSliceMs} ms`);
    }

    // 7. Finish. A high reject rate fails the run; applied rows stay.
    if (run.rejected_count / opened.rows > maxRejectRate) {
      const message = `${run.rejected_count} rows rejected (over the ${maxRejectRate * 100}% limit).`;
      const done = await store.finish(run.id, 'failed', message);
      return { status: 'failed', runId: run.id, snapshot, sourceRows: opened.rows, nextRow: done.next_row, totals: totalsOf(done), error: message };
    }
    const done = await store.finish(run.id, 'succeeded', null);
    return { status: 'succeeded', runId: run.id, snapshot, sourceRows: opened.rows, nextRow: done.next_row, totals: totalsOf(done) };
  } catch (error) {
    const message = (error as Error).message;
    log(`Run failed: ${message}`);
    const done = await store.finish(run.id, 'failed', message).catch(() => run);
    return { status: 'failed', runId: run.id, snapshot, sourceRows: opened.rows, nextRow: done.next_row, totals: totalsOf(done), error: message };
  }
}
