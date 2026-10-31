/**
 * SubayBAYAN Excel rows → normalized project records (before location and
 * category are attached). Pure functions apart from readWorkbook.
 *
 * Layout (verified on all 22 exports): rows 1–7 letterhead, header rows
 * 8 (sections) / 9 (fields) / 10 (sub-fields), data from row 11, 142 columns.
 */
import path from 'node:path';
import type { SubaybayanDataset, SubaybayanStatus } from '@/lib/subaybayan/categories';
import { readFirstSheet, type CellValue } from './xlsx';

export const HEADER_ROW_FIELDS = 9;
export const HEADER_ROW_SUBFIELDS = 10;
export const FIRST_DATA_ROW = 11;
export const EXPECTED_COLUMNS = 142;

/** 0-based column indexes. */
export const COL = {
  projectOwner: 0,
  region: 1,
  province: 2,
  citymun: 3,
  barangay: 4,
  projectCode: 5,
  title: 6,
  componentDetails: 7,
  program: 8,
  projectType: 9,
  fundingYear: 10,
  modeOfImplementation: 11,
  sector: 12,
  size: 13,
  procurementType: 14,
  beneficiaries: 15,
  nationalSubsidy: 16,
  lguCounterpart: 17,
  approvalStatus: 18,
  physicalStatus: 19,
  dateEnrolled: 22,
  photosFirst: 23,
  photosLast: 38,
  startDate: 39,
  endDate: 40,
  totalCost: 42,
  owpa: 88,
  slippage: 89,
  riskLevel: 90,
  dateOfCompletion: 122,
  implementingUnit: 125,
  contractor: 130,
  contractAmount: 134,
} as const;

/** Header names that must be in row 9 (whitespace-normalized), so a format change fails loudly. */
export const REQUIRED_HEADERS: [number, string][] = [
  [COL.region, 'REGION'],
  [COL.province, 'PROVINCE'],
  [COL.citymun, 'CITY / MUNICIPALITY'],
  [COL.barangay, 'BARANGAY'],
  [COL.projectCode, 'PROJECT CODE'],
  [COL.title, 'PROJECT TITLE'],
  [COL.componentDetails, 'COMPONENT DETAILS'],
  [COL.program, 'PROGRAM'],
  [COL.projectType, 'PROJECT TYPE'],
  [COL.fundingYear, 'FUNDING YEAR'],
  [COL.physicalStatus, 'PHYSICAL STATUS'],
  [COL.startDate, 'START DATE'],
  [COL.endDate, 'END DATE'],
  [COL.totalCost, 'TOTAL PROGRAM / PROJECT COST'],
  [COL.owpa, 'LATEST OWPA TO DATE (%)'],
  [COL.contractor, 'CONTRACTOR'],
  [COL.contractAmount, 'CONTRACT AMOUNT'],
];

export const squashHeader = (v: CellValue | undefined) => String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

export function assertHeaders(file: string, rows: CellValue[][]): void {
  const fields = rows[HEADER_ROW_FIELDS - 1] ?? [];
  const problems = REQUIRED_HEADERS.filter(([i, name]) => squashHeader(fields[i]) !== name).map(
    ([i, name]) => `column ${i} is "${squashHeader(fields[i])}", expected "${name}"`
  );
  const subs = rows[HEADER_ROW_SUBFIELDS - 1] ?? [];
  if (squashHeader(subs[COL.nationalSubsidy]) !== 'NATIONAL SUBSIDY') problems.push('column 16 sub-header is not NATIONAL SUBSIDY');
  if (squashHeader(subs[COL.lguCounterpart]) !== 'LGU COUNTERPART') problems.push('column 17 sub-header is not LGU COUNTERPART');
  if (problems.length) throw new Error(`${file}: unexpected header layout:\n  ${problems.join('\n  ')}`);
}

/** Photo columns whose row-10 sub-header is "W/ GEOTAGGED" (not "W/O GEOTAGGED"). */
export function geotaggedPhotoColumns(rows: CellValue[][]): number[] {
  const subs = rows[HEADER_ROW_SUBFIELDS - 1] ?? [];
  const cols: number[] = [];
  for (let i = COL.photosFirst; i <= COL.photosLast; i++) if (squashHeader(subs[i]) === 'W/ GEOTAGGED') cols.push(i);
  return cols;
}

// ---------------------------------------------------------------------------
// Value parsers. Each returns null for empty input and reports invalid input
// through `issue` instead of guessing.
// ---------------------------------------------------------------------------

export type Issue = (field: string, value: unknown) => void;

export function text(v: CellValue | undefined, max = 2000): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** "3,900,169.00", 3900169, "₱ 1,000" → number; anything else → null (+ issue). */
export function parseMoney(v: CellValue | undefined, field: string, issue: Issue): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    if (Number.isFinite(v) && v >= 0) return Math.round(v * 100) / 100;
    issue(field, v);
    return null;
  }
  const s = v.replace(/[₱,\s]|php/gi, '');
  if (!s || s === '-') return null;
  if (!/^\d+(?:\.\d+)?$/.test(s)) {
    issue(field, v);
    return null;
  }
  return Math.round(Number(s) * 100) / 100;
}

