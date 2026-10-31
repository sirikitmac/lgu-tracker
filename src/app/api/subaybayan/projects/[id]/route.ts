import type { NextRequest } from 'next/server';
import { ID_PATTERN } from '@/lib/subaybayan/query';
import { getSubaybayanDetail, SNAPSHOT_CACHE_HEADERS, SubaybayanUnavailableError } from '@/lib/subaybayan/server';

/** GET /api/subaybayan/projects/{id}: every public field of one SubayBAYAN project, for the detail panel. */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/subaybayan/projects/[id]'>) {
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) return Response.json({ error: 'Invalid project id.' }, { status: 400 });
  try {
    const project = await getSubaybayanDetail(id);
    if (!project) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ project }, { headers: SNAPSHOT_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof SubaybayanUnavailableError) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });
    console.error('[LGU Tracker] SubayBAYAN project failed:', error);
    return Response.json({ error: 'Could not load this project.' }, { status: 502 });
  }
}
