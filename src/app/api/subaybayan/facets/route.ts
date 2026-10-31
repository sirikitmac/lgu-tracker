import type { NextRequest } from 'next/server';
import { buildFacets, parseSubaybayanQuery } from '@/lib/subaybayan/query';
import { getSubaybayanIndex, SNAPSHOT_CACHE_HEADERS, SubaybayanUnavailableError } from '@/lib/subaybayan/server';

/**
 * GET /api/subaybayan/facets?<same filters as /points>
 *
 * Filter options with counts: categories, sources, regions, provinces (for the
 * chosen region), cities (for the chosen province), years, statuses, and the
 * selected category's own filters (subcategory, project type, program, sector,
 * mode of implementation). Each list is counted with every other filter applied.
 */
export async function GET(request: NextRequest) {
  const parsed = parseSubaybayanQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const index = await getSubaybayanIndex();
    return Response.json(buildFacets(index, parsed.filters), { headers: SNAPSHOT_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof SubaybayanUnavailableError) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });
    console.error('[LGU Tracker] SubayBAYAN facets failed:', error);
    return Response.json({ error: 'Could not load the LGU project filters.' }, { status: 502 });
  }
}
