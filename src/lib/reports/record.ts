import type { SupabaseClient } from '@supabase/supabase-js';
import { subaybayanDataset, type ProjectSource } from '@/lib/integrations/bettergov/sources';

/**
 * Looks a directory record up on the server, so a report stores the real title
 * and key fields rather than whatever the browser sent. The directory tables
 * are public-read, so the caller's own session is enough.
 */

export type SnapshotValue = string | number | null;

export interface ReportableRecord {
  title: string;
  /** Key fields as they were when the report was filed (the data is re-imported over time). */
  snapshot: Record<string, SnapshotValue>;
}

function primitive(value: unknown): SnapshotValue {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return value === null || value === undefined ? null : String(value);
}

function build(title: string, source: ProjectSource, fields: Record<string, unknown>, now: Date): ReportableRecord {
  const snapshot: Record<string, SnapshotValue> = { source };
  for (const [key, value] of Object.entries(fields)) snapshot[key] = primitive(value);
  snapshot.captured_at = now.toISOString();
  return { title: title.slice(0, 500), snapshot };
}

/** The record, or null when no such record exists. Throws on a database error. */
export async function loadReportableRecord(
  supabase: SupabaseClient,
  source: ProjectSource,
  recordId: string,
  now: Date = new Date()
): Promise<ReportableRecord | null> {
  if (source === 'dpwh_contracts') {
    const { data, error } = await supabase
      .from('dpwh_contracts')
      .select('contract_id, title, status, contract_amount, progress, province, region')
      .eq('contract_id', recordId)
      .maybeSingle();
    if (error) throw error;
    return data ? build(data.title, source, data, now) : null;
  }

  const dataset = subaybayanDataset(source);
  if (dataset) {
    const { data, error } = await supabase
      .from('subaybayan_projects')
      .select('id, source_dataset, project_code, title, status, total_cost, owpa, province, citymun')
      .eq('id', recordId)
      .maybeSingle();
    if (error) throw error;
    // The URL's dataset must match the record, as the detail page does.
    if (!data || data.source_dataset !== dataset) return null;
    const { source_dataset: _dataset, ...fields } = data;
    return build(data.title, source, fields, now);
  }

  const { data, error } = await supabase
    .from('infrastructure_projects')
    .select('source_id, title, status, amount, amount_label, fiscal_year, province, municipality')
    .eq('source', source)
    .eq('source_id', recordId)
    .maybeSingle();
  if (error) throw error;
  return data ? build(data.title, source, data, now) : null;
}
