import { applyDirectoryFilters, applyDirectoryQuery, parseDirectoryQuery, type FilterBuilder } from '@/lib/integrations/dpwh/nationwide/query';
import { PROJECT_SOURCES, PROJECT_SOURCE_IDS, agencyOf, projectHref, sourceLabel, subaybayanDataset } from '@/lib/integrations/bettergov/sources';
import { SUBAYBAYAN_CATEGORY_LABELS, isSubaybayanCategory } from '@/lib/subaybayan/categories';
import { DPWH_CATEGORY_LABELS, DPWH_STATUS_LABELS, type DpwhCategory, type DpwhDirectoryStats, type DpwhStatus } from '@/types/dpwh';

/**
 * Read-only data access for BP, the LGU Tracker assistant. Two predefined
 * queries, nothing else: the cached directory summary and one page of the
 * existing project directory search. Every parameter the model supplies goes
 * through parseDirectoryQuery, the same validator as /api/dpwh/contracts, and
 * the query is built with PostgREST filters, so no SQL is ever generated.
 *
 * Runs with the caller's Supabase client (publishable key, RLS applies).
 */

/** Most records one search returns to the model. */
export const BP_MAX_RESULTS = 8;

/** The subset of a Supabase client used here, so tests can pass a fake. */
export interface BpSupabase {
  from(table: string): unknown;
}

type QueryResult = { data: unknown[] | null; error: { message: string } | null; count: number | null };
type ListBuilder = FilterBuilder<ListBuilder> & PromiseLike<QueryResult>;
interface SelectBuilder {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): ListBuilder;
}
type SingleBuilder = { eq(column: string, value: number): { maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }> } };
const table = (supabase: BpSupabase, name: string) => supabase.from(name) as SelectBuilder;

const label = (map: Record<string, string>, value: string | null) => (value === null ? 'Not reported' : map[value] ?? value);

export interface DirectoryOverview {
  data_computed_at: string | null;
  last_successful_sync_at: string | null;
  dpwh_contracts: {
    total_contracts: number;
    reported_contract_amount_sum_php: number;
    contracts_with_reported_amount: number;
    by_region: { region: string; contracts: number }[];
    by_category: { category: string; category_id: string; contracts: number }[];
    by_status: { status: string; status_id: string; contracts: number }[];
    by_infra_year: { year: number | string; contracts: number }[];
    provinces: { province: string; contracts: number }[];
  } | null;
  other_sources: { source: string; label: string; description: string; records: number | null }[];
}

export type BpResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Cached totals (refreshed by the database after each sync) plus record counts of the other sources. */
export async function getDirectoryOverview(supabase: BpSupabase): Promise<BpResult<DirectoryOverview>> {
  const others = PROJECT_SOURCE_IDS.filter((s) => s !== 'dpwh_contracts');
  const [statsRes, ...countRes] = await Promise.all([
    (table(supabase, 'dpwh_directory_stats').select('computed_at, last_successful_sync_at, stats') as unknown as SingleBuilder)
      .eq('id', 1)
      .maybeSingle(),
    ...others.map((source) => {
      const dataset = subaybayanDataset(source);
      return dataset
        ? table(supabase, 'subaybayan_projects').select('id', { count: 'exact', head: true }).eq('source_dataset', dataset)
        : table(supabase, 'infrastructure_projects').select('source_id', { count: 'exact', head: true }).eq('source', source);
    }),
  ]);
  if (statsRes.error) return { ok: false, error: 'database_error' };

  const row = statsRes.data as { computed_at: string; last_successful_sync_at: string | null; stats: DpwhDirectoryStats } | null;
  const s = row?.stats;
  const provinces = new Map<string, number>();
  for (const p of s?.provinces ?? []) provinces.set(p.province, (provinces.get(p.province) ?? 0) + p.count);

  return {
    ok: true,
    data: {
      data_computed_at: row?.computed_at ?? null,
      last_successful_sync_at: row?.last_successful_sync_at ?? null,
      dpwh_contracts: s
        ? {
            total_contracts: s.total_contracts,
            reported_contract_amount_sum_php: Number(s.contract_amount.sum),
            contracts_with_reported_amount: s.contract_amount.contracts_with_value,
            by_region: s.by_region.map((r) => ({ region: r.value ?? 'Not reported', contracts: r.count })),
            by_category: s.by_category.map((c) => ({ category: label(DPWH_CATEGORY_LABELS, c.value), category_id: c.value, contracts: c.count })),
            by_status: s.by_status.map((c) => ({ status: label(DPWH_STATUS_LABELS, c.value), status_id: c.value, contracts: c.count })),
            by_infra_year: s.infra_years.map((y) => ({ year: y.value ?? 'Not reported', contracts: y.count })),
            provinces: [...provinces].map(([province, contracts]) => ({ province, contracts })).sort((a, b) => b.contracts - a.contracts),
          }
        : null,
      other_sources: others.map((source, i) => ({
        source,
        label: PROJECT_SOURCES[source].label,
        description: PROJECT_SOURCES[source].description,
        records: countRes[i].error ? null : countRes[i].count,
      })),
    },
  };
}

export interface SearchArgs {
  query?: unknown;
  region?: unknown;
  province?: unknown;
  category?: unknown;
  status?: unknown;
  source?: unknown;
  agency?: unknown;
  sector?: unknown;
  contractor?: unknown;
  sort?: unknown;
  limit?: unknown;
}

