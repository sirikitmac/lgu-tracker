import type { NextRequest } from 'next/server';
import { parseIds } from '@/lib/subaybayan/query';
import { getSubaybayanSummaries, SNAPSHOT_CACHE_HEADERS, SubaybayanUnavailableError } from '@/lib/subaybayan/server';

/**
 * GET /api/subaybayan/projects?ids=a,b,c  (at most 60)
 *
 * List rows (title, place, status, cost) for the projects the side panel is
 * showing. The points endpoint leaves titles out to stay small, so the list
 * asks only for the page on screen. Order follows `ids`.
 */
export async function GET(request: NextRequest) {
  const parsed = parseIds(request.nextUrl.searchParams.get('ids'));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    return Response.json({ projects: await getSubaybayanSummaries(parsed.ids) }, { headers: SNAPSHOT_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof SubaybayanUnavailableError) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });
    console.error('[LGU Tracker] SubayBAYAN summaries failed:', error);
    return Response.json({ error: 'Could not load these projects.' }, { status: 502 });
  }
}
