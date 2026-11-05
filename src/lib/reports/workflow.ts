/** Mirrors the public.report_status enum in supabase/migrations. */
export type ReportStatus = 'submitted' | 'acknowledged' | 'in_review' | 'resolved' | 'dismissed';

export const REPORT_STATUSES: readonly ReportStatus[] = ['submitted', 'acknowledged', 'in_review', 'resolved', 'dismissed'];

export function isReportStatus(value: unknown): value is ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus);
}

/** What the person who sent the report sees, and what staff see, are the same words. */
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  submitted: 'Sent',
  acknowledged: 'Received',
  in_review: 'In review',
  resolved: 'Resolved',
  dismissed: 'Closed',
};

/** One line on what a status means to the person who sent the report. */
export const REPORT_STATUS_MEANING: Record<ReportStatus, string> = {
  submitted: 'Waiting for LGU staff to open it.',
  acknowledged: 'Staff have seen your report.',
  in_review: 'Staff are checking the project.',
  resolved: 'The concern was handled.',
  dismissed: 'Staff closed it without further action.',
};

export const isFinalStatus = (status: ReportStatus) => status === 'resolved' || status === 'dismissed';

/** RPT-00042: the short number people can quote. */
export function reportRef(refNo: number | string | null | undefined): string {
  const n = Number(refNo);
  return Number.isFinite(n) && n > 0 ? `RPT-${String(Math.trunc(n)).padStart(5, '0')}` : 'RPT-?';
}

/** Where a directory record lives in the app. */
export function recordHref(source: string | null | undefined, recordId: string | null | undefined): string | null {
  if (!source || !recordId) return null;
  return source === 'dpwh_contracts'
    ? `/projects/${encodeURIComponent(recordId)}`
    : `/projects/source/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`;
}

/** Longest handler note the timeline stores. */
export const REVIEW_NOTE_MAX = 1000;
