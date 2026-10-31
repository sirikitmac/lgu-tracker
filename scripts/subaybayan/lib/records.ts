/**
 * Final SubayBAYAN rows as stored in public.subaybayan_projects.
 */
import { createHash } from 'node:crypto';
import type { LocationPrecision, SubaybayanCategory } from '@/lib/subaybayan/categories';
import { SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_AT } from '@/lib/subaybayan/source';
import type { RawRecord } from './extract';
import type { Classification } from './classify';
import type { LocationResult } from './locate';

export interface ProjectRow {
  id: string;
  source_dataset: RawRecord['source_dataset'];
  project_code: string | null;
  title: string;
  sector_category: SubaybayanCategory;
  sector_subcategory: string | null;
  classification_reason: string;
  region: string | null;
  province: string | null;
  citymun: string | null;
  barangay: string | null;
  psgc_region: string | null;
  psgc_province: string | null;
  psgc_citymun: string | null;
  psgc_barangay: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: LocationPrecision;
  funding_year: number | null;
  status: RawRecord['status'];
  status_raw: string | null;
  project_type: string | null;
  program: string | null;
  sector: string | null;
  mode_of_implementation: string | null;
  total_cost: number | null;
  /** Present only when the reported total was replaced (keeps unaffected rows' hashes unchanged). */
  total_cost_reported?: number;
  total_cost_basis?: RawRecord['total_cost_basis'];
  /** Present (true) only when the total needs review (lib/review.ts), so unflagged rows keep their hashes. */
  total_cost_review?: true;
  national_subsidy: number | null;
  lgu_counterpart: number | null;
  owpa: number | null;
  contractor: string | null;
  project_owner: string | null;
  approval_status: string | null;
  geotagged_photos: number;
  size_text: string | null;
  beneficiaries_text: string | null;
  component_details: string | null;
  start_date: string | null;
  end_date: string | null;
  source_file: string;
  source_batch: number;
  source_row: number;
  source_url: string;
  retrieved_at: string;
  source_hash: string;
}

/**
 * Record id: the project code when it is unique within its dataset,
 * otherwise `{dataset}-b{batch:02}-r{row}` (rows without a code, and every
 * row of a repeated code). Throws if the result is not unique.
 */
export function assignIds(records: Pick<RawRecord, 'source_dataset' | 'project_code' | 'source_batch' | 'source_row'>[]): string[] {
  const counts = new Map<string, number>();
  for (const r of records) if (r.project_code) counts.set(`${r.source_dataset}|${r.project_code}`, (counts.get(`${r.source_dataset}|${r.project_code}`) ?? 0) + 1);
  const ids = records.map((r) =>
    r.project_code && counts.get(`${r.source_dataset}|${r.project_code}`) === 1
      ? r.project_code
      : `${r.source_dataset}-b${String(r.source_batch).padStart(2, '0')}-r${r.source_row}`
  );
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) (seen.has(id) ? dupes : seen).add(id);
  if (dupes.size) throw new Error(`Record ids are not unique: ${[...dupes].slice(0, 10).join(', ')}${dupes.size > 10 ? ' …' : ''}`);
  return ids;
}

/** Stable hash of every stored field except the hash itself (key order fixed by the object literal). */
export function rowHash(row: Omit<ProjectRow, 'source_hash'>): string {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 32);
}

/** The row with the "needs review" flag set, re-hashed. */
export function withCostReview(row: ProjectRow): ProjectRow {
  const { source_hash: previous, ...rest } = row;
  void previous;
  const flagged = { ...rest, total_cost_review: true as const };
  return { ...flagged, source_hash: rowHash(flagged) };
}

export function toProjectRow(id: string, r: RawRecord, c: Classification, loc: LocationResult): ProjectRow {
  const row: Omit<ProjectRow, 'source_hash'> = {
    id,
    source_dataset: r.source_dataset,
    project_code: r.project_code,
    title: r.title,
    sector_category: c.category,
    sector_subcategory: c.subcategory,
    classification_reason: c.reason,
    region: r.region,
    province: r.province,
    citymun: r.citymun,
    barangay: r.barangay,
    psgc_region: loc.psgc_region,
    psgc_province: loc.psgc_province,
    psgc_citymun: loc.psgc_citymun,
    psgc_barangay: loc.psgc_barangay,
    latitude: loc.latitude,
    longitude: loc.longitude,
    location_precision: loc.location_precision,
    funding_year: r.funding_year,
    status: r.status,
    status_raw: r.status_raw,
    project_type: r.project_type,
    program: r.program,
    sector: r.sector,
    mode_of_implementation: r.mode_of_implementation,
    total_cost: r.total_cost,
    ...(r.total_cost_reported !== null && r.total_cost_basis !== null
      ? { total_cost_reported: r.total_cost_reported, total_cost_basis: r.total_cost_basis }
      : {}),
    national_subsidy: r.national_subsidy,
    lgu_counterpart: r.lgu_counterpart,
    owpa: r.owpa,
    contractor: r.contractor,
    project_owner: r.project_owner,
    approval_status: r.approval_status,
    geotagged_photos: r.geotagged_photos,
    size_text: r.size_text,
    beneficiaries_text: r.beneficiaries_text,
    component_details: r.component_details,
    start_date: r.start_date,
    end_date: r.end_date,
    source_file: r.source_file,
    source_batch: r.source_batch,
    source_row: r.source_row,
    source_url: SUBAYBAYAN_DATASET_INFO[r.source_dataset].url,
    retrieved_at: SUBAYBAYAN_RETRIEVED_AT,
  };
  return { ...row, source_hash: rowHash(row) };
}
