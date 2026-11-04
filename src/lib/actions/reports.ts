'use server';

import { requireRole } from '@/lib/auth/authorize';
import { findReportTargets } from '@/lib/reports/lookup';
import { loadReportableRecord } from '@/lib/reports/record';
import { validateRecordReport, type RecordReportInput } from '@/lib/reports/validate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { reportCategoryLabel, type ReportTarget } from '@/types/report';
import { type ActionResult, toActionError } from './shared';

/**
 * Files a report about a project in the directory (DPWH contract, NEP
 * proposal, or DILG project).
 *
 * Only a signed-in, active account can do this: requireRole() with no roles
 * accepts any role but rejects visitors and deactivated accounts. The database
 * enforces the same thing again (the "reports: signed-in users submit" policy,
 * and anon has no INSERT privilege), so this check is the friendly early one.
 *
 * The record's title and key fields are looked up here, never taken from the
 * browser. Every report starts private: only the submitter and LGU staff can
 * read it until staff publish it.
 */
export async function submitRecordReport(
  input: RecordReportInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole();

    const parsed = validateRecordReport(input ?? {});
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    const report = parsed.value;

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return { ok: false, error: 'Reporting is not available right now.' };
    }

    const record = await loadReportableRecord(supabase, report.source, report.recordId);
    if (!record) {
      return { ok: false, error: 'That project could not be found. It may have been removed in a data update.' };
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        report_type: 'citizen_concern',
        report_category: report.category,
        title: `${reportCategoryLabel(report.category)}: ${record.title}`.slice(0, 300),
        body: report.details,
        record_source: report.source,
        record_id: report.recordId,
        record_title: record.title,
        record_snapshot: record.snapshot,
        observed_on: report.observedOn,
        location_note: report.locationNote,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '53400') {
        return { ok: false, error: 'You have reached the limit of 10 reports in 24 hours. Please try again tomorrow.' };
      }
      if (error.code === '22023') {
        return { ok: false, error: 'The date you saw this cannot be in the future.' };
      }
      return toActionError(error);
    }

    return { ok: true, data: { id: data.id as string } };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Finds the project that goes with a typed project code, for the report form.
 * The directory is public, so this needs no account; the report itself does.
 */
export async function lookupProjectByCode(code: unknown): Promise<ActionResult<{ matches: ReportTarget[] }>> {
  try {
    if (typeof code !== 'string' || code.length > 200) {
      return { ok: false, error: 'Enter the project code first.' };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return { ok: false, error: 'Project lookup is not available right now.' };
    }
    const result = await findReportTargets(supabase, code);
    return result.ok ? { ok: true, data: { matches: result.matches } } : result;
  } catch (error) {
    return toActionError(error);
  }
}
