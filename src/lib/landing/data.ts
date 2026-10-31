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
}

function publicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout(REQUEST_TIMEOUT_MS) },
  });
}

async function loadStats(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('dpwh_directory_stats')
    .select('computed_at, stats')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[LGU Tracker] Landing stats query failed:', error.message);
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
  const { data, error } = await supabase
    .from('dpwh_contracts_directory')
    .select('latitude, longitude')
    .eq('region', region)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('contract_amount', { ascending: false, nullsFirst: false })
    .limit(POINTS_PER_REGION);
  if (error || !data) {
    if (error) console.error(`[LGU Tracker] Landing map points for ${region} failed:`, error.message);
    return null;
  }
  return (data as { latitude: number; longitude: number }[]).map((p) => [p.longitude, p.latitude]);
}

async function loadNepCount(supabase: SupabaseClient): Promise<number | null> {
  const { count, error } = await supabase
    .from('project_directory')
    .select('record_id', { count: 'exact', head: true })
    .eq('source', 'dpwh_nep_2027');
  if (error) {
    console.error('[LGU Tracker] Landing NEP count failed:', error.message);
    return null;
  }
  return count;
}

async function loadExample(supabase: SupabaseClient): Promise<ExampleContract | null> {
  const { data, error } = await supabase
    .from('dpwh_contracts_directory')
    .select(
      'contract_id, title, province, region, category, status, contractor, contract_amount, progress, start_date, implementing_office, latitude, longitude'
    )
    .eq('contract_id', EXAMPLE_CONTRACT_ID)
    .maybeSingle();
  if (error) console.error('[LGU Tracker] Landing example contract failed:', error.message);
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
  };
}

async function loadFrom(supabase: SupabaseClient): Promise<LandingData> {
  const empty = emptyLandingData();
  try {
    const [stats, nepProposals, example] = await Promise.all([
      loadStats(supabase),
      loadNepCount(supabase),
      loadExample(supabase),
    ]);
    const points = await loadAllRegionPoints(supabase);
    const counts = new Map((stats?.stats.by_region ?? []).map((r) => [r.value, r.count]));
    return {
      totalContracts: stats?.stats.total_contracts ?? null,
      totalAmount: stats?.stats.contract_amount.sum ?? null,
      ongoingContracts: stats?.stats.by_status.find((s) => s.value === 'ongoing')?.count ?? null,
      completedContracts: stats?.stats.by_status.find((s) => s.value === 'completed')?.count ?? null,
      computedAt: stats?.computed_at ?? null,
      regions: DEFAULT_SCOPE_REGIONS.map((region, i) => ({
        region,
        contracts: stats ? (counts.get(region) ?? 0) : null,
        points: points[i],
      })),
      nepProposals,
      example,
    };
  } catch (err) {
    console.error('[LGU Tracker] Landing data failed:', err instanceof Error ? err.message : err);
    return empty;
  }
}
