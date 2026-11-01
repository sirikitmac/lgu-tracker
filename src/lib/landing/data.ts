import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/env';
import { DEFAULT_SCOPE_REGIONS } from '@/lib/integrations/dpwh/nationwide/scope';
import type { DpwhCategory, DpwhStatus } from '@/types/dpwh';

/**
 * Live figures for the public landing page. Everything here is read with the
 * publishable key and no session (public tables under RLS), so the page can
 * be prerendered and revalidated instead of rendered per request.
 *
 * Every field is null when Supabase is not configured or a query fails: the
 * page then describes the coverage in words and never shows a made-up count.
 *
 * The page is prerendered during `next build` (and revalidated hourly), so
 * nothing here may throw or hang: query errors (including the anon statement
 * timeout) come back as `error` and fall back, each request is aborted after
 * REQUEST_TIMEOUT_MS, and the whole load gives up after LOAD_DEADLINE_MS,
 * well inside Next's 60 s static-generation limit. A deploy therefore never
 * fails because the database is slow; the page shows the fallback until the
 * next revalidation.
 */

/** Mapped contracts plotted per region on the coverage map (largest contract amounts first). */
export const POINTS_PER_REGION = 300;

/** Abort any single landing query after this long (the anon statement timeout is 3 s). */
export const REQUEST_TIMEOUT_MS = 8_000;
/** Give up on the whole load (and render the fallback) after this long. */
export const LOAD_DEADLINE_MS = 30_000;

/** fetch with a per-request timeout, keeping any caller signal. */
export function fetchWithTimeout(timeoutMs: number, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return base(input, { ...init, signal });
  };
}

/** Shown in "How it works": an ongoing bridge replacement in Linamon, next to Iligan City. */
export const EXAMPLE_CONTRACT_ID = '25KG0033';

export interface ExampleContract {
  contract_id: string;
  title: string;
  province: string | null;
  region: string | null;
  category: DpwhCategory;
  status: DpwhStatus;
  contractor: string | null;
  contract_amount: number | null;
  progress: number | null;
  start_date: string | null;
  implementing_office: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LandingData {
  totalContracts: number | null;
  totalAmount: number | null;
  ongoingContracts: number | null;
  completedContracts: number | null;
  /** Stats refresh time (ISO), shown as "figures as of". */
  computedAt: string | null;
  /**
   * In scope order; counts are null when the stats could not be read. Points
   * are [longitude, latitude] of the region's largest mapped contracts.
   */
  regions: { region: string; contracts: number | null; points: [number, number][] }[];
  nepProposals: number | null;
  example: ExampleContract | null;
  /** DILG SubayBAYAN projects stored (both datasets), or null when unreadable. */
  dilgProjects: number | null;
  /**
   * Regions with at least one stored record, DPWH and DILG together, keyed by
   * region number (see canonicalRegion). Null unless both sides were read, so
   * a partial answer is never shown as the whole.
   */
  regionsCovered: number | null;
  /**
   * Published datasets with at least one stored record: DPWH contracts, the
   * FY 2027 NEP, and the two SubayBAYAN datasets. Null when none could be read.
   */
  datasets: { label: string; records: number }[] | null;
}

function publicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout(REQUEST_TIMEOUT_MS) },
  });
}

async function loadStats(supabase: SupabaseClient) {
  const { data, error, status } = await supabase
    .from('dpwh_directory_stats')
    .select('computed_at, stats')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[LGU Tracker] Landing stats query failed:', describeError(error, status));
    return null;
  }
  return data as {
    computed_at: string;
    stats: {
      total_contracts: number;
      contract_amount: { sum: number };
      by_region: { value: string | null; count: number }[];
      by_status: { value: DpwhStatus; count: number }[];
    };
  };
}

/**
 * All regions, a few at a time: thirteen parallel ordered scans on the Free
 * plan's small instance can push one past the anon statement timeout. A
 * region that still fails gets one more try, then is drawn without dots.
 */
async function loadAllRegionPoints(supabase: SupabaseClient): Promise<[number, number][][]> {
  const results: ([number, number][] | null)[] = [];
  for (let i = 0; i < DEFAULT_SCOPE_REGIONS.length; i += 3) {
    const batch = DEFAULT_SCOPE_REGIONS.slice(i, i + 3);
    results.push(...(await Promise.all(batch.map((region) => loadRegionPoints(supabase, region)))));
  }
  for (const [i, region] of DEFAULT_SCOPE_REGIONS.entries()) {
    if (results[i] === null) results[i] = await loadRegionPoints(supabase, region);
  }
  return results.map((points) => points ?? []);
}

