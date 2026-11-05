'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { REPORT_HANDLER_ROLES } from '@/lib/auth/roles';
import { REVIEW_NOTE_MAX, isReportStatus } from '@/lib/reports/workflow';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ActionResult, UUID_PATTERN, toActionError } from './shared';

/**
 * Moves a report to a new status, with an optional message for the person who
 * sent it. The database decides who may do this (private.can_handle_report) and
 * records the step in the report's timeline and in the sender's inbox, so this
 * only validates the input and reports whether the update was allowed.
 */
export async function updateReportStatus(reportId: string, status: string, note: string): Promise<ActionResult> {
  try {
    await requireRole(...REPORT_HANDLER_ROLES);
    if (!UUID_PATTERN.test(reportId)) return { ok: false, error: 'That report does not exist.' };
    if (!isReportStatus(status)) return { ok: false, error: 'Choose a status.' };

    const message = typeof note === 'string' ? note.trim() : '';
    if (message.length > REVIEW_NOTE_MAX) {
      return { ok: false, error: `Keep the message under ${REVIEW_NOTE_MAX} characters.` };
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Reviewing is not available right now.' };

    const patch: { status: string; resolution_notes?: string } = { status };
    if (message) patch.resolution_notes = message;

    const { data, error } = await supabase.from('reports').update(patch).eq('id', reportId).select('id');
    if (error) return toActionError(error);
    if (!data || data.length === 0) {
      return { ok: false, error: 'You cannot review this report. It may be assigned to another office.' };
    }

    revalidatePath('/reports');
    revalidatePath(`/reports/${reportId}`);
    revalidatePath('/my-reports');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
