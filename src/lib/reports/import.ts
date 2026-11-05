import { isReportStatus, type ReportStatus } from '@/lib/reports/workflow';
import { validateRecordReport, type ValidRecordReport } from '@/lib/reports/validate';

/**
 * Reading a file of sample reports (the "mock reports" used to try the inbox
 * and the report queue). Pure: no database, no network. The script in
 * scripts/reports-import.ts does the inserting.
 *
 * Each report is checked with the same rules as the report form, so anything
 * that imports could also have been sent through the app.
 */

export interface MockReport extends ValidRecordReport {
  /** An account's e-mail address or its id (uuid). */
  submitter: string;
  status: ReportStatus;
  /** The handler's message for resolved or closed reports. */
  note: string | null;
  /** When it was sent (ISO). Defaults to now. */
  createdAt: string | null;
}

export type ParsedMockReports =
  | { ok: true; reports: MockReport[] }
  | { ok: false; errors: string[] };

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export function parseMockReports(input: unknown, now: Date = new Date()): ParsedMockReports {
  const list = Array.isArray(input) ? input : isObject(input) && Array.isArray(input.reports) ? input.reports : null;
  if (!list) return { ok: false, errors: ['The file must be a JSON array of reports (or an object with a "reports" array).'] };
  if (list.length === 0) return { ok: false, errors: ['The file has no reports.'] };
  if (list.length > 500) return { ok: false, errors: ['Import at most 500 reports at a time.'] };

  const errors: string[] = [];
  const reports: MockReport[] = [];

  list.forEach((raw, index) => {
    const at = `Report ${index + 1}`;
    if (!isObject(raw)) return void errors.push(`${at}: must be an object.`);

    const submitter = typeof raw.submitter === 'string' ? raw.submitter.trim() : '';
    if (!submitter) return void errors.push(`${at}: "submitter" (an e-mail or account id) is required.`);

    const parsed = validateRecordReport(
      {
        source: raw.source,
        recordId: raw.record_id,
        category: raw.category,
        details: raw.details,
        observedOn: raw.observed_on,
        locationNote: raw.location_note,
      },
      now
    );
    if (!parsed.ok) return void errors.push(`${at}: ${parsed.error}`);

    const status = raw.status === undefined ? 'submitted' : raw.status;
    if (!isReportStatus(status)) {
      return void errors.push(`${at}: "status" must be one of submitted, acknowledged, in_review, resolved, dismissed.`);
    }

    const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : null;
    if (note && note.length > 1000) return void errors.push(`${at}: "note" must be 1000 characters or fewer.`);

    let createdAt: string | null = null;
    if (raw.created_at !== undefined && raw.created_at !== null && raw.created_at !== '') {
      const text = String(raw.created_at);
      const time = Date.parse(text);
      if (!ISO_DATETIME.test(text) || Number.isNaN(time) || time > now.getTime() + 60_000) {
        return void errors.push(`${at}: "created_at" must be a date or date-time in the past, like 2026-11-02 or 2026-11-02T09:30:00+08:00.`);
      }
      createdAt = new Date(time).toISOString();
    }

    reports.push({ ...parsed.value, submitter, status, note, createdAt });
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, reports };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
