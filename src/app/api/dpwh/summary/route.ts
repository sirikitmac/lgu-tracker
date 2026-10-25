import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DpwhSummary } from '@/types/dpwh';

/**
 * GET /api/dpwh/summary
 *
 * Cached directory summary (totals, counts by region/category/status) and
 * the filter options, refreshed by the database after each successful sync.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });

  const { data, error } = await supabase
    .from('dpwh_directory_stats')
    .select('computed_at, last_successful_sync_at, source_revision, source_snapshot_at, stats')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error('[LGU Tracker] DPWH summary query failed:', error);
    return Response.json({ error: 'Could not load the DPWH summary.' }, { status: 502 });
  }
  return Response.json({ summary: (data as DpwhSummary | null) ?? null });
}