/** Null when the query failed (so it can be retried); empty when the region has no mapped contracts. */
async function loadRegionPoints(supabase: SupabaseClient, region: string): Promise<[number, number][] | null> {
  const { data, error, status } = await supabase
    .from('dpwh_contracts_directory')
    .select('latitude, longitude')
    .eq('region', region)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('contract_amount', { ascending: false, nullsFirst: false })
    .limit(POINTS_PER_REGION);
  if (error || !data) {
    if (error) console.error(`[LGU Tracker] Landing map points for ${region} failed:`, describeError(error, status));
    return null;
  }
  return (data as { latitude: number; longitude: number }[]).map((p) => [p.longitude, p.latitude]);
}

async function loadNepCount(supabase: SupabaseClient): Promise<number | null> {
  return exactCount('NEP count', () =>
    supabase.from('project_directory').select('record_id', { count: 'exact', head: true }).eq('source', 'dpwh_nep_2027')
  );
}

/**
 * A PostgREST error as one log line. Count queries are HEAD requests, and a
 * HEAD response has no body, so a statement timeout arrives as a bare 500
 * with an empty message; the status (and code, when there is a body) is what
 * tells the cases apart.
 */
export function describeError(error: { message?: string; code?: string; details?: string | null; hint?: string | null }, status?: number): string {
  const parts = [error.message || '(no error body)'];
  if (status) parts.push(`HTTP ${status}`);
  if (error.code) parts.push(`code ${error.code}`);
  if (error.details) parts.push(error.details);
  if (error.hint) parts.push(`hint: ${error.hint}`);
  if (!error.message && !error.code && status === 500) parts.push('a HEAD count with no body is almost always the 3 s anon statement timeout');
  return parts.join(' · ');
}

/**
 * One exact count, retried once: on the Free plan's small instance a cold
 * cache can push a count past the 3 s anon statement timeout, and the retry
 * finds the pages warm. Null when both tries failed.
 */
async function exactCount(label: string, run: () => PromiseLike<{ count: number | null; error: { message: string } | null; status: number }>): Promise<number | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { count, error, status } = await run();
    if (!error && count !== null) return count;
    console.error(`[LGU Tracker] Landing ${label} failed (try ${attempt} of 2):`, error ? describeError(error, status) : `no count (HTTP ${status})`);
  }
  return null;
}

/**
 * SubayBAYAN rows per dataset. Neither count reads the wide table row by row
 * for a filter: the total is a plain count(*), and the smaller LGSF set is
 * counted through project_directory, whose `source` expression is indexed
 * (subaybayan_projects_directory_source_idx). RLIP, most of the table, is the
 * difference, so no query scans the table for it. Filtering source_dataset
 * directly had no index and timed out on a cold cache.
 */
async function loadDilgCounts(supabase: SupabaseClient): Promise<{ lgsf: number | null; rlip: number | null }> {
  const [total, lgsf] = await Promise.all([
    exactCount('DILG count (all)', () => supabase.from('subaybayan_projects').select('id', { count: 'exact', head: true })),
    exactCount('DILG count (lgsf)', () =>
      supabase.from('project_directory').select('record_id', { count: 'exact', head: true }).eq('source', 'subaybayan_lgsf')
    ),
  ]);
  if (total === null || lgsf === null) return { lgsf, rlip: null };
  return { lgsf, rlip: total - lgsf };
}

/** Most distinct regions the skip scan will read; the Philippines has 18. */
const MAX_REGIONS = 30;

/**
 * Distinct SubayBAYAN region labels, read as a skip scan on the (region, …)
 * index: one indexed one-row query per region instead of reading 41k rows.
 * Null when any step fails.
 */
async function loadDilgRegions(supabase: SupabaseClient): Promise<string[] | null> {
  const regions: string[] = [];
  for (let i = 0; i < MAX_REGIONS; i++) {
    let query = supabase.from('subaybayan_projects').select('region').not('region', 'is', null).order('region').limit(1);
    if (regions.length > 0) query = query.gt('region', regions[regions.length - 1]);
    const { data, error, status } = await query;
    if (error || !data) {
      if (error) console.error('[LGU Tracker] Landing DILG regions failed:', describeError(error, status));
      return null;
    }
    if (data.length === 0) return regions;
    regions.push((data[0] as { region: string }).region);
  }
  return regions;
}

const ROMAN = /^REGION\s+([IVX]+(?:-[AB])?)(?![A-Z])/i;

/**
 * One key per region whatever the source's spelling: DPWH writes "Region X",
 * SubayBAYAN "REGION X - NORTHERN MINDANAO"; named regions (NCR, CAR,
 * MIMAROPA, Negros Island, BARMM) are matched by name.
 */
export function canonicalRegion(label: string): string {
  const text = label.trim().toUpperCase();
  const roman = text.match(ROMAN);
  if (roman) return `REGION ${roman[1]}`;
  if (text.includes('NEGROS ISLAND')) return 'NIR';
  if (text.includes('BANGSAMORO') || text.includes('BARMM') || text.includes('ARMM')) return 'BARMM';
  if (text.includes('CORDILLERA') || text === 'CAR') return 'CAR';
  if (text.includes('CAPITAL REGION') || text === 'NCR') return 'NCR';
  if (text.includes('MIMAROPA') || text.includes('IV-B')) return 'MIMAROPA';
  return text;
}

