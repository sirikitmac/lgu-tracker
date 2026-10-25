import type { InfrastructureProjectRecord } from '@/types/infrastructureProject';
import type { HubSnapshot } from './hub';

/**
 * Idempotent import of one BetterGov.ph dataset into
 * public.infrastructure_projects, through the source_sync_* functions.
 * Small sources only: the whole file is read and applied in one invocation.
 * Upserts on (source, source_id); nothing is deleted, so a failed run leaves
 * earlier records in place. Every attempt is logged in source_sync_runs.
 */

export type SourceSyncTrigger = 'cron' | 'manual' | 'cli';

export interface SourceSyncRun {
  id: string;
  status: 'running' | 'succeeded' | 'failed' | 'no_new_snapshot';
  source_revision: string | null;
  source_rows: number | null;
  processed_rows: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  rejected_count: number;
}

export interface SourceMeta {
  source_dataset: string;
  source_file: string;
  source_revision: string;
  source_snapshot_at: string;
  source_rows: number;
}

export interface SourceRejectedRow {
  row: number;
  source_id: string | null;
  reason: string;
}

export interface SourceSyncStore {
  lastSuccess(source: string): Promise<SourceSyncRun | null>;
  begin(source: string, trigger: SourceSyncTrigger, meta: SourceMeta): Promise<SourceSyncRun>;
  applyBatch(runId: string, rowsSeen: number, records: InfrastructureProjectRecord[], rejected: SourceRejectedRow[]):
    Promise<{ inserted: number; updated: number; unchanged: number; rejected: number }>;
  finish(runId: string, status: 'succeeded' | 'failed' | 'no_new_snapshot', error: string | null): Promise<SourceSyncRun>;
  logFailure(source: string, trigger: SourceSyncTrigger, error: string, meta: Partial<SourceMeta> | null): Promise<SourceSyncRun>;
}

export type NormalizeResult =
  | { ok: true; record: InfrastructureProjectRecord }
  | { ok: false; sourceId: string | null; reason: string };

export interface SourceAdapter {
  source: string;
  resolveSnapshot(): Promise<HubSnapshot>;
  /** All rows of the snapshot, in file order. */
  readRows(snapshot: HubSnapshot): Promise<Record<string, string>[]>;
  normalize(row: Record<string, string>): NormalizeResult;
}

export interface SourceSyncOptions {
  store: SourceSyncStore;
  adapter: SourceAdapter;
  trigger: SourceSyncTrigger;
  force?: boolean;
  batchSize?: number;
  minRows?: number;
  minRowsRatio?: number;
  maxRejectRate?: number;
  log?: (message: string) => void;
}

export interface SourceSyncOutcome {
  source: string;
  status: 'succeeded' | 'failed' | 'no_new_snapshot';
  runId: string | null;
  revision: string | null;
  sourceRows: number | null;
  totals: { inserted: number; updated: number; unchanged: number; rejected: number };
  error?: string;
}

export async function runSourceSync(options: SourceSyncOptions): Promise<SourceSyncOutcome> {
  const { store, adapter, trigger, batchSize = 1000, minRows = 100, minRowsRatio = 0.9, maxRejectRate = 0.02, log = () => {} } = options;
  const totals = { inserted: 0, updated: 0, unchanged: 0, rejected: 0 };
  const fail = (error: string, meta: Partial<SourceMeta> | null, revision: string | null, sourceRows: number | null) =>
    store.logFailure(adapter.source, trigger, error, meta).catch(() => null).then((run) => ({
      source: adapter.source, status: 'failed' as const, runId: run?.id ?? null, revision, sourceRows, totals, error,
    }));

  // 1. Identify and read the snapshot. Failures here never touch records.
  let snapshot: HubSnapshot;
  let rows: Record<string, string>[];
  try {
    snapshot = await adapter.resolveSnapshot();
    log(`${adapter.source}: snapshot ${snapshot.revision} (${snapshot.committedAt})`);
  } catch (error) {
    return fail(`Source unavailable: ${(error as Error).message}`, null, null, null);
  }
  const partial = {
    source_dataset: snapshot.dataset, source_file: snapshot.file,
    source_revision: snapshot.revision, source_snapshot_at: snapshot.committedAt,
  };
  try {
    rows = await adapter.readRows(snapshot);
  } catch (error) {
    return fail((error as Error).message, partial, snapshot.revision, null);
  }
  const meta: SourceMeta = { ...partial, source_rows: rows.length };
  log(`${adapter.source}: ${rows.length.toLocaleString('en-US')} rows`);

  // 2. Refuse incomplete snapshots; skip a snapshot that already succeeded.
  const last = await store.lastSuccess(adapter.source);
  const floor = Math.max(minRows, Math.ceil((last?.source_rows ?? 0) * minRowsRatio));
  if (rows.length < floor) {
    return fail(`Snapshot looks incomplete: ${rows.length} rows, expected at least ${floor}.`, meta, snapshot.revision, rows.length);
  }
  if (!options.force && last?.source_revision === snapshot.revision) {
    const run = await store.begin(adapter.source, trigger, meta);
    await store.finish(run.id, 'no_new_snapshot', null);
    log(`${adapter.source}: no new snapshot since the last successful import.`);
    return { source: adapter.source, status: 'no_new_snapshot', runId: run.id, revision: snapshot.revision, sourceRows: rows.length, totals };
  }

  // 3. Apply in batches. Duplicate IDs keep their first occurrence.
  const run = await store.begin(adapter.source, trigger, meta);
  log(`${adapter.source}: run ${run.id} started`);
  try {
    const seen = new Set<string>();
    for (let a = 0; a < rows.length; a += batchSize) {
      const b = Math.min(a + batchSize, rows.length);
      const records: InfrastructureProjectRecord[] = [];
      const rejected: SourceRejectedRow[] = [];
      for (let i = a; i < b; i++) {
        const result = adapter.normalize(rows[i]);
        if (!result.ok) rejected.push({ row: i, source_id: result.sourceId, reason: result.reason });
        else if (seen.has(result.record.source_id)) {
          rejected.push({ row: i, source_id: result.record.source_id, reason: 'Duplicate ID in snapshot; first occurrence kept.' });
        } else {
          seen.add(result.record.source_id);
          records.push(result.record);
        }
      }
      const r = await store.applyBatch(run.id, b - a, records, rejected);
      totals.inserted += r.inserted;
      totals.updated += r.updated;
      totals.unchanged += r.unchanged;
      totals.rejected += r.rejected;
      log(`${adapter.source}: rows ${b}/${rows.length} (+${totals.inserted} ins, ${totals.updated} upd, ${totals.unchanged} same, ${totals.rejected} rej)`);
    }
    if (totals.rejected / rows.length > maxRejectRate) {
      const error = `${totals.rejected} rows rejected (over the ${maxRejectRate * 100}% limit).`;
      await store.finish(run.id, 'failed', error);
      return { source: adapter.source, status: 'failed', runId: run.id, revision: snapshot.revision, sourceRows: rows.length, totals, error };
    }
    await store.finish(run.id, 'succeeded', null);
    return { source: adapter.source, status: 'succeeded', runId: run.id, revision: snapshot.revision, sourceRows: rows.length, totals };
  } catch (error) {
    const message = (error as Error).message;
    log(`${adapter.source}: run failed: ${message}`);
    await store.finish(run.id, 'failed', message).catch(() => undefined);
    return { source: adapter.source, status: 'failed', runId: run.id, revision: snapshot.revision, sourceRows: rows.length, totals, error: message };
  }
}
