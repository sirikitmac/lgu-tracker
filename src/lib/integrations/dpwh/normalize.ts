import { createHash } from 'node:crypto';
import type { DbProjectCategory, DbProjectStatus } from '@/lib/supabase/projectMapper';
import type {
  DpwhImportCandidate,
  DpwhPreviewEntry,
  DpwhSourceRevision,
  DpwhSourceRow,
} from '@/types/dpwhImport';

/**
 * Pure normalization and dry-run classification for DPWH records. Nothing
 * here performs I/O; source.ts reads the rows and the route decides what to
 * compare them against.
 *
 * Rule of thumb: a value the source does not provide stays null. Mapped
 * fields are filled only when the DPWH value has one unambiguous LGU Tracker
 * equivalent, and every gap is reported as a warning instead of guessed.
 */

export const DPWH_DATASET = 'bettergovph/dpwh-transparency-data';
export const DPWH_ORIGINAL_PUBLISHER =
  'Department of Public Works and Highways (DPWH) Transparency Portal, compiled by BetterGov.ph';
export const DPWH_LICENSE = 'CC0-1.0 (dataset compilation)';

/** DPWH contract IDs look like "23KM0042"; also bounded by projects.reference_code. */
const CONTRACT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,49}$/;

const STATUS_MAP: Record<string, DbProjectStatus> = {
  Completed: 'completed',
  'On-Going': 'in_progress',
  'For Procurement': 'procurement',
  // 'Not Yet Started' and 'Terminated' have no unambiguous equivalent.
};

/**
 * The source `category` column mixes DPWH work types ("Roads", "Bridges")
 * with funding labels ("GAA 2025 SSP"). Only work types are mapped.
 */
const WORK_CATEGORY_PREFIXES = [
  'Roads',
  'Bridges',
  'Buildings',
  'Building:',
  'Flood Control',
  'Water Provision',
];

function mapCategory(category: string | null): DbProjectCategory | null {
  if (!category) return null;
  return WORK_CATEGORY_PREFIXES.some((prefix) => category.startsWith(prefix))
    ? 'infrastructure_public_works'
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function num(value: unknown): number | null {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Parquet DATE columns arrive as Date objects at UTC midnight. */
function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return text(value);
}

/**
 * Coerces a decoded Parquet row into the documented source shape. Accepts
 * both the nested `location` struct and the flat `location_province` /
 * `location_region` columns of the first published revision.
 */
export function toSourceRow(raw: Record<string, unknown>): DpwhSourceRow {
  const location =
    (raw.location as Record<string, unknown> | null | undefined) ??
    ('location_province' in raw || 'location_region' in raw
      ? { province: raw.location_province, region: raw.location_region }
      : null);
  return {
    contractId: text(raw.contractId),
    description: text(raw.description),
    category: text(raw.category),
    componentCategories: text(raw.componentCategories),
    status: text(raw.status),
    budget: num(raw.budget),
    amountPaid: num(raw.amountPaid),
    progress: num(raw.progress),
    location: location
      ? { province: text(location.province), region: text(location.region) }
      : null,
    contractor: text(raw.contractor),
    startDate: isoDate(raw.startDate),
    completionDate: isoDate(raw.completionDate),
    infraYear: text(raw.infraYear),
    programName: text(raw.programName),
    sourceOfFunds: text(raw.sourceOfFunds),
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
  };
}

/** Stable hash of a source row (keys sorted) for change detection. */
export function hashSourceRow(row: DpwhSourceRow): string {
  const stable = JSON.stringify(row, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value
  );
  return createHash('sha256').update(stable).digest('hex');
}

export function changedSourceFields(before: DpwhSourceRow, after: DpwhSourceRow): string[] {
  return (Object.keys(after) as (keyof DpwhSourceRow)[]).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
  );
}

export type NormalizeResult =
  | { ok: true; candidate: DpwhImportCandidate }
  | { ok: false; contractId: string | null; reason: string };

