import { DPWH_CATEGORIES, DPWH_STATUSES, type DpwhCategory, type DpwhStatus } from '@/types/dpwh';
import { isProjectSource, type ProjectSource } from '@/lib/integrations/bettergov/sources';

/**
 * Parses and validates directory query parameters, and applies them to a
 * Supabase (PostgREST) query. Pure apart from the builder passed in, so it
 * can be tested with a recording fake.
 */

/** Each sort is a list of [column, ascending] pairs, applied in order. */
export const DPWH_SORTS = {
  'contract_amount-desc': [['contract_amount', false]],
  'contract_amount-asc': [['contract_amount', true]],
  'budget-desc': [['budget', false]],
  'budget-asc': [['budget', true]],
  'progress-desc': [['progress', false]],
  'progress-asc': [['progress', true]],
  'start_date-desc': [['start_date', false]],
  'start_date-asc': [['start_date', true]],
  'contract_date-desc': [['contract_effectivity_date', false]],
  'contract_date-asc': [['contract_effectivity_date', true]],
  'location-asc': [['region', true], ['province', true]],
  'location-desc': [['region', false], ['province', false]],
  'title-asc': [['title', true]],
  'title-desc': [['title', false]],
} as const satisfies Record<string, readonly (readonly [string, boolean])[]>;
export type DpwhSort = keyof typeof DPWH_SORTS;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface DirectoryQuery {
  q: string | null;
  region: string | null;
  province: string | null;
  municipality: string | null;
  category: DpwhCategory | null;
  status: DpwhStatus | null;
  contractor: string | null;
  office: string | null;
  /** project_directory only: limit to one source. */
  source: ProjectSource | null;
  sort: DpwhSort;
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['region', 'province', 'municipality', 'contractor', 'office'] as const;

function cleanParam(value: string | null, max = 200): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.length > max ? null : trimmed;
}

