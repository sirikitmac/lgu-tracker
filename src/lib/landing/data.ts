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
 */

/** Mapped contracts plotted per region on the coverage map (largest contract amounts first). */
export const POINTS_PER_REGION = 300;

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

export async function loadLandingData(): Promise<LandingData> {
  const supabase = publicClient();
  const empty: LandingData = {
    totalContracts: null,
    totalAmount: null,
    ongoingContracts: null,
    computedAt: null,
    regions: DEFAULT_SCOPE_REGIONS.map((region) => ({ region, contracts: null, points: [] })),
    nepProposals: null,
    example: null,
  };
  if (!supabase) return empty;

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