/** Latest OWPA: the last number in the cell, kept only within 0–100. */
export function parseOwpa(v: CellValue | undefined, issue: Issue): number | null {
  if (v === null || v === undefined || v === '') return null;
  const nums = typeof v === 'number' ? [v] : [...String(v).matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (!nums.length) return null;
  const last = nums[nums.length - 1];
  if (last < 0 || last > 100) {
    issue('owpa', v);
    return null;
  }
  return Math.round(last * 100) / 100;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** "2025-11-17" (or an Excel serial day number) → "2025-11-17"; invalid → null (+ issue). */
export function parseDate(v: CellValue | undefined, field: string, issue: Issue): string | null {
  if (v === null || v === undefined || v === '') return null;
  let iso: string | null = null;
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) iso = new Date(EXCEL_EPOCH + Math.round(v) * 86400000).toISOString().slice(0, 10);
  } else {
    const m = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    const year = Number(iso.slice(0, 4));
    if (!Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) && year >= 1990 && year <= 2100) return iso;
  }
  issue(field, v);
  return null;
}

export function parseYear(v: CellValue | undefined, issue: Issue): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1990 && n <= 2100) return n;
  issue('funding_year', v);
  return null;
}

export function parseCount(v: CellValue | undefined): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function mapStatus(raw: string | null): SubaybayanStatus {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'on-going' || s === 'ongoing') return 'ongoing';
  if (s === 'not yet started') return 'not_yet_started';
  if (s === 'cancelled' || s === 'terminated' || s === 'not-implemented' || s === 'not implemented') return 'cancelled';
  return 'unknown';
}

/**
 * Total project cost, else contract amount, else national subsidy + LGU
 * counterpart. A zero is treated as "not reported" (the exports write 0 in
 * empty counterpart cells), so a project never shows a cost of ₱0.
 */
export function pickCost(total: number | null, contract: number | null, subsidy: number | null, counterpart: number | null): number | null {
  if (total) return total;
  if (contract) return contract;
  const sum = Math.round(((subsidy ?? 0) + (counterpart ?? 0)) * 100) / 100;
  return sum > 0 ? sum : null;
}

/** A total more than this many times the row's own reference amount is treated as a data-entry error. */
export const IMPLAUSIBLE_COST_FACTOR = 20;
/**
 * A reference amount below this is itself not a believable project amount
 * (the exports have contract amounts like ₱99 next to a ₱999,017.83 total),
 * so it is never used to overrule the reported total.
 */
export const MIN_REFERENCE_AMOUNT = 10_000;

/**
 * The total project cost, unless it is over IMPLAUSIBLE_COST_FACTOR times a
 * reference amount from the same row (the contract amount, or national
 * subsidy + LGU counterpart). The exports contain totals ~1,000x the subsidy
 * (decimal-entry errors such as ₱1,994,699,780 against a ₱2,000,000 subsidy).
 * Such a total is logged and skipped, so the documented order falls through
 * to the reference amount; nothing is invented. Without a believable
 * reference amount (at least MIN_REFERENCE_AMOUNT) the total is kept as reported.
 */
export function plausibleTotal(total: number | null, contract: number | null, subsidy: number | null, counterpart: number | null, issue: Issue): number | null {
  if (!total) return total;
  const reference = Math.max(contract ?? 0, (subsidy ?? 0) + (counterpart ?? 0));
  if (reference >= MIN_REFERENCE_AMOUNT && total > reference * IMPLAUSIBLE_COST_FACTOR) {
    issue('total_project_cost_implausible', total);
    return null;
  }
  return total;
}

export type CostBasis = 'contract_amount' | 'subsidy_plus_counterpart';

/**
 * total_cost for a row, plus — only when the reported total was skipped as
 * implausible — the reported value and which amount is used instead, so the
 * substitution stays visible.
 */
export function resolveCost(
  total: number | null,
  contract: number | null,
  subsidy: number | null,
  counterpart: number | null,
  issue: Issue
): { total_cost: number | null; total_cost_reported: number | null; total_cost_basis: CostBasis | null } {
  const plausible = plausibleTotal(total, contract, subsidy, counterpart, issue);
  const cost = pickCost(plausible, contract, subsidy, counterpart);
  if (total && plausible === null && cost !== null) {
    return { total_cost: cost, total_cost_reported: total, total_cost_basis: contract ? 'contract_amount' : 'subsidy_plus_counterpart' };
  }
  return { total_cost: cost, total_cost_reported: null, total_cost_basis: null };
}

// ---------------------------------------------------------------------------

