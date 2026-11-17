import type { NextRequest } from 'next/server';
import {
  MAP_PAGE_SIZE,
  MAP_POINT_LIMIT,
  applyMapFilters,
  applyMapQuery,
  parseBounds,
  parseDirectoryQuery,
  type MapBuilder,
} from '@/lib/integrations/dpwh/nationwide/query';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DPWH_MAP_COLUMNS, type DpwhMapPoint } from '@/types/dpwh';

/**
 * GET /api/dpwh/map?bbox=west,south,east,north&q=&region=&province=&category=&status=&contractor=&office=
 *
 * Contracts with DPWH-reported coordinates inside the viewport, largest
 * contract amount first, at most MAP_POINT_LIMIT per request. `total` is the
 * number of matching mapped contracts in the viewport so the UI can say when
 * markers were capped. count=only returns just the total. Responses are cached
 * (see Cache-Control). Public data: RLS allows reads for everyone, and only
 * public source columns are selected.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parseDirectoryQuery(params);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const bounds = parseBounds(params.get('bbox'));
  if (!bounds.ok) return Response.json({ error: bounds.error }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });

  type PointBuilder = MapBuilder<PointBuilder> &
    PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count: number | null }>;
  const pointBuilder = () =>
    supabase.from('dpwh_contracts_directory').select(DPWH_MAP_COLUMNS.join(',')) as unknown as PointBuilder;
  // One response holds at most MAP_PAGE_SIZE rows (PostgREST max_rows), so a busy viewport reads a second page.
  const readPoints = async () => {
    const first = await applyMapQuery(pointBuilder(), parsed.query, bounds.bounds, 0);
    const rows = (first.data ?? []) as unknown[];
    if (first.error || rows.length < MAP_PAGE_SIZE || MAP_POINT_LIMIT <= MAP_PAGE_SIZE) return first;
    const second = await applyMapQuery(pointBuilder(), parsed.query, bounds.bounds, 1);
    return second.error ? second : { data: [...rows, ...((second.data ?? []) as unknown[])], error: null, count: null };
  };
  // Counted in a separate request: PostgREST's combined count + ordered page
  // plans far worse than either alone and hits the anon statement timeout.
  const countBuilder = supabase
    .from('dpwh_contracts_directory')
    .select('contract_id', { count: 'exact', head: true }) as unknown as PointBuilder;
  // ?count=only skips the marker page (the heavy, ordered query) when the caller only needs the total.
  const countOnly = params.get('count') === 'only';
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    countOnly ? Promise.resolve({ data: [] as unknown[], error: null }) : readPoints(),
    applyMapFilters(countBuilder, parsed.query, bounds.bounds),
  ]);
  if (error || countError) {
    console.error('[LGU Tracker] DPWH map query failed:', error ?? countError);
    return Response.json({ error: 'Could not load DPWH map markers.' }, { status: 502 });
  }
  const points = (data ?? []) as unknown as DpwhMapPoint[];
  return Response.json(
    {
      points,
      total: count ?? points.length,
      limit: MAP_POINT_LIMIT,
    },
    // Public data that changes with the weekly sync: let the CDN and browsers reuse an answer for a while.
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