/** One record as shown to the model and, as a reference link, to the user. */
export interface BpRecord {
  source: string;
  source_label: string;
  /** DPWH or DILG. */
  agency: string;
  record_id: string;
  title: string;
  href: string;
  region: string | null;
  province: string | null;
  category: string;
  status: string;
  status_id: DpwhStatus | null;
  amount_php: number | null;
  amount_label: string;
  /** DILG: the total is extreme for its kind of project and has not been verified. */
  amount_not_verified: boolean;
  /** DILG: LGU Tracker classification (Infrastructure, Community, ...), null for DPWH. */
  dilg_category: string | null;
  dilg_subcategory: string | null;
  progress_percent: number | null;
  implementing_office: string | null;
  contractor: string | null;
  start_date: string | null;
  completion_date: string | null;
  infra_year: number | null;
}

export interface SearchResult {
  /** Exact number of matching records, or null when the count query failed or timed out. */
  total_matches: number | null;
  shown: number;
  sorted_by: string;
  filters: Record<string, string>;
  records: BpRecord[];
}

const SEARCH_COLUMNS = [
  'source', 'record_id', 'title', 'contract_name', 'region', 'province', 'category', 'status', 'contract_amount',
  'budget', 'amount_label', 'progress', 'implementing_office', 'contractor', 'start_date', 'completion_date', 'infra_year',
  'agency', 'total_cost', 'amount_needs_review', 'sector_category', 'sector_subcategory',
].join(',');

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Model-supplied arguments → validated directory query (rejects unknown categories, statuses, sorts). */
export function toDirectoryParams(args: SearchArgs): URLSearchParams {
  const p = new URLSearchParams();
  const set = (key: string, value: unknown) => str(value) && p.set(key, str(value));
  set('q', args.query);
  set('region', args.region);
  set('province', args.province);
  set('category', args.category);
  set('status', args.status);
  set('source', args.source);
  set('agency', args.agency);
  set('sector', args.sector);
  set('contractor', args.contractor);
  set('sort', args.sort);
  const limit = Math.trunc(Number(args.limit));
  p.set('pageSize', String(Number.isFinite(limit) ? Math.min(BP_MAX_RESULTS, Math.max(1, limit)) : 5));
  return p;
}

export async function searchProjects(supabase: BpSupabase, args: SearchArgs): Promise<BpResult<SearchResult>> {
  const parsed = parseDirectoryQuery(toDirectoryParams(args));
  if (!parsed.ok) return { ok: false, error: `invalid_arguments: ${parsed.error}` };
  const query = parsed.query;

  // Separate count request, as in /api/dpwh/contracts. A failed count (for
  // example a statement timeout on a rare filter) only drops the total.
  const [list, count] = await Promise.all([
    applyDirectoryQuery(table(supabase, 'project_directory').select(SEARCH_COLUMNS), query, ['source', 'record_id']),
    applyDirectoryFilters(table(supabase, 'project_directory').select('record_id', { count: 'exact', head: true }), query),
  ]);
  if (list.error) return { ok: false, error: 'database_error' };

  const records = ((list.data ?? []) as Record<string, unknown>[]).map((r): BpRecord => {
    const source = String(r.source);
    const isContract = source === 'dpwh_contracts';
    const agency = String(r.agency ?? agencyOf(source) ?? 'DPWH');
    const isDilg = agency === 'DILG';
    const status = (r.status as DpwhStatus | null) ?? null;
    const sector = isSubaybayanCategory(r.sector_category) ? r.sector_category : null;
    return {
      source,
      source_label: sourceLabel(source),
      agency,
      record_id: String(r.record_id),
      title: String(r.contract_name ?? r.title ?? r.record_id),
      href: projectHref(source, String(r.record_id)),
      region: (r.region as string | null) ?? null,
      province: (r.province as string | null) ?? null,
      category: label(DPWH_CATEGORY_LABELS, (r.category as DpwhCategory | null) ?? null),
      status: label(DPWH_STATUS_LABELS, status),
      status_id: status,
      amount_php: num(isContract ? r.contract_amount : isDilg ? r.total_cost : r.budget),
      amount_label: String(r.amount_label ?? (isContract ? 'Contract amount' : 'Amount')),
      amount_not_verified: r.amount_needs_review === true,
      dilg_category: sector ? SUBAYBAYAN_CATEGORY_LABELS[sector] : null,
      dilg_subcategory: isDilg ? ((r.sector_subcategory as string | null) ?? null) : null,
      progress_percent: isContract || isDilg ? num(r.progress) : null,
      implementing_office: (r.implementing_office as string | null) ?? null,
      contractor: (r.contractor as string | null) ?? null,
      start_date: (r.start_date as string | null) ?? null,
      completion_date: (r.completion_date as string | null) ?? null,
      infra_year: num(r.infra_year),
    };
  });

  const filters: Record<string, string> = {};
  for (const key of ['q', 'region', 'province', 'category', 'status', 'source', 'agency', 'sector', 'contractor'] as const) {
    if (query[key]) filters[key === 'q' ? 'query' : key] = String(query[key]);
  }
  return {
    ok: true,
    data: { total_matches: count.error ? null : count.count, shown: records.length, sorted_by: query.sort, filters, records },
  };
}