export function parseDirectoryQuery(params: URLSearchParams): { ok: true; query: DirectoryQuery } | { ok: false; error: string } {
  const query: DirectoryQuery = {
    q: null, region: null, province: null, municipality: null, category: null, status: null,
    contractor: null, office: null, source: null, sort: 'contract_amount-desc', page: 1, pageSize: DEFAULT_PAGE_SIZE,
  };

  const q = params.get('q');
  if (q !== null && q.trim() !== '') {
    if (q.length > 200) return { ok: false, error: 'Search text must be 200 characters or fewer.' };
    query.q = q.trim();
  }
  for (const key of FILTER_KEYS) {
    const raw = params.get(key);
    if (raw !== null && raw.trim() !== '' && cleanParam(raw) === null) return { ok: false, error: `${key} is too long.` };
    query[key] = cleanParam(raw);
  }

  const category = params.get('category');
  if (category) {
    if (!(DPWH_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'Unknown category.' };
    query.category = category as DpwhCategory;
  }
  const status = params.get('status');
  if (status) {
    if (!(DPWH_STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Unknown status.' };
    query.status = status as DpwhStatus;
  }
  const source = params.get('source');
  if (source) {
    if (!isProjectSource(source)) return { ok: false, error: 'Unknown source.' };
    query.source = source;
  }
  const sort = params.get('sort');
  if (sort) {
    if (!(sort in DPWH_SORTS)) return { ok: false, error: 'Unknown sort.' };
    query.sort = sort as DpwhSort;
  }
  const page = params.get('page');
  if (page !== null) {
    const n = Number(page);
    if (!Number.isInteger(n) || n < 1 || n > 100_000) return { ok: false, error: 'page must be a positive integer.' };
    query.page = n;
  }
  const pageSize = params.get('pageSize');
  if (pageSize !== null) {
    const n = Number(pageSize);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) return { ok: false, error: `pageSize must be 1-${MAX_PAGE_SIZE}.` };
    query.pageSize = n;
  }
  return { ok: true, query };
}

/**
 * Prefix full-text query over the generated `search` column: each word must
 * match the start of a token. Only letters and digits are kept, so user
 * input can never inject tsquery operators.
 */
export function toPrefixTsQuery(q: string): string | null {
  const tokens = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8).map((t) => t.slice(0, 40));
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null;
}

/** Contractor names are matched by case-insensitive prefix. */
export function toContractorPrefix(contractor: string): string | null {
  const cleaned = contractor.toUpperCase().replace(/[%_*\\]/g, '').trim();
  return cleaned ? `${cleaned}%` : null;
}

/** The subset of the PostgREST filter builder this module uses. */
export interface FilterBuilder<T> {
  eq(column: string, value: string): T;
  contains(column: string, value: string[]): T;
  ilike(column: string, pattern: string): T;
  textSearch(column: string, query: string, options: { config: string }): T;
  order(column: string, options: { ascending: boolean; nullsFirst: boolean }): T;
  range(from: number, to: number): T;
}

/** WHERE clauses only (search and filters); shared by the directory and the map. */
export function applyDirectoryFilters<T extends FilterBuilder<T>>(builder: T, query: DirectoryQuery): T {
  let b = builder;
  if (query.q) {
    const tsquery = toPrefixTsQuery(query.q);
    if (tsquery) b = b.textSearch('search', tsquery, { config: 'simple' });
  }
  if (query.region) b = b.eq('region', query.region);
  if (query.province) b = b.contains('provinces', [query.province]);
  if (query.municipality) b = b.eq('municipality', query.municipality);
  if (query.category) b = b.eq('category', query.category);
  if (query.status) b = b.eq('status', query.status);
  if (query.office) b = b.eq('implementing_office', query.office);
  if (query.source) b = b.eq('source', query.source);
  if (query.contractor) {
    const pattern = toContractorPrefix(query.contractor);
    if (pattern) b = b.ilike('contractor', pattern);
  }
  return b;
}

/**
 * `keyColumns` must identify a row uniquely: ['contract_id'] for
 * dpwh_contracts_directory, ['source', 'record_id'] for project_directory.
 */
export function applyDirectoryQuery<T extends FilterBuilder<T>>(
  builder: T,
  query: DirectoryQuery,
  keyColumns: readonly string[] = ['contract_id']
): T {
  let b = applyDirectoryFilters(builder, query);
  for (const [column, ascending] of DPWH_SORTS[query.sort]) {
    b = b.order(column, { ascending, nullsFirst: false });
  }
  // Tie-breaker keeps pagination stable.
  for (const column of keyColumns) b = b.order(column, { ascending: true, nullsFirst: false });
  const from = (query.page - 1) * query.pageSize;
  return b.range(from, from + query.pageSize - 1);
}

// -----------------------------------------------------------------------------
// Map: contracts with coordinates inside a viewport
// -----------------------------------------------------------------------------

/**
 * Most markers one map request returns; the largest contracts win when more
 * match. Must not exceed PostgREST's max_rows (1000, supabase/config.toml),
 * which silently truncates larger responses.
 */
export const MAP_POINT_LIMIT = 1000;

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Parses "west,south,east,north" (degrees). Viewports crossing the antimeridian are not supported. */
export function parseBounds(raw: string | null): { ok: true; bounds: MapBounds | null } | { ok: false; error: string } {
  if (raw === null || raw.trim() === '') return { ok: true, bounds: null };
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'bbox must be four numbers: west,south,east,north.' };
  }
  const [west, south, east, north] = parts;
  if (south < -90 || north > 90 || south > north || west < -180 || east > 180 || west > east) {
    return { ok: false, error: 'bbox is out of range.' };
  }
  return { ok: true, bounds: { west, south, east, north } };
}

export interface MapBuilder<T> extends FilterBuilder<T> {
  gte(column: string, value: number): T;
  lte(column: string, value: number): T;
  not(column: string, operator: string, value: null): T;
  limit(count: number): T;
}

/** WHERE clauses of the map: directory filters, mapped contracts only, inside the viewport. */
export function applyMapFilters<T extends MapBuilder<T>>(builder: T, query: DirectoryQuery, bounds: MapBounds | null): T {
  let b = applyDirectoryFilters(builder, query).not('latitude', 'is', null).not('longitude', 'is', null);
  if (bounds) {
    b = b.gte('latitude', bounds.south).lte('latitude', bounds.north)
      .gte('longitude', bounds.west).lte('longitude', bounds.east);
  }
  return b;
}

export function applyMapQuery<T extends MapBuilder<T>>(builder: T, query: DirectoryQuery, bounds: MapBounds | null): T {
  return applyMapFilters(builder, query, bounds)
    .order('contract_amount', { ascending: false, nullsFirst: false })
    .order('contract_id', { ascending: true, nullsFirst: false })
    .limit(MAP_POINT_LIMIT);
}
