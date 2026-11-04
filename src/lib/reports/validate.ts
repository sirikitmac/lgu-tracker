import { isProjectSource, type ProjectSource } from '@/lib/integrations/bettergov/sources';
import { REPORT_LIMITS, isReportCategory, type ReportCategory } from '@/types/report';

/**
 * Validation for a report about a directory record. Pure and client-safe, so
 * the form and the Server Action apply exactly the same rules. The database
 * checks the same limits again (migration ..._directory_record_reports.sql).
 */

export interface RecordReportInput {
  source?: unknown;
  recordId?: unknown;
  category?: unknown;
  details?: unknown;
  observedOn?: unknown;
  locationNote?: unknown;
}

export interface ValidRecordReport {
  source: ProjectSource;
  recordId: string;
  category: ReportCategory;
  details: string;
  /** ISO date (YYYY-MM-DD) or null. */
  observedOn: string | null;
  locationNote: string | null;
}

export type RecordReportValidation =
  | { ok: true; value: ValidRecordReport }
  | { ok: false; error: string; field?: 'category' | 'details' | 'observedOn' | 'locationNote' };

// Same shapes the detail pages accept for each kind of record.
const DPWH_CONTRACT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{2,49}$/;
const OTHER_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_OBSERVED = Date.UTC(1990, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Trims, and removes NUL characters (Postgres cannot store them in text). */
function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim() : '';
}

export function validateRecordReport(input: RecordReportInput, now: Date = new Date()): RecordReportValidation {
  const source = typeof input.source === 'string' ? input.source : '';
  const recordId = typeof input.recordId === 'string' ? input.recordId : '';
  if (!isProjectSource(source)) {
    return { ok: false, error: 'This kind of record cannot be reported.' };
  }
  const idPattern = source === 'dpwh_contracts' ? DPWH_CONTRACT_ID : OTHER_RECORD_ID;
  if (!idPattern.test(recordId)) {
    return { ok: false, error: 'This project reference is not valid.' };
  }

  if (!isReportCategory(input.category)) {
    return { ok: false, error: 'Choose what kind of concern this is.', field: 'category' };
  }

  const details = clean(input.details).replace(/\r\n/g, '\n');
  if (details.length < REPORT_LIMITS.detailsMin) {
    return {
      ok: false,
      error: `Please describe the concern in at least ${REPORT_LIMITS.detailsMin} characters so it can be reviewed.`,
      field: 'details',
    };
  }
  if (details.length > REPORT_LIMITS.detailsMax) {
    return { ok: false, error: `Please keep the description to ${REPORT_LIMITS.detailsMax.toLocaleString('en-PH')} characters or fewer.`, field: 'details' };
  }

  let observedOn: string | null = null;
  const observedRaw = clean(input.observedOn);
  if (observedRaw) {
    const [y, m, d] = observedRaw.split('-').map(Number);
    const time = Date.UTC(y, (m || 1) - 1, d || 1);
    const roundTrips = ISO_DATE.test(observedRaw) && new Date(time).toISOString().slice(0, 10) === observedRaw;
    if (!roundTrips) {
      return { ok: false, error: 'Enter the date as day, month and year.', field: 'observedOn' };
    }
    // One day of slack so a reporter ahead of UTC can enter "today".
    if (time > now.getTime() + DAY_MS || time < EARLIEST_OBSERVED) {
      return { ok: false, error: 'The date you saw this cannot be in the future.', field: 'observedOn' };
    }
    observedOn = observedRaw;
  }

  const locationRaw = clean(input.locationNote);
  if (locationRaw.length > REPORT_LIMITS.locationNoteMax) {
    return { ok: false, error: `Keep the location note to ${REPORT_LIMITS.locationNoteMax} characters or fewer.`, field: 'locationNote' };
  }

  return {
    ok: true,
    value: {
      source,
      recordId,
      category: input.category,
      details,
      observedOn,
      locationNote: locationRaw || null,
    },
  };
}
