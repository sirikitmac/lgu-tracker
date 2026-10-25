import type { NextRequest } from 'next/server';
import { applyDirectoryFilters, applyDirectoryQuery, parseDirectoryQuery, type FilterBuilder } from '@/lib/integrations/dpwh/nationwide/query';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PROJECT_LIST_COLUMNS, type ProjectListItem } from '@/types/dpwh';

/**
 * GET /api/dpwh/contracts?q=&region=&province=&municipality=&category=&status=
 *                         &contractor=&office=&source=&sort=&page=&pageSize=
 *
 * One page of the project directory (public.project_directory: DPWH
 * contracts plus the other BetterGov.ph sources, each row with its `source`). Filtering, sorting, and
 * pagination run in Postgres (indexed); the browser never receives the
 * full dataset. Public data: RLS allows reads for everyone.
 */
export async function GET(request: NextRequest) {
  const parsed = parseDirectoryQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });

  // A narrow structural view of the builder; supabase-js's full generic type
  // is too deep for TypeScript to instantiate through applyDirectoryQuery.
  type ListBuilder = FilterBuilder<ListBuilder> &
    PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count: number | null }>;
  const builder = supabase
    .from('project_directory')
    .select(PROJECT_LIST_COLUMNS.join(',')) as unknown as ListBuilder;
  // Counted in a separate request: PostgREST's combined count + ordered page
  // plans far worse than either alone and hits the anon statement timeout.
  const countBuilder = supabase
    .from('project_directory')
    .select('record_id', { count: 'exact', head: true }) as unknown as ListBuilder;
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    applyDirectoryQuery(builder, parsed.query, ['source', 'record_id']),
    applyDirectoryFilters(countBuilder, parsed.query),
  ]);
  if (error || countError) {
    console.error('[LGU Tracker] DPWH directory query failed:', error ?? countError);
    return Response.json({ error: 'Could not load projects.' }, { status: 502 });
  }
  return Response.json({
    items: (data ?? []) as unknown as ProjectListItem[],
    total: count ?? 0,
    page: parsed.query.page,
    pageSize: parsed.query.pageSize,
  });
}