export interface RawRecord {
  source_dataset: SubaybayanDataset;
  source_file: string;
  source_batch: number;
  source_row: number;
  project_owner: string | null;
  region: string | null;
  province: string | null;
  citymun: string | null;
  barangay: string | null;
  project_code: string | null;
  title: string;
  component_details: string | null;
  program: string | null;
  project_type: string | null;
  funding_year: number | null;
  mode_of_implementation: string | null;
  sector: string | null;
  size_text: string | null;
  beneficiaries_text: string | null;
  national_subsidy: number | null;
  lgu_counterpart: number | null;
  approval_status: string | null;
  status: SubaybayanStatus;
  status_raw: string | null;
  geotagged_photos: number;
  start_date: string | null;
  end_date: string | null;
  total_cost: number | null;
  /** Set only when the reported total was replaced (see resolveCost). */
  total_cost_reported: number | null;
  total_cost_basis: CostBasis | null;
  owpa: number | null;
  contractor: string | null;
}

export interface ParseIssue {
  file: string;
  row: number;
  field: string;
  value: string;
}

export function datasetOf(file: string): SubaybayanDataset {
  const base = path.basename(file).toUpperCase();
  if (base.startsWith('LGSF')) return 'lgsf';
  if (base.startsWith('RLIP')) return 'rlip';
  throw new Error(`${file}: cannot tell the dataset from the file name (expected LGSF_* or RLIP_*).`);
}

export function batchOf(file: string): number {
  const m = /batch\s*0*(\d+)/i.exec(path.basename(file));
  if (!m) throw new Error(`${file}: no batch number in the file name.`);
  return Number(m[1]);
}

export function rowToRecord(
  row: CellValue[],
  ctx: { dataset: SubaybayanDataset; file: string; batch: number; rowNumber: number; photoCols: number[] },
  issues: ParseIssue[]
): RawRecord {
  const issue: Issue = (field, value) => issues.push({ file: ctx.file, row: ctx.rowNumber, field, value: String(value).slice(0, 120) });
  const nationalSubsidy = parseMoney(row[COL.nationalSubsidy], 'national_subsidy', issue);
  const lguCounterpart = parseMoney(row[COL.lguCounterpart], 'lgu_counterpart', issue);
  const totalCost = parseMoney(row[COL.totalCost], 'total_project_cost', issue);
  const contractAmount = parseMoney(row[COL.contractAmount], 'contract_amount', issue);
  const statusRaw = text(row[COL.physicalStatus], 60);
  return {
    source_dataset: ctx.dataset,
    source_file: ctx.file,
    source_batch: ctx.batch,
    source_row: ctx.rowNumber,
    project_owner: text(row[COL.projectOwner], 40),
    region: text(row[COL.region], 120),
    province: text(row[COL.province], 120),
    citymun: text(row[COL.citymun], 120),
    barangay: text(row[COL.barangay], 1000),
    project_code: text(row[COL.projectCode], 80),
    title: text(row[COL.title], 1000) ?? '(untitled)',
    component_details: text(row[COL.componentDetails], 2000),
    program: text(row[COL.program], 200),
    project_type: text(row[COL.projectType], 120),
    funding_year: parseYear(row[COL.fundingYear], issue),
    mode_of_implementation: text(row[COL.modeOfImplementation], 60),
    sector: text(row[COL.sector], 200),
    size_text: text(row[COL.size], 200),
    beneficiaries_text: text(row[COL.beneficiaries], 300),
    national_subsidy: nationalSubsidy,
    lgu_counterpart: lguCounterpart,
    approval_status: text(row[COL.approvalStatus], 80),
    status: mapStatus(statusRaw),
    status_raw: statusRaw,
    geotagged_photos: ctx.photoCols.reduce((sum, i) => sum + parseCount(row[i]), 0),
    start_date: parseDate(row[COL.startDate], 'start_date', issue),
    end_date: parseDate(row[COL.endDate], 'end_date', issue),
    ...resolveCost(totalCost, contractAmount, nationalSubsidy, lguCounterpart, issue),
    owpa: parseOwpa(row[COL.owpa], issue),
    contractor: text(row[COL.contractor], 300),
  };
}

const isBlankRow = (r: CellValue[] | undefined) => !r || !r.some((v) => v !== null && v !== undefined && String(v).trim() !== '');

/** Reads one export and returns its records; asserts the header layout first. */
export function readWorkbook(file: string, issues: ParseIssue[]): RawRecord[] {
  const { rows } = readFirstSheet(file);
  const name = path.basename(file);
  assertHeaders(name, rows);
  const width = Math.max(...rows.slice(HEADER_ROW_FIELDS - 1, HEADER_ROW_SUBFIELDS).map((r) => r?.length ?? 0));
  if (width !== EXPECTED_COLUMNS) throw new Error(`${name}: header has ${width} columns, expected ${EXPECTED_COLUMNS}.`);
  const photoCols = geotaggedPhotoColumns(rows);
  if (photoCols.length === 0) throw new Error(`${name}: no "W/ GEOTAGGED" photo columns found in row 10.`);
  const ctx = { dataset: datasetOf(name), file: name, batch: batchOf(name), photoCols };
  const out: RawRecord[] = [];
  for (let i = FIRST_DATA_ROW - 1; i < rows.length; i++) {
    if (isBlankRow(rows[i])) continue;
    out.push(rowToRecord(rows[i], { ...ctx, rowNumber: i + 1 }, issues));
  }
  return out;
}
