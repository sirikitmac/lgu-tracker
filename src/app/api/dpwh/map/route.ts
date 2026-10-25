import type { NextRequest } from 'next/server';
import {
  MAP_POINT_LIMIT,
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
 * markers were capped. Public data: RLS allows reads for everyone, and only
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
  const builder = supabase
    .from('dpwh_contracts_directory')
    .select(DPWH_MAP_COLUMNS.join(','), { count: 'exact' }) as unknown as PointBuilder;
  const { data, error, count } = await applyMapQuery(builder, parsed.query, bounds.bounds);
  if (error) {
    console.error('[LGU Tracker] DPWH map query failed:', error);
    return Response.json({ error: 'Could not load DPWH map markers.' }, { status: 502 });
  }
  const points = (data ?? []) as unknown as DpwhMapPoint[];
  return Response.json({
    points,
    total: count ?? points.length,
    limit: MAP_POINT_LIMIT,
  });
}