/** Union of DPWH regions with contracts and DILG regions; null unless both are known. */
export function countRegionsCovered(dpwh: { region: string; contracts: number | null }[], dilg: string[] | null): number | null {
  if (dilg === null || dpwh.some((r) => r.contracts === null)) return null;
  const keys = new Set<string>();
  for (const r of dpwh) if ((r.contracts ?? 0) > 0) keys.add(canonicalRegion(r.region));
  for (const label of dilg) keys.add(canonicalRegion(label));
  return keys.size;
}

/** The datasets that hold records; null when no count could be read. */
export function listDatasets(counts: { label: string; records: number | null }[]): { label: string; records: number }[] | null {
  if (counts.every((c) => c.records === null)) return null;
  return counts.filter((c): c is { label: string; records: number } => c.records !== null && c.records > 0);
}

async function loadExample(supabase: SupabaseClient): Promise<ExampleContract | null> {
  const { data, error, status } = await supabase
    .from('dpwh_contracts_directory')
    .select(
      'contract_id, title, province, region, category, status, contractor, contract_amount, progress, start_date, implementing_office, latitude, longitude'
    )
    .eq('contract_id', EXAMPLE_CONTRACT_ID)
    .maybeSingle();
  if (error) console.error('[LGU Tracker] Landing example contract failed:', describeError(error, status));
  return (data as ExampleContract | null) ?? null;
}

/** Landing figures; never throws, and settles within LOAD_DEADLINE_MS (fallback: all nulls). */
export async function loadLandingData(
  { client = publicClient(), deadlineMs = LOAD_DEADLINE_MS }: { client?: SupabaseClient | null; deadlineMs?: number } = {}
): Promise<LandingData> {
  const empty = emptyLandingData();
  if (!client) return empty;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<LandingData>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[LGU Tracker] Landing data took over ${deadlineMs / 1000} s; rendering the fallback.`);
      resolve(empty);
    }, deadlineMs);
  });
  try {
    return await Promise.race([loadFrom(client), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function emptyLandingData(): LandingData {
  return {
    totalContracts: null,
    totalAmount: null,
    ongoingContracts: null,
    completedContracts: null,
    computedAt: null,
    regions: DEFAULT_SCOPE_REGIONS.map((region) => ({ region, contracts: null, points: [] })),
    nepProposals: null,
    example: null,
    dilgProjects: null,
    regionsCovered: null,
    datasets: null,
  };
}

async function loadFrom(supabase: SupabaseClient): Promise<LandingData> {
  const empty = emptyLandingData();
  try {
    // The counts run first, beside the small reads, rather than against the
    // region scans below; the DILG skip scan is a chain of one-row reads and
    // runs beside everything.
    const dilgRegionsLoad = loadDilgRegions(supabase).catch((err) => {
      console.error('[LGU Tracker] Landing DILG regions failed:', err instanceof Error ? err.message : err);
      return null;
    });
    const [stats, nepProposals, example, { lgsf, rlip }] = await Promise.all([
      loadStats(supabase),
      loadNepCount(supabase),
      loadExample(supabase),
      loadDilgCounts(supabase).catch((err) => {
        console.error('[LGU Tracker] Landing DILG counts failed:', err instanceof Error ? err.message : err);
        return { lgsf: null, rlip: null };
      }),
    ]);
    const points = await loadAllRegionPoints(supabase);
    const dilgRegions = await dilgRegionsLoad;
    const counts = new Map((stats?.stats.by_region ?? []).map((r) => [r.value, r.count]));
    const regions = DEFAULT_SCOPE_REGIONS.map((region, i) => ({
      region,
      contracts: stats ? (counts.get(region) ?? 0) : null,
      points: points[i],
    }));
    const totalContracts = stats?.stats.total_contracts ?? null;
    return {
      totalContracts,
      totalAmount: stats?.stats.contract_amount.sum ?? null,
      ongoingContracts: stats?.stats.by_status.find((s) => s.value === 'ongoing')?.count ?? null,
      completedContracts: stats?.stats.by_status.find((s) => s.value === 'completed')?.count ?? null,
      computedAt: stats?.computed_at ?? null,
      regions,
      nepProposals,
      example,
      dilgProjects: lgsf !== null && rlip !== null ? lgsf + rlip : null,
      regionsCovered: countRegionsCovered(regions, dilgRegions),
      datasets: listDatasets([
        { label: 'DPWH contracts (Transparency Portal)', records: totalContracts },
        { label: 'DPWH proposals (FY 2027 NEP)', records: nepProposals },
        { label: 'DILG SubayBAYAN locally funded projects', records: lgsf },
        { label: 'DILG SubayBAYAN 20% development fund (LIME)', records: rlip },
      ]),
    };
  } catch (err) {
    console.error('[LGU Tracker] Landing data failed:', err instanceof Error ? err.message : err);
    return empty;
  }
}
