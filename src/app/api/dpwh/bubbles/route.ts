import type { NextRequest } from 'next/server';
import { parseBounds, parseDirectoryQuery } from '@/lib/integrations/dpwh/nationwide/query';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DpwhBubble } from '@/types/dpwh';

/**
 * GET /api/dpwh/bubbles?bbox=west,south,east,north&level=0|1|2&region=&category=&status=
 *
 * One bubble per grid cell in the viewport (level 0 = 1 degree cells, 1 = 0.25,
 * 2 = 0.05): how many mapped contracts it holds, their average position, the
 * region with the most contracts, and the status breakdown. Read from the
 * small pre-counted table public.dpwh_map_cells (rebuilt after each sync), so
 * it stays fast however many contracts there are. Text search is not supported
 * here; the map asks for individual markers (/api/dpwh/map) when a search is on.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parseDirectoryQuery(params);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const bounds = parseBounds(params.get('bbox'));
  if (!bounds.ok) return Response.json({ error: bounds.error }, { status: 400 });
  const level = Number(params.get('level') ?? '0');
  if (!Number.isInteger(level) || level < 0 || level > 2) return Response.json({ error: 'level must be 0, 1 or 2.' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });

  const b = bounds.bounds ?? { west: -180, south: -90, east: 180, north: 90 };
  const call = () =>
    supabase.rpc('dpwh_map_bubbles', {
      p_level: level,
      p_west: b.west,
      p_south: b.south,
      p_east: b.east,
      p_north: b.north,
      p_region: parsed.query.region,
      p_category: parsed.query.category,
      p_status: parsed.query.status,
    });
  let result = await call();
  if (result.error) {
    // A slow first answer from a cold database is usually fine the second time.
    await new Promise((resolve) => setTimeout(resolve, 300));
    result = await call();
  }
  if (result.error) {
    console.error('[LGU Tracker] DPWH bubbles query failed:', result.error.message);
    return Response.json({ error: 'Could not load the project map.' }, { status: 502 });
  }

  const bubbles: DpwhBubble[] = ((result.data ?? []) as Array<Omit<DpwhBubble, 'n'> & { n: number | string }>).map((row) => ({
    lat: row.lat,
    lng: row.lng,
    n: Number(row.n),
    region: row.region,
    statuses: row.statuses ?? {},
  }));
  return Response.json(
    { bubbles, total: bubbles.reduce((sum, x) => sum + x.n, 0), level },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
