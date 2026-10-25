'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toDbProjectStatus } from '@/lib/supabase/projectMapper';
import type { LifecycleStageId, ProjectStatus } from '@/types/project';
import { type ActionResult, UUID_PATTERN, cleanText, toActionError } from './shared';

/**
 * Server Actions are public HTTP endpoints: every argument is untrusted and
 * validated here, and every action checks the caller's role before touching
 * the database. RLS and guard triggers enforce the same rules again.
 */

const LIFECYCLE_STAGES: readonly LifecycleStageId[] = [
  'planning',
  'procurement',
  'implementation',
  'completion',
];

export interface ChangeProjectStatusInput {
  projectId: string;
  status: ProjectStatus;
  lifecycleStage?: LifecycleStageId;
  note?: string;
}

/**
 * Changes a project's status (and optionally lifecycle stage). The database
 * records the change in project_status_history with the note. Engineers can
 * only change projects they are assigned to; that check happens in RLS.
 */
export async function changeProjectStatus(
  input: ChangeProjectStatusInput
): Promise<ActionResult> {
  try {
    await requireRole('super_admin', 'lgu_admin', 'planning_officer', 'bac_member', 'project_engineer');

    const dbStatus = toDbProjectStatus(input?.status);
    if (typeof input?.projectId !== 'string' || !UUID_PATTERN.test(input.projectId)) {
      return { ok: false, error: 'Invalid project id.' };
    }
    if (!dbStatus) {
      return { ok: false, error: 'Invalid project status.' };
    }
    if (input.lifecycleStage !== undefined && !LIFECYCLE_STAGES.includes(input.lifecycleStage)) {
      return { ok: false, error: 'Invalid lifecycle stage.' };
    }
    const note = input.note === undefined || input.note === '' ? null : cleanText(input.note, 2000);
    if (input.note && note === null) {
      return { ok: false, error: 'Note must be 2,000 characters or fewer.' };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase!.rpc('change_project_status', {
      p_project_id: input.projectId,
      p_status: dbStatus,
      p_stage: input.lifecycleStage ?? null,
      p_note: note,
    });
    if (error) {
      return toActionError(error);
    }

    revalidatePath('/dashboard', 'layout');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export interface SubmitConcernInput {
  title: string;
  body: string;
  projectId?: string;
  barangay?: string;
}

/**
 * Lets any signed-in user submit a citizen concern. It stays private to the
 * submitter and LGU staff until staff publish it (enforced in the database).
 */
export async function submitConcern(
  input: SubmitConcernInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole();

    const title = cleanText(input?.title, 300);
    const body = cleanText(input?.body, 10000);
    if (!title || title.length < 3) {
      return { ok: false, error: 'Please enter a title of 3 to 300 characters.' };
    }
    if (!body) {
      return { ok: false, error: 'Please describe the concern (up to 10,000 characters).' };
    }
    if (input.projectId !== undefined && (typeof input.projectId !== 'string' || !UUID_PATTERN.test(input.projectId))) {
      return { ok: false, error: 'Invalid project id.' };
    }
    const barangay = input.barangay === undefined ? null : cleanText(input.barangay, 200);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase!
      .from('reports')
      .insert({
        report_type: 'citizen_concern',
        title,
        body,
        project_id: input.projectId ?? null,
        barangay,
      })
      .select('id')
      .single();
    if (error) {
      return toActionError(error);
    }

    return { ok: true, data: { id: data.id as string } };
  } catch (error) {
    return toActionError(error);
  }
}