export function normalizeDpwhRow(row: DpwhSourceRow, revision: DpwhSourceRevision): NormalizeResult {
  const contractId = row.contractId;
  if (!contractId) {
    return { ok: false, contractId: null, reason: 'Missing contractId; no stable identifier.' };
  }
  if (!CONTRACT_ID_PATTERN.test(contractId)) {
    return { ok: false, contractId, reason: `contractId "${contractId}" has an unexpected format.` };
  }
  if (!row.description || row.description.length < 3) {
    return { ok: false, contractId, reason: 'Missing project description (used as title).' };
  }
  if (row.budget !== null && row.budget < 0) {
    return { ok: false, contractId, reason: `Negative budget (${row.budget}).` };
  }
  if (row.amountPaid !== null && row.amountPaid < 0) {
    return { ok: false, contractId, reason: `Negative amountPaid (${row.amountPaid}).` };
  }
  if (row.progress !== null && (row.progress < 0 || row.progress > 100)) {
    return { ok: false, contractId, reason: `Progress ${row.progress} is outside 0-100.` };
  }

  const warnings: string[] = [];

  const mappedStatus = row.status ? STATUS_MAP[row.status] ?? null : null;
  if (!mappedStatus) {
    warnings.push(`Status "${row.status ?? '(none)'}" has no LGU Tracker equivalent; left unmapped.`);
  }
  // Newer revisions sometimes replace `category` with a funding label while
  // `componentCategories` keeps the work type, so fall back to it.
  let mappedCategory = mapCategory(row.category);
  if (!mappedCategory) {
    mappedCategory = mapCategory(row.componentCategories);
    warnings.push(
      mappedCategory
        ? `Category "${row.category ?? '(none)'}" is not a work type; mapped from componentCategories "${row.componentCategories}".`
        : `Neither category "${row.category ?? '(none)'}" nor componentCategories is a DPWH work type; left unmapped.`
    );
  }

  let { latitude, longitude } = row;
  if (latitude === null || longitude === null) {
    if (latitude !== null || longitude !== null) warnings.push('Only one coordinate present; both dropped.');
    else warnings.push('No coordinates in source.');
    latitude = longitude = null;
  } else if (
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    warnings.push(`Invalid coordinates (${latitude}, ${longitude}); dropped.`);
    latitude = longitude = null;
  } else {
    warnings.push('Coordinates are DPWH-reported and not verified by LGU Tracker.');
  }

  if (row.status === 'Completed' && row.amountPaid === 0) {
    warnings.push('Status is Completed but amountPaid is 0; payments may be unreported.');
  }
  if (row.status === 'On-Going' && row.progress === 100) {
    warnings.push('Status is On-Going but progress is 100%.');
  }
  if (row.status === 'Completed' && row.progress !== null && row.progress < 100) {
    warnings.push(`Status is Completed but progress is ${row.progress}%.`);
  }
  if (row.status === 'Completed' && !row.completionDate) {
    warnings.push('Status is Completed but completionDate is missing.');
  }
  if ((row.budget === null || row.budget === 0) && row.status !== 'For Procurement') {
    warnings.push(`Budget is ${row.budget === null ? 'missing' : '0'} although status is "${row.status ?? '(none)'}".`);
  }
  if (row.budget !== null && row.amountPaid !== null && row.amountPaid > row.budget) {
    warnings.push('amountPaid exceeds budget.');
  }
  if (row.startDate && row.completionDate && row.completionDate < row.startDate) {
    warnings.push('completionDate is before startDate.');
  }
  if (row.description.length > 300) {
    warnings.push('Description exceeds 300 characters (projects.title limit); kept in full.');
  }

  return {
    ok: true,
    candidate: {
      contractId,
      title: row.description,
      sourceStatus: row.status,
      mappedStatus,
      sourceCategory: row.category,
      sourceComponentCategories: row.componentCategories,
      mappedCategory,
      districtEngineeringOffice: row.location?.province ?? null,
      region: row.location?.region ?? null,
      contractor: row.contractor,
      budget: row.budget,
      amountPaid: row.amountPaid,
      progressPercentage: row.progress,
      startDate: row.startDate,
      completionDate: row.completionDate,
      infraYear: row.infraYear,
      programName: row.programName,
      sourceOfFunds: row.sourceOfFunds,
      latitude,
      longitude,
      provenance: {
        dataset: DPWH_DATASET,
        revision: revision.sha,
        revisionCommittedAt: revision.committedAt,
        fileUrl: revision.fileUrl,
        betterGovRecordUrl: `https://api.dpwh.bettergov.ph/projects/${encodeURIComponent(contractId)}`,
        originalPublisher: DPWH_ORIGINAL_PUBLISHER,
        license: DPWH_LICENSE,
      },
      contentHash: hashSourceRow(row),
      warnings,
    },
  };
}

