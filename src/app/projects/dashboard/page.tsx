import type { Metadata } from 'next';
import { DpwhDashboard } from '@/components/dpwh/DpwhDashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DpwhSummary } from '@/types/dpwh';

export const metadata: Metadata = {
  title: 'Dashboard · LGU Tracker',
  description: 'DPWH infrastructure contracts in the Visayas and Mindanao by region, status, category and year, with FY 2027 NEP proposals counted separately.',
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * Public analytics. Every figure comes from the cached aggregate row
 * (dpwh_directory_stats, refreshed by the database after each sync) plus one
 * head-only count of NEP proposals; no project rows are sent to the browser.
 */
export default async function DashboardPage({ searchParams }: PageProps<'/projects/dashboard'>) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  let summary: DpwhSummary | null = null;
  let nepCount: number | null = null;
  let error: string | null = supabase ? null : 'Supabase is not configured.';

  if (supabase) {
    const [stats, nep] = await Promise.all([
      supabase
        .from('dpwh_directory_stats')
        .select('computed_at, last_successful_sync_at, source_revision, source_snapshot_at, stats')
        .eq('id', 1)
        .maybeSingle(),
      supabase.from('project_directory').select('record_id', { count: 'exact', head: true }).eq('source', 'dpwh_nep_2027'),
    ]);
    if (stats.error) {
      console.error('[LGU Tracker] Dashboard summary query failed:', stats.error);
      error = 'Could not load the contract summary.';
    } else {
      summary = (stats.data as DpwhSummary | null) ?? null;
    }
    if (nep.error) console.error('[LGU Tracker] NEP count query failed:', nep.error);
    else nepCount = nep.count;
  }

  return <DpwhDashboard summary={summary} nepCount={nepCount} error={error} initialRegion={first(params.region)} />;
}
