'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { assignableRoles } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ADMIN_ROLES, type AppRole } from '@/types/auth';
import { type ActionResult, UUID_PATTERN, toActionError } from './shared';

const ALL_ROLES: readonly AppRole[] = [
  'super_admin', 'lgu_admin', 'planning_officer', 'budget_officer', 'bac_member',
  'project_engineer', 'council_member', 'contractor', 'citizen',
];

/**
 * Gives someone a role (which also closes their role request), or declines the
 * request and leaves them as they are. The database is the real gate: only
 * administrators can change a role, only a super administrator can grant or
 * touch an administrator, and nobody can change their own. The checks here
 * make the answer friendly.
 */
export async function decideRole(userId: string, decision: 'approve' | 'decline', role?: string): Promise<ActionResult> {
  try {
    const actor = await requireRole(...ADMIN_ROLES);
    if (!UUID_PATTERN.test(userId)) return { ok: false, error: 'That account does not exist.' };
    if (userId === actor.id) return { ok: false, error: 'You cannot change your own role.' };

    // Declining leaves them a citizen and closes the request (account_type back to citizen).
    const patch: { role?: AppRole; requested_role: null; account_type?: 'citizen' } =
      decision === 'decline' ? { requested_role: null, account_type: 'citizen' } : { requested_role: null };
    if (decision === 'approve') {
      const next = ALL_ROLES.find((r) => r === role);
      if (!next) return { ok: false, error: 'Choose a role.' };
      if (!assignableRoles(actor.role).includes(next)) {
        return { ok: false, error: 'Only a Super Administrator can make someone an administrator.' };
      }
      patch.role = next;
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Roles are not available right now.' };

    const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
    if (error) return toActionError(error);
    if (!data || data.length === 0) return { ok: false, error: 'That account could not be updated.' };

    revalidatePath('/users');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
