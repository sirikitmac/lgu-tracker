/**
 * SubayBAYAN map query: URL parameter parsing (validated), in-memory
 * filtering of the snapshot, facet counts and the compact points payload.
 * Pure functions, shared by the API routes (server) and the map (client:
 * URL <-> filter state), and unit-tested.
 */
import {
  LOCATION_PRECISIONS,
  SUBAYBAYAN_CATEGORIES,
  SUBAYBAYAN_DATASETS,
  SUBAYBAYAN_STATUSES,
  type LocationPrecision,
  type SubaybayanCategory,
  type SubaybayanDataset,
  type SubaybayanStatus,
} from './categories';

/** One row of the in-memory index (the columns filters and markers need). */
export interface IndexRow {
  id: string;
  project_code: string | null;
  title: string;
  sector_category: SubaybayanCategory;
  sector_subcategory: string | null;
  region: string | null;
  province: string | null;
  citymun: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: LocationPrecision;
  funding_year: number | null;
  status: SubaybayanStatus;
  source_dataset: SubaybayanDataset;
  project_type: string | null;
  program: string | null;
  sector: string | null;
  mode_of_implementation: string | null;
  total_cost: number | null;
}

export const INDEX_COLUMNS = [
  'id', 'project_code', 'title', 'sector_category', 'sector_subcategory', 'region', 'province', 'citymun',
  'latitude', 'longitude', 'location_precision', 'funding_year', 'status', 'source_dataset', 'project_type',
  'program', 'sector', 'mode_of_implementation', 'total_cost',
] as const;

/** Category-specific filters, shown only while that category is selected. */
export type DetailKey = 'sub' | 'type' | 'mode' | 'program' | 'sector';
export const CATEGORY_DETAIL_FILTERS: Record<SubaybayanCategory, DetailKey[]> = {
  infrastructure: ['sub', 'type', 'mode'],
  community: ['sub', 'program', 'sector'],
  health: ['sub', 'program', 'sector'],
  environment: ['sub', 'program'],
  disaster: ['sub', 'type', 'mode'],
  uncategorized: ['type', 'sector'],
};
export const DETAIL_FIELD: Record<DetailKey, keyof IndexRow> = {
  sub: 'sector_subcategory',
  type: 'project_type',
  mode: 'mode_of_implementation',
  program: 'program',
  sector: 'sector',
};
export const DETAIL_LABELS: Record<DetailKey, string> = {
  sub: 'Subcategory',
  type: 'Project type',
  mode: 'Mode of implementation',
  program: 'Program',
  sector: 'Sector',
};

export interface SubaybayanFilters {
  q: string;
  category: SubaybayanCategory | '';
  source: SubaybayanDataset | '';
  region: string;
  province: string;
  city: string;
  year: number | null;
  status: SubaybayanStatus | '';
  /** Include municipality/province-centroid locations (default true). */
  approx: boolean;
  sub: string;
  type: string;
  mode: string;
  program: string;
  sector: string;
}

export const EMPTY_FILTERS: SubaybayanFilters = {
  q: '', category: '', source: '', region: '', province: '', city: '', year: null, status: '', approx: true,
  sub: '', type: '', mode: '', program: '', sector: '',
};

