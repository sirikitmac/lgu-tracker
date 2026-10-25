import { createHash } from 'node:crypto';
import {
  INVALID_DATE,
  INVALID_NUMBER,
  type DpwhComponent,
  type DpwhContractRecord,
  type DpwhStatus,
} from '@/types/dpwh';
import { categorize, isFundingLabel } from './categorize';

/**
 * Normalizes one row of BetterGov's dpwh_transparency_data_all_details.parquet
 * into a public.dpwh_contracts record. Pure: no I/O.
 *
 * - Values the source does not provide stay null; nothing is inferred.
 * - Unparseable or out-of-range values become null with a warning code.
 * - Location (region/province) comes only from the contract's components.
 *   The source `province` column is the implementing DPWH office (often a
 *   District Engineering Office) and `region` is that office's region; both
 *   are kept as implementing_office / implementing_region, never as location.
 * - The source has no municipality or barangay fields; those stay null.
 * - Only a missing or malformed contract ID, or a missing description,
 *   rejects a row.
 */

export interface SourceRevisionRef {
  sha: string;
  committedAt: string;
  fileUrl: string;
}

export type NormalizeResult =
  | { ok: true; record: DpwhContractRecord }
  | { ok: false; contractId: string | null; reason: string };

const CONTRACT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{2,49}$/;

const STATUS_MAP: Record<string, DpwhStatus> = {
  'COMPLETED': 'completed',
  'ON-GOING': 'ongoing',
  'ONGOING': 'ongoing',
  'FOR PROCUREMENT': 'for_procurement',
  'NOT YET STARTED': 'not_yet_started',
  'TERMINATED': 'terminated',
};

/** Lower-case particles in Philippine province names ("Davao del Sur"). */
const NAME_PARTICLES = new Set(['DEL', 'DE', 'NG', 'AND', 'OF']);

export function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' || trimmed.toLowerCase() === 'null' ? null : trimmed;
}

/** "DAVAO DEL SUR" -> "Davao del Sur", "TAWI-TAWI" -> "Tawi-Tawi". */
export function titleCasePlace(value: string | null): string | null {
  if (!value) return null;
  return value
    .toUpperCase()
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && NAME_PARTICLES.has(word)
        ? word.toLowerCase()
        : word.replace(/[A-Z]+/g, (part) => part.charAt(0) + part.slice(1).toLowerCase())
    )
    .join(' ');
}

class Warnings {
  readonly codes = new Set<string>();
  add(code: string) {
    this.codes.add(code);
  }
}

function amount(value: unknown, field: string, warnings: Warnings): number | null {
  let parsed: number | null = null;
  if (typeof value === 'bigint') {
    parsed = value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  } else if (typeof value === 'number') {
    parsed = Number.isFinite(value) ? value : null;
  } else if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    if (cleaned === '' || cleaned.toLowerCase() === 'null') return null;
    parsed = /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
  } else if (value === null || value === undefined) {
    return null;
  }
  if (parsed === null || parsed < 0) {
    warnings.add(INVALID_NUMBER + field);
    return null;
  }
  return parsed;
}

function integer(value: unknown, field: string, warnings: Warnings): number | null {
  const parsed = amount(value, field, warnings);
  return parsed === null ? null : Math.trunc(parsed);
}

/** Accepts Date objects and "YYYY-MM-DD[ HH:MM:SS...]" strings. */
function isoDate(value: unknown, field: string, warnings: Warnings): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      warnings.add(INVALID_DATE + field);
      return null;
    }
    return value.toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (raw === null) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/);
  if (match) {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().startsWith(`${match[1]}-${match[2]}-${match[3]}`)) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  warnings.add(INVALID_DATE + field);
  return null;
}

function link(value: unknown): string | null {
  const raw = text(value);
  return raw && /^https?:\/\//i.test(raw) ? raw : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function isUsableCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' && typeof longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

function components(value: unknown): DpwhComponent[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw: Record<string, unknown>) => {
    const coordinates = (raw?.coordinates ?? {}) as Record<string, unknown>;
    const usable = isUsableCoordinate(coordinates.latitude, coordinates.longitude);
    return {
      component_id: text(raw?.componentId),
      type_of_work: text(raw?.typeOfWork),
      infra_type: text(raw?.infraType),
      region: text(raw?.region),
      province: titleCasePlace(text(raw?.province)),
      latitude: usable ? (coordinates.latitude as number) : null,
      longitude: usable ? (coordinates.longitude as number) : null,
      coordinate_source: text(coordinates.source),
      location_verified: bool(coordinates.locationVerified),
    };
  });
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))].sort();
}

/**
 * Stable SHA-256 over the record's source-derived values. Nothing
 * revision-specific is in the record, so an identical row in a newer
 * snapshot counts as unchanged.
 */
export function hashRecord(record: Omit<DpwhContractRecord, 'source_hash'>): string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}

