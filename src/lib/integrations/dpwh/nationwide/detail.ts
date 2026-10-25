import type { SupabaseClient } from '@supabase/supabase-js';
import type { DpwhContract, DpwhReview } from '@/types/dpwh';
import { betterGovRecordUrl, snapshotFileUrl } from './source';

export const CONTRACT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,49}$/;

export interface DpwhContractDetail {
  contract: DpwhContract;
  /** Absent for non-staff (RLS) and for contracts nobody has reviewed yet. */
  review: DpwhReview | null;
  lastSuccessfulSyncAt: string | null;
}

export type DpwhContractDetailResult =
  | { status: 'ok'; detail: DpwhContractDetail }
  | { status: 'invalid' | 'not_found' | 'error' };

/**
 * Every stored field of one contract, the LGU review (only visible to staff
 * through RLS), and when the directory last synced successfully. Runs with
 * the caller's client, so RLS decides what is visible.
 */
export async function loadDpwhContractDetail(supabase: SupabaseClient, contractId: string): Promise<DpwhContractDetailResult> {
  if (!CONTRACT_ID_PATTERN.test(contractId)) return { status: 'invalid' };

  const [contract, review, stats] = await Promise.all([
    supabase.from('dpwh_contracts').select('*').eq('contract_id', contractId).maybeSingle(),
    supabase.from('dpwh_contract_reviews')
      .select('is_field_verified, verified_at, verification_notes, linked_project_id, updated_at')
      .eq('contract_id', contractId).maybeSingle(),
    supabase.from('dpwh_directory_stats').select('last_successful_sync_at').eq('id', 1).maybeSingle(),
  ]);
  if (contract.error) {
    console.error('[LGU Tracker] DPWH contract query failed:', contract.error);
    return { status: 'error' };
  }
  if (!contract.data) return { status: 'not_found' };

  const row = contract.data as Omit<DpwhContract, 'source_file_url' | 'bettergov_record_url'>;
  return {
    status: 'ok',
    detail: {
      contract: {
        ...row,
        source_file_url: snapshotFileUrl(row.source_revision),
        bettergov_record_url: betterGovRecordUrl(row.contract_id),
      },
      review: review.error ? null : (review.data as DpwhReview | null),
      lastSuccessfulSyncAt: stats.data?.last_successful_sync_at ?? null,
    },
  };
}
