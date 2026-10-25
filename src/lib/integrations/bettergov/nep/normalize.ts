import { createHash } from 'node:crypto';
import { categorize } from '@/lib/integrations/dpwh/nationwide/categorize';
import type { InfrastructureProjectRecord } from '@/types/infrastructureProject';

/**
 * Normalizes one row of BetterGov.ph's dpwh-nep-projects-2027.csv (DPWH's
 * FY 2027 National Expenditure Program project list) into a
 * public.infrastructure_projects record. Pure: no I/O.
 *
 * - These are budget proposals, not contracts: status is always 'proposed'
 *   and the amount is the proposed appropriation.
 * - The source has no province, municipality, or coordinates; those stay
 *   null. `office` is the implementing DPWH office, not the location.
 * - Region abbreviations are mapped to the names the DPWH contract data
 *   uses, so one region filter covers both sources.
 * - The original row is kept unmodified in source_record.
 */

export const NEP_SOURCE = 'dpwh_nep_2027';
export const NEP_DATASET = 'bettergovph/dpwh-nep-2027';
export const NEP_FILE = 'dpwh-nep-projects-2027.csv';

export const NEP_COLUMNS = [
  'code', 'fiscal_year', 'region', 'office', 'project_name', 'program', 'sub_program', 'project_type',
  'amount_php_thousands', 'amount_php', 'document_count', 'document_types',
] as const;

const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;

/** NEP region labels -> DPWH contract region names (see dpwh scope.ts). */
const REGION_NAMES: Record<string, string> = {
  NCR: 'National Capital Region',
  CAR: 'Cordillera Administrative Region',
  NIR: 'Negros Island Region',
  MIMAROPA: 'Region IV-B',
  BARMM: 'Bangsamoro Autonomous Region in Muslim Mindanao',
};

export type NepNormalizeResult =
  | { ok: true; record: InfrastructureProjectRecord }
  | { ok: false; sourceId: string | null; reason: string };

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function number(value: string | undefined, field: string, warnings: string[]): number | null {
  const raw = text(value);
  if (raw === null) return null;
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) {
    warnings.push(`invalid_number:${field}`);
    return null;
  }
  return n;
}

export function normalizeNepRegion(value: string | null): { region: string | null; warning: string | null } {
  if (value === null) return { region: null, warning: null };
  if (/^nationwide$/i.test(value)) return { region: null, warning: 'nationwide_program' };
  return { region: REGION_NAMES[value.toUpperCase()] ?? value, warning: null };
}

export function normalizeNepRow(row: Record<string, string>): NepNormalizeResult {
  const sourceId = text(row.code);
  if (!sourceId || !SOURCE_ID.test(sourceId)) return { ok: false, sourceId, reason: 'Missing or malformed code.' };
  const title = text(row.project_name);
  if (!title) return { ok: false, sourceId, reason: 'Missing project_name.' };
  if (title.length > 4000) return { ok: false, sourceId, reason: 'project_name is longer than 4000 characters.' };

  const warnings: string[] = [];
  const { region, warning } = normalizeNepRegion(text(row.region));
  if (warning) warnings.push(warning);

  const amount = number(row.amount_php, 'amount_php', warnings);
  const thousands = number(row.amount_php_thousands, 'amount_php_thousands', warnings);
  if (amount !== null && thousands !== null && Math.abs(amount - thousands * 1000) > 1) warnings.push('amount_mismatch');

  const yearRaw = number(row.fiscal_year, 'fiscal_year', warnings);
  const fiscalYear = yearRaw !== null && Number.isInteger(yearRaw) && yearRaw >= 1990 && yearRaw <= 2100 ? yearRaw : null;
  if (yearRaw !== null && fiscalYear === null) warnings.push('invalid_number:fiscal_year');

  // The project name says what is built; the project type is a program line
  // ("Access Roads and/or Bridges ...") and is only the fallback.
  const projectType = text(row.project_type);
  let category = categorize({ sourceCategory: null, infraType: null, typesOfWork: [], description: title });
  if (category.category === 'uncategorized' && projectType) {
    category = categorize({ sourceCategory: null, infraType: null, typesOfWork: [projectType], description: null });
  }

  const sourceRecord = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v]));
  const record: Omit<InfrastructureProjectRecord, 'source_hash'> = {
    source: NEP_SOURCE,
    source_id: sourceId,
    title,
    category: category.category,
    category_method: category.method,
    category_reason: category.reason,
    status: 'proposed',
    region,
    province: null,
    municipality: null,
    latitude: null,
    longitude: null,
    implementing_office: text(row.office),
    program_name: text(row.program),
    sub_program: text(row.sub_program),
    project_type: projectType,
    amount,
    amount_label: 'Proposed amount (NEP)',
    fiscal_year: fiscalYear,
    source_record: sourceRecord,
    data_warnings: warnings,
  };
  const source_hash = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  return { ok: true, record: { ...record, source_hash } };
}
