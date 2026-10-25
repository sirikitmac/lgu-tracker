import type { SupabaseClient } from '@supabase/supabase-js';
import type { DpwhContractRecord } from '@/types/dpwh';
import {
  SyncBusyError,
  type BatchResult,
  type DpwhSyncStore,
  type RejectedRow,
  type SourceInfo,
  type SyncRun,
  type SyncTrigger,
} from './sync';

/**
 * DpwhSyncStore backed by the dpwh_sync_* database functions. The client
 * must act as the service role (cron) or a signed-in administrator (CLI);
 * the functions refuse everyone else.
 */

const RUN_COLUMNS =
  'id, status, source_revision, source_rows, next_row, inserted_count, updated_count, unchanged_count, rejected_count, heartbeat_at';

interface PgError {
  message: string;
  code?: string;
}

function fail(operation: string, error: PgError): never {
  if (error.code === '55P03') throw new SyncBusyError(error.message);
  throw new Error(`${operation} failed: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

export function supabaseSyncStore(client: SupabaseClient): DpwhSyncStore {
  return {
    async state() {
      const [success, running] = await Promise.all([
        client.from('dpwh_sync_runs').select(RUN_COLUMNS).eq('status', 'succeeded')
          .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
        client.from('dpwh_sync_runs').select(RUN_COLUMNS).eq('status', 'running').maybeSingle(),
      ]);
      if (success.error) fail('Reading last successful sync', success.error);
      if (running.error) fail('Reading running sync', running.error);
      return { lastSuccess: success.data as SyncRun | null, running: running.data as SyncRun | null };
    },

    async begin(trigger: SyncTrigger, source: SourceInfo, resumeRunId: string | null) {
      const { data, error } = await client.rpc('dpwh_sync_begin', {
        p_trigger: trigger,
        p_source: source,
        p_resume_run_id: resumeRunId,
      });
      if (error) fail('Starting sync', error);
      return data as SyncRun;
    },

    async applyBatch(runId: string, rowStart: number, rowEnd: number, contracts: DpwhContractRecord[], rejected: RejectedRow[]) {
      const { data, error } = await client.rpc('dpwh_sync_apply_batch', {
        p_run_id: runId,
        p_row_start: rowStart,
        p_row_end: rowEnd,
        p_contracts: contracts,
        p_rejected: rejected,
      });
      if (error) fail(`Applying rows ${rowStart}-${rowEnd}`, error);
      return data as BatchResult;
    },

    async finish(runId: string, status, error: string | null) {
      const { data, error: rpcError } = await client.rpc('dpwh_sync_finish', {
        p_run_id: runId,
        p_status: status,
        p_error: error,
      });
      if (rpcError) fail('Finishing sync', rpcError);
      return data as SyncRun;
    },

    async logFailure(trigger: SyncTrigger, error: string, source: Partial<SourceInfo> | null) {
      const { data, error: rpcError } = await client.rpc('dpwh_sync_log_failure', {
        p_trigger: trigger,
        p_error: error,
        p_source: source,
      });
      if (rpcError) fail('Recording sync failure', rpcError);
      return data as SyncRun;
    },
  };
}