/**
 * Groups rows by contractId without dropping any. Published revisions are
 * not guaranteed unique: the first one repeats 1,019 contract IDs.
 */
export function groupByContractId(rows: readonly DpwhSourceRow[]): Map<string, DpwhSourceRow[]> {
  const groups = new Map<string, DpwhSourceRow[]>();
  for (const row of rows) {
    if (!row.contractId) continue;
    const group = groups.get(row.contractId);
    if (group) group.push(row);
    else groups.set(row.contractId, [row]);
  }
  return groups;
}

export interface ClassifyContext {
  /** Previously imported source rows per contractId (the comparison baseline). */
  baseline: ReadonlyMap<string, readonly DpwhSourceRow[]>;
  /** public.projects reference codes; imports never collide with local projects. */
  localReferenceCodes: ReadonlySet<string>;
}

/**
 * Decides, without writing anything, what an import would do with each row:
 * insert (new contractId), update (known contractId whose source row
 * changed), skip (unchanged, duplicate, or owned by a local project), or
 * reject (fails validation).
 */
export function classifyDpwhRows(
  rows: readonly DpwhSourceRow[],
  revision: DpwhSourceRevision,
  context: ClassifyContext
): DpwhPreviewEntry[] {
  const seen = new Map<string, string>();

  return rows.map((row): DpwhPreviewEntry => {
    const result = normalizeDpwhRow(row, revision);
    if (!result.ok) {
      return { action: 'reject', contractId: result.contractId, reason: result.reason };
    }
    const { candidate } = result;
    const id = candidate.contractId;

    const firstHash = seen.get(id);
    if (firstHash !== undefined) {
      return firstHash === candidate.contentHash
        ? { action: 'skip', contractId: id, reason: 'Exact duplicate of an earlier row in this revision.' }
        : { action: 'reject', contractId: id, reason: 'Conflicting duplicate contractId within this revision.' };
    }
    seen.set(id, candidate.contentHash);

    if (context.localReferenceCodes.has(id)) {
      return {
        action: 'skip',
        contractId: id,
        reason: 'A locally managed project already uses this reference code; local projects are never overwritten.',
        candidate,
      };
    }

    const previousRows = context.baseline.get(id) ?? [];
    if (previousRows.length === 0) {
      return { action: 'insert', contractId: id, reason: 'Not in baseline.', candidate };
    }
    const previousHashes = new Set(previousRows.map(hashSourceRow));
    if (previousHashes.size > 1) {
      return {
        action: 'reject',
        contractId: id,
        reason: 'Baseline holds conflicting rows for this contractId; resolve manually.',
        candidate,
      };
    }
    const previous = previousRows[0];
    if (previousHashes.has(candidate.contentHash)) {
      return { action: 'skip', contractId: id, reason: 'Unchanged since baseline.', candidate };
    }
    return {
      action: 'update',
      contractId: id,
      reason: 'Source row changed since baseline.',
      candidate,
      changedFields: changedSourceFields(previous, row),
    };
  });
}
