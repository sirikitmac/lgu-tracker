import type { SupabaseClient } from '@supabase/supabase-js';
import { isProjectSource, type ProjectSource } from '@/lib/integrations/bettergov/sources';
import { normalizeCode } from '@/lib/subaybayan/code';
import type { ReportableRecord } from '@/lib/reports/record';
import type { ReportTarget } from '@/types/report';

/**
 * Finds the project a reporter means from the code they type.
 *
 * "Project code" is what the directory shows under each title: the DPWH
 * contract id, the DILG SubayBAYAN project code (or its id when it has none),
 * or the NEP proposal id. The directory is public, so the caller's own session
 * is enough, and nothing here needs an account.
 */

/** Letters, digits, dot, dash and underscore only, like the record ids the detail pages accept. */
const CODE_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const MAX_MATCHES = 6;

export type CodeLookup = { ok: true; matches: ReportTarget[] } | { ok: false; error: string };

/** The code to show for a record, from what the report snapshot keeps. */
export function targetFromRecord(source: ProjectSource, recordId: string, record: ReportableRecord): ReportTarget {
  const s = record.snapshot;
  const code = [s.project_code, s.contract_id, s.source_id].find((v) => typeof v === 'string' && v) ?? recordId;
  return { source, recordId, title: record.title, code: String(code) };
}

export async function findReportTargets(supabase: SupabaseClient, raw: string): Promise<CodeLookup> {
  const typed = normalizeCode(raw);
  if (!typed) return { ok: false, error: 'Enter the project code first.' };
  if (!CODE_SHAPE.test(typed)) {
    return {
      ok: false,
      error: 'A project code has only letters, numbers and dashes, for example LIME-25-13-02-00-000-41.',
    };
  }

  // Contract ids are stored as published, so try the upper-case form and what was typed.
  const spellings = [...new Set([typed, raw.trim()])].filter((v) => CODE_SHAPE.test(v));
  const list = spellings.join(',');

  const { data, error } = await supabase
    .from('project_directory')
    .select('source, record_id, title, project_code')
    .or(`record_id.in.(${list}),project_code.in.(${list})`)
    .limit(MAX_MATCHES);
  if (error) throw error;

  const matches: ReportTarget[] = [];
  for (const row of data ?? []) {
    if (!isProjectSource(row.source) || typeof row.record_id !== 'string') continue;
    matches.push({
      source: row.source,
      recordId: row.record_id,
      title: String(row.title ?? row.record_id).slice(0, 500),
      code: row.project_code || row.record_id,
    });
  }
  return { ok: true, matches };
}