export function normalizeDetailsRow(raw: Record<string, unknown>, revision: SourceRevisionRef): NormalizeResult {
  const contractId = text(raw.contractId);
  if (!contractId) return { ok: false, contractId: null, reason: 'Missing contractId.' };
  if (!CONTRACT_ID.test(contractId)) return { ok: false, contractId, reason: 'Malformed contractId.' };
  const title = text(raw.description);
  if (!title) return { ok: false, contractId, reason: 'Missing description.' };
  if (title.length > 4000) return { ok: false, contractId, reason: 'Description longer than 4000 characters.' };

  const warnings = new Warnings();

  const sourceStatus = text(raw.status);
  const status: DpwhStatus = (sourceStatus && STATUS_MAP[sourceStatus.toUpperCase()]) || 'unknown';
  if (status === 'unknown') warnings.add('unknown_status');

  const sourceCategory = text(raw.category);
  if (isFundingLabel(sourceCategory)) warnings.add('funding_label_as_category');
  const parts = components(raw.components);
  const { category, method, reason } = categorize({
    sourceCategory,
    infraType: text(raw.infraType),
    typesOfWork: parts.map((c) => c.type_of_work),
    description: title,
  });

  // Location from components only.
  const regions = unique(parts.map((c) => c.region));
  const provinces = unique(parts.map((c) => c.province));
  if (parts.length === 0 || (regions.length === 0 && provinces.length === 0)) warnings.add('no_component_location');
  if (regions.length > 1) warnings.add('multiple_regions');
  if (provinces.length > 1) warnings.add('multiple_provinces');

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (isUsableCoordinate(raw.latitude, raw.longitude)) {
    latitude = raw.latitude as number;
    longitude = raw.longitude as number;
  } else if (raw.latitude !== null && raw.latitude !== undefined) {
    warnings.add('invalid_coordinates');
  } else {
    warnings.add('no_coordinates');
  }

  let progress = amount(raw.progress, 'progress', warnings);
  if (progress !== null && progress > 100) {
    warnings.add('invalid_progress');
    progress = null;
  }
  if (status === 'completed' && progress !== null && progress < 100) warnings.add('completed_progress_below_100');
  if (status === 'ongoing' && progress === 100) warnings.add('ongoing_progress_100');

  const contractAmount = amount(raw.awardAmount, 'awardAmount', warnings);
  const amountPaid = amount(raw.amountPaid, 'amountPaid', warnings);
  if (contractAmount !== null && amountPaid !== null && amountPaid > contractAmount) warnings.add('amount_paid_exceeds_contract');

  const startDate = isoDate(raw.startDate, 'startDate', warnings);
  const completionDate = isoDate(raw.completionDate, 'completionDate', warnings);
  if (startDate && completionDate && completionDate < startDate) warnings.add('completion_before_start');

  let infraYear = integer(raw.infraYear, 'infraYear', warnings);
  if (infraYear !== null && (infraYear < 1990 || infraYear > 2100)) {
    warnings.add(INVALID_NUMBER + 'infraYear');
    infraYear = null;
  }

  const withoutHash: Omit<DpwhContractRecord, 'source_hash'> = {
    contract_id: contractId,
    title,
    // Stored only when it adds information (it equals the description in ~95% of rows).
    contract_name: text(raw.contractName) === title ? null : text(raw.contractName),
    source_category: sourceCategory,
    infra_type: text(raw.infraType),
    category,
    category_method: method,
    category_reason: reason,
    source_status: sourceStatus,
    status,
    procurement_status_code: text(raw.status_1),
    implementing_office: text(raw.province),
    implementing_region: text(raw.region),
    region: regions.length === 1 ? regions[0] : null,
    province: provinces.length === 1 ? provinces[0] : null,
    provinces,
    municipality: null,
    barangay: null,
    latitude,
    longitude,
    contractor: text(raw.contractor),
    winner_names: text(raw.winnerNames),
    budget: amount(raw.budget, 'budget', warnings),
    approved_budget: amount(raw.abc, 'abc', warnings),
    contract_amount: contractAmount,
    amount_paid: amountPaid,
    progress,
    start_date: startDate,
    completion_date: completionDate,
    contract_effectivity_date: isoDate(raw.contractEffectivityDate, 'contractEffectivityDate', warnings),
    expiry_date: isoDate(raw.expiryDate, 'expiryDate', warnings),
    infra_year: infraYear,
    program_name: text(raw.programName),
    source_of_funds: text(raw.sourceOfFunds),
    funding_instrument: text(raw.fundingInstrument),
    advertisement_date: isoDate(raw.advertisementDate, 'advertisementDate', warnings),
    bid_submission_deadline: isoDate(raw.bidSubmissionDeadline, 'bidSubmissionDeadline', warnings),
    award_date: isoDate(raw.dateOfAward, 'dateOfAward', warnings),
    link_advertisement: link(raw.advertisement),
    link_contract_agreement: link(raw.contractAgreement),
    link_notice_of_award: link(raw.noticeOfAward),
    link_notice_to_proceed: link(raw.noticeToProceed),
    is_live: bool(raw.isLive),
    livestream_url: link(raw.livestreamUrl),
    total_images: integer(raw.totalImages, 'totalImages', warnings),
    latest_image_date: isoDate(raw.latestImageDate, 'latestImageDate', warnings),
    source_verified_by_dpwh: bool(raw.isVerifiedByDpwh),
    source_verified_by_public: bool(raw.isVerifiedByPublic),
    components: parts,
    data_warnings: [...warnings.codes].sort(),
  };

  return { ok: true, record: { ...withoutHash, source_hash: hashRecord(withoutHash) } };
}
