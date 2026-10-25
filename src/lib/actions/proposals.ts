'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ActionResult, UUID_PATTERN, cleanText, toActionError } from './shared';

/**
 * Proposal decisions. The database is the authority: it checks that the
 * caller is an authorized Development Council member (or an administrator for
 * an override), blocks decisions on one's own proposal, and makes the first
 * decision on an open proposal decisive (private.apply_proposal_decision).
 */

export type ProposalDecision = 'approved' | 'rejected';

export interface RecordProposalDecisionInput {
  proposalId: string;
  decision: ProposalDecision;
  reason: string;
  /** Administrative override; LGU administrators only. */
  override?: boolean;
}

const DECISIONS: readonly ProposalDecision[] = ['approved', 'rejected'];

/**
 * Records a formal approval or rejection. Returns whether it was decisive:
 * a later decision on an already-decided proposal is stored for the record
 * but does not change the outcome (unless it is an administrator override).
 */
export async function recordProposalDecision(
  input: RecordProposalDecisionInput
): Promise<ActionResult<{ id: string; isDecisive: boolean }>> {
  try {
    const override = input?.override === true;
    if (override) {
      await requireRole('super_admin', 'lgu_admin');
    } else {
      await requireRole('council_member');
    }

    if (typeof input?.proposalId !== 'string' || !UUID_PATTERN.test(input.proposalId)) {
      return { ok: false, error: 'Invalid proposal id.' };
    }
    if (!DECISIONS.includes(input.decision)) {
      return { ok: false, error: 'Decision must be approved or rejected.' };
    }
    const reason = cleanText(input.reason, 5000);
    if (!reason || reason.length < 5) {
      return { ok: false, error: 'Please give a reason of 5 to 5,000 characters.' };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase!
      .from('proposal_decisions')
      .insert({
        proposal_id: input.proposalId,
        decision: input.decision,
        reason,
        is_override: override,
      })
      .select('id, is_decisive')
      .single();
    if (error) {
      if (error.code === '55000') {
        return { ok: false, error: 'This proposal is not open for a decision.' };
      }
      return toActionError(error);
    }

    revalidatePath('/dashboard', 'layout');
    return { ok: true, data: { id: data.id as string, isDecisive: data.is_decisive as boolean } };
  } catch (error) {
    return toActionError(error);
  }
}
