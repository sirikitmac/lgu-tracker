import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimelineEvent } from '@/components/reports/ReportTimeline';
import { isReportStatus, type ReportStatus } from '@/lib/reports/workflow';
import { isReportCategory, type ReportCategory } from '@/types/report';

export interface ReportRow {
  id: string;
  refNo: number;
  title: string;
  status: ReportStatus;
  category: ReportCategory | null;
  recordTitle: string | null;
  recordSource: string | null;
  recordId: string | null;
  createdAt: string;
  submittedBy: string;
}

export const REPORT_LIST_COLUMNS = 'id, ref_no, title, status, report_category, record_title, record_source, record_id, created_at, submitted_by';

export function toReportRow(row: Record<string, unknown>): ReportRow | null {
  if (!isReportStatus(row.status)) return null;
  return {
    id: row.id as string,
    refNo: Number(row.ref_no),
    title: row.title as string,
    status: row.status,
    category: isReportCategory(row.report_category) ? row.report_category : null,
    recordTitle: (row.record_title as string | null) ?? null,
    recordSource: (row.record_source as string | null) ?? null,
    recordId: (row.record_id as string | null) ?? null,
    createdAt: row.created_at as string,
    submittedBy: row.submitted_by as string,
  };
}

/** Names for a set of accounts; people the caller may not read come back missing. */
export async function loadNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return names;
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  for (const row of data ?? []) {
    const name = (row.full_name as string | null)?.trim();
    if (name) names.set(row.id as string, name);
  }
  return names;
}

/** The timeline of one report. `viewer` words each actor for the reader. */
export async function loadTimeline(
  supabase: SupabaseClient,
  reportId: string,
  viewer: { id: string; showNames: boolean }
): Promise<TimelineEvent[]> {
  const { data } = await supabase
    .from('report_events')
    .select('id, actor_id, kind, to_status, note, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  const rows = data ?? [];
  const names = viewer.showNames ? await loadNames(supabase, rows.map((r) => r.actor_id as string)) : new Map<string, string>();

  return rows.flatMap((row) => {
    if (!isReportStatus(row.to_status) || (row.kind !== 'submitted' && row.kind !== 'status_changed')) return [];
    const actorId = row.actor_id as string | null;
    const actor =
      actorId === viewer.id ? 'You' : actorId && names.get(actorId) ? names.get(actorId)! : row.kind === 'submitted' ? 'The reporter' : 'LGU staff';
    return [
      {
        id: row.id as string,
        kind: row.kind,
        toStatus: row.to_status,
        note: (row.note as string | null) ?? null,
        createdAt: row.created_at as string,
        actor,
      },
    ];
  });
}

export interface ReportPhoto {
  id: string;
  fileName: string;
  /** Short-lived signed link: the bucket is private. */
  url: string;
}

/** The photos on a report, with signed links that expire after 10 minutes. Whoever the database lets read them. */
export async function loadReportPhotos(supabase: SupabaseClient, reportId: string): Promise<ReportPhoto[]> {
  const { data: rows } = await supabase
    .from('attachments')
    .select('id, file_name, storage_path')
    .eq('report_id', reportId)
    .eq('purpose', 'concern_evidence')
    .order('created_at', { ascending: true });
  if (!rows?.length) return [];
  const { data: signed } = await supabase.storage.from('report-photos').createSignedUrls(
    rows.map((r) => r.storage_path as string),
    600,
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.flatMap((r) => {
    const url = urls.get(r.storage_path as string);
    return url ? [{ id: r.id as string, fileName: r.file_name as string, url }] : [];
  });
}
