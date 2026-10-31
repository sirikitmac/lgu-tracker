import type { NextRequest } from 'next/server';
import { buildPoints, parseSubaybayanQuery } from '@/lib/subaybayan/query';
import { getSubaybayanIndex, SNAPSHOT_CACHE_HEADERS, SubaybayanUnavailableError } from '@/lib/subaybayan/server';

/**
 * GET /api/subaybayan/points?q=&category=&source=&region=&province=&city=&year=&status=&approx=&sub=&type=&mode=&program=&sector=
 *
 * Every matching DILG SubayBAYAN project as compact columns (id, area-centroid
 * coordinates, category, precision, status, source, year, cost) for client-side
 * clustering, plus counts by location precision. Unmapped rows are included
 * with null coordinates so the list can show them. Snapshot data: cached.
 */
export async function GET(request: NextRequest) {
  const parsed = parseSubaybayanQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const index = await getSubaybayanIndex();
    return Response.json(buildPoints(index, parsed.filters), { headers: SNAPSHOT_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof SubaybayanUnavailableError) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });
    console.error('[LGU Tracker] SubayBAYAN points failed:', error);
    return Response.json({ error: 'Could not load LGU projects for the map.' }, { status: 502 });
  }
}
