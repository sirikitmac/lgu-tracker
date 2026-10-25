import type { SupabaseClient } from '@supabase/supabase-js';
import type { SourceSyncRun, SourceSyncStore } from './sync';

/**
 * SourceSyncStore backed by the source_sync_* database functions. The client
 * must act as the service role (cron) or a signed-in administrator (CLI).
 */

const RUN_COLUMNS =
  'id, status, source_revision, source_rows, processed_rows, inserted_count, updated_count, unchanged_count, rejected_count';

function fail(operation: string, error: { message: string; code?: string }): never {
  throw new Error(`${operation} failed: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

export function supabaseSourceStore(client: SupabaseClient): SourceSyncStore {
  return {
    async lastSuccess(source) {
      const { data, error } = await client.from('source_sync_runs').select(RUN_COLUMNS)
        .eq('source', source).eq('status', 'succeeded').order('finished_at', { ascending: false }).limit(1).maybeSingle();
      if (error) fail('Reading last successful import', error);
      return data as SourceSyncRun | null;
    },
    async begin(source, trigger, meta) {
      const { data, error } = await client.rpc('source_sync_begin', { p_source: source, p_trigger: trigger, p_meta: meta });
      if (error) fail('Starting import', error);
      return data as SourceSyncRun;
    },
    async applyBatch(runId, rowsSeen, records, rejected) {
      const { data, error } = await client.rpc('source_sync_apply_batch', {
        p_run_id: runId, p_rows_seen: rowsSeen, p_records: records, p_rejected: rejected,
      });
      if (error) fail('Applying batch', error);
      return data as { inserted: number; updated: number; unchanged: number; rejected: number };
    },
    async finish(runId, status, error) {
      const { data, error: rpcError } = await client.rpc('source_sync_finish', { p_run_id: runId, p_status: status, p_error: error });
      if (rpcError) fail('Finishing import', rpcError);
      return data as SourceSyncRun;
    },
    async logFailure(source, trigger, error, meta) {
      const { data, error: rpcError } = await client.rpc('source_sync_log_failure', {
        p_source: source, p_trigger: trigger, p_error: error, p_meta: meta,
      });
      if (rpcError) fail('Recording import failure', rpcError);
      return data as SourceSyncRun;
    },
  };
}