const MAX_TEXT = 200;
// Letters (any script), digits, spaces and the punctuation found in place names, programs and sectors.
const SAFE_TEXT = /^[\p{L}\p{N}\s.,'’()&/:%#°\-–]*$/u;

export type ParseResult = { ok: true; filters: SubaybayanFilters } | { ok: false; error: string };

/** Parses and validates map query parameters. Unknown parameters are ignored. */
export function parseSubaybayanQuery(params: URLSearchParams): ParseResult {
  const f: SubaybayanFilters = { ...EMPTY_FILTERS };
  const text = (key: string, label: string): string | { error: string } => {
    const raw = params.get(key);
    if (raw === null) return '';
    const v = raw.trim();
    if (v.length > MAX_TEXT) return { error: `${label} is too long (at most ${MAX_TEXT} characters).` };
    if (!SAFE_TEXT.test(v)) return { error: `${label} contains characters that are not allowed.` };
    return v;
  };
  for (const [key, label] of [['q', 'Search'], ['region', 'Region'], ['province', 'Province'], ['city', 'City / municipality'], ['sub', 'Subcategory'], ['type', 'Project type'], ['mode', 'Mode of implementation'], ['program', 'Program'], ['sector', 'Sector']] as const) {
    const v = text(key, label);
    if (typeof v !== 'string') return { ok: false, error: v.error };
    f[key] = v;
  }

  const category = params.get('category');
  if (category) {
    if (!(SUBAYBAYAN_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'Unknown category.' };
    f.category = category as SubaybayanCategory;
  }
  const source = params.get('source');
  if (source) {
    if (!(SUBAYBAYAN_DATASETS as readonly string[]).includes(source)) return { ok: false, error: 'Unknown source.' };
    f.source = source as SubaybayanDataset;
  }
  const status = params.get('status');
  if (status) {
    if (!(SUBAYBAYAN_STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Unknown status.' };
    f.status = status as SubaybayanStatus;
  }
  const year = params.get('year');
  if (year) {
    if (!/^\d{4}$/.test(year) || Number(year) < 1990 || Number(year) > 2100) return { ok: false, error: 'Funding year must be a four-digit year.' };
    f.year = Number(year);
  }
  const approx = params.get('approx');
  if (approx !== null && approx !== '') {
    if (approx !== '0' && approx !== '1') return { ok: false, error: 'approx must be 0 or 1.' };
    f.approx = approx === '1';
  }

  // Place filters cascade: a province needs its region, a city its province.
  if (f.province && !f.region) return { ok: false, error: 'Choose a region before a province.' };
  if (f.city && !f.province) return { ok: false, error: 'Choose a province before a city or municipality.' };

  // Category-specific filters only apply to the selected category.
  const allowed = new Set<DetailKey>(f.category ? CATEGORY_DETAIL_FILTERS[f.category] : []);
  for (const key of Object.keys(DETAIL_FIELD) as DetailKey[]) {
    if (f[key] && !allowed.has(key)) return { ok: false, error: `${DETAIL_LABELS[key]} filter needs a category that uses it.` };
  }
  return { ok: true, filters: f };
}

/** Filter state → query string (only non-default values), for links and fetches. */
export function filtersToParams(f: SubaybayanFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.category) p.set('category', f.category);
  if (f.source) p.set('source', f.source);
  if (f.region) p.set('region', f.region);
  if (f.province) p.set('province', f.province);
  if (f.city) p.set('city', f.city);
  if (f.year !== null) p.set('year', String(f.year));
  if (f.status) p.set('status', f.status);
  if (!f.approx) p.set('approx', '0');
  for (const key of Object.keys(DETAIL_FIELD) as DetailKey[]) if (f[key]) p.set(key, f[key]);
  return p;
}

/** Changing category keeps global filters and resets only the category-specific ones. */
export function withCategory(f: SubaybayanFilters, category: SubaybayanCategory | ''): SubaybayanFilters {
  return { ...f, category, sub: '', type: '', mode: '', program: '', sector: '' };
}

type FilterKey = keyof SubaybayanFilters;

/** True when the row passes every filter except those in `skip` (for facet counts). */
export function matches(r: IndexRow, f: SubaybayanFilters, skip: ReadonlySet<FilterKey> = new Set()): boolean {
  const on = (k: FilterKey) => !skip.has(k);
  if (on('category') && f.category && r.sector_category !== f.category) return false;
  if (on('source') && f.source && r.source_dataset !== f.source) return false;
  if (on('region') && f.region && r.region !== f.region) return false;
  if (on('province') && f.province && r.province !== f.province) return false;
  if (on('city') && f.city && r.citymun !== f.city) return false;
  if (on('year') && f.year !== null && r.funding_year !== f.year) return false;
  if (on('status') && f.status && r.status !== f.status) return false;
  for (const key of Object.keys(DETAIL_FIELD) as DetailKey[]) {
    if (on(key) && f[key] && r[DETAIL_FIELD[key]] !== f[key]) return false;
  }
  if (on('q') && f.q) {
    const needle = f.q.toLowerCase();
    if (!r.title.toLowerCase().includes(needle) && !(r.project_code ?? '').toLowerCase().includes(needle) && r.id.toLowerCase() !== needle) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Points payload: columns, not objects, to keep ~41k markers small.

const CAT_INDEX = new Map(SUBAYBAYAN_CATEGORIES.map((c, i) => [c, i]));
const PREC_INDEX = new Map(LOCATION_PRECISIONS.map((c, i) => [c, i]));
const STATUS_INDEX = new Map(SUBAYBAYAN_STATUSES.map((c, i) => [c, i]));
const DATASET_INDEX = new Map(SUBAYBAYAN_DATASETS.map((c, i) => [c, i]));

export interface PointsPayload {
  /** Rows matching every filter except the approximate-location toggle. */
  total: number;
  counts: { barangay: number; approximate: number; unmapped: number };
  /** Rows in the columns below: mapped markers (approximate ones only when approx is on) plus unmapped rows (lat null). */
  rows: number;
  columns: {
    id: string[];
    lat: (number | null)[];
    lng: (number | null)[];
    /** Index into SUBAYBAYAN_CATEGORIES / LOCATION_PRECISIONS / SUBAYBAYAN_STATUSES / SUBAYBAYAN_DATASETS. */
    category: number[];
    precision: number[];
    status: number[];
    dataset: number[];
    year: (number | null)[];
    /** Whole pesos. */
    cost: (number | null)[];
  };
}

export function buildPoints(index: readonly IndexRow[], f: SubaybayanFilters): PointsPayload {
  const out: PointsPayload = {
    total: 0,
    counts: { barangay: 0, approximate: 0, unmapped: 0 },
    rows: 0,
    columns: { id: [], lat: [], lng: [], category: [], precision: [], status: [], dataset: [], year: [], cost: [] },
  };
  const c = out.columns;
  for (const r of index) {
    if (!matches(r, f)) continue;
    out.total++;
    const approximate = r.location_precision === 'municipality_centroid' || r.location_precision === 'province_centroid';
    if (r.location_precision === 'barangay_centroid') out.counts.barangay++;
    else if (approximate) out.counts.approximate++;
    else out.counts.unmapped++;
    if (approximate && !f.approx) continue;
    c.id.push(r.id);
    c.lat.push(r.latitude === null ? null : Math.round(r.latitude * 1e5) / 1e5);
    c.lng.push(r.longitude === null ? null : Math.round(r.longitude * 1e5) / 1e5);
    c.category.push(CAT_INDEX.get(r.sector_category)!);
    c.precision.push(PREC_INDEX.get(r.location_precision)!);
    c.status.push(STATUS_INDEX.get(r.status)!);
    c.dataset.push(DATASET_INDEX.get(r.source_dataset)!);
    c.year.push(r.funding_year);
    c.cost.push(r.total_cost === null ? null : Math.round(r.total_cost));
    out.rows++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Facets: each list is counted with every OTHER filter applied, so options
// never lead to an empty result and counts match what choosing them shows.

export interface FacetValue {
  value: string;
  count: number;
}

export interface FacetsPayload {
  total: number;
  categories: FacetValue[];
  sources: FacetValue[];
  regions: FacetValue[];
  provinces: FacetValue[];
  cities: FacetValue[];
  years: FacetValue[];
  statuses: FacetValue[];
  /** Only for the selected category's own filters. */
  details: Partial<Record<DetailKey, FacetValue[]>>;
}

function countBy(index: readonly IndexRow[], f: SubaybayanFilters, skip: FilterKey[], value: (r: IndexRow) => string | number | null): FacetValue[] {
  const skipSet = new Set(skip);
  const m = new Map<string, number>();
  for (const r of index) {
    if (!matches(r, f, skipSet)) continue;
    const v = value(r);
    if (v === null || v === '') continue;
    const k = String(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([value, count]) => ({ value, count }));
}

const byCount = (a: FacetValue, b: FacetValue) => b.count - a.count || a.value.localeCompare(b.value);
const byValue = (a: FacetValue, b: FacetValue) => a.value.localeCompare(b.value);

export function buildFacets(index: readonly IndexRow[], f: SubaybayanFilters): FacetsPayload {
  const details: FacetsPayload['details'] = {};
  if (f.category) {
    for (const key of CATEGORY_DETAIL_FILTERS[f.category]) {
      details[key] = countBy(index, f, [key], (r) => r[DETAIL_FIELD[key]] as string | null).sort(byCount);
    }
  }
  return {
    total: index.reduce((n, r) => n + (matches(r, f) ? 1 : 0), 0),
    categories: countBy(index, f, ['category', 'sub', 'type', 'mode', 'program', 'sector'], (r) => r.sector_category).sort(byCount),
    sources: countBy(index, f, ['source'], (r) => r.source_dataset).sort(byCount),
    regions: countBy(index, f, ['region', 'province', 'city'], (r) => r.region).sort(byValue),
    provinces: f.region ? countBy(index, f, ['province', 'city'], (r) => r.province).sort(byValue) : [],
    cities: f.province ? countBy(index, f, ['city'], (r) => r.citymun).sort(byValue) : [],
    years: countBy(index, f, ['year'], (r) => r.funding_year).sort((a, b) => Number(b.value) - Number(a.value)),
    statuses: countBy(index, f, ['status'], (r) => r.status).sort(byCount),
    details,
  };
}

/** Public detail fields (everything the panel shows; no internal hashes). */
export const DETAIL_COLUMNS = [
  'id', 'source_agency', 'source_dataset', 'project_code', 'title', 'sector_category', 'sector_subcategory', 'classification_reason',
  'region', 'province', 'citymun', 'barangay', 'psgc_region', 'psgc_province', 'psgc_citymun', 'psgc_barangay',
  'latitude', 'longitude', 'location_precision', 'funding_year', 'status', 'status_raw', 'project_type', 'program', 'sector',
  'mode_of_implementation', 'total_cost', 'total_cost_reported', 'total_cost_basis', 'national_subsidy', 'lgu_counterpart', 'owpa', 'contractor', 'project_owner',
  'approval_status', 'geotagged_photos', 'size_text', 'beneficiaries_text', 'component_details', 'start_date', 'end_date',
  'source_file', 'source_row', 'source_url', 'retrieved_at',
] as const;

/** Which amount total_cost holds when the reported total was not used (see scripts/subaybayan/lib/extract.ts). */
export type CostBasis = 'contract_amount' | 'subsidy_plus_counterpart';

export type SubaybayanDetail = {
  [K in (typeof DETAIL_COLUMNS)[number]]: K extends 'id' | 'title' | 'source_agency' | 'classification_reason' | 'source_url' | 'retrieved_at'
    ? string
    : K extends 'total_cost_basis'
    ? CostBasis | null
    : K extends 'latitude' | 'longitude' | 'total_cost' | 'total_cost_reported' | 'national_subsidy' | 'lgu_counterpart' | 'owpa'
    ? number | null
    : K extends 'funding_year' | 'geotagged_photos' | 'source_row'
      ? number | null
      : K extends 'sector_category'
        ? SubaybayanCategory
        : K extends 'status'
          ? SubaybayanStatus
          : K extends 'location_precision'
            ? LocationPrecision
            : K extends 'source_dataset'
              ? SubaybayanDataset
              : string | null;
};

/** List rows (titles for the panel); fetched for the visible page only. */
export interface SubaybayanSummary {
  id: string;
  project_code: string | null;
  title: string;
  sector_category: SubaybayanCategory;
  sector_subcategory: string | null;
  citymun: string | null;
  province: string | null;
  barangay: string | null;
  location_precision: LocationPrecision;
  status: SubaybayanStatus;
  funding_year: number | null;
  total_cost: number | null;
  /** Non-null when total_cost is not the reported total. */
  total_cost_basis: CostBasis | null;
  source_dataset: SubaybayanDataset;
}

export const SUMMARY_COLUMNS = [
  'id', 'project_code', 'title', 'sector_category', 'sector_subcategory', 'citymun', 'province', 'barangay',
  'location_precision', 'status', 'funding_year', 'total_cost', 'total_cost_basis', 'source_dataset',
] as const;

export const MAX_SUMMARY_IDS = 60;
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

/** "a,b,c" → validated unique ids, or an error. */
export function parseIds(raw: string | null): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!raw) return { ok: false, error: 'ids is required.' };
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: 'ids is required.' };
  if (ids.length > MAX_SUMMARY_IDS) return { ok: false, error: `At most ${MAX_SUMMARY_IDS} ids per request.` };
  if (!ids.every((id) => ID_PATTERN.test(id))) return { ok: false, error: 'Invalid project id.' };
  return { ok: true, ids };
}
