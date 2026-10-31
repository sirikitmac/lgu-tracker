import type { NextRequest } from 'next/server';
import { applyDirectoryFilters, applyDirectoryQuery, parseDirectoryQuery, type FilterBuilder } from '@/lib/integrations/dpwh/nationwide/query';
import { asCode } from '@/lib/subaybayan/code';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PROJECT_LIST_COLUMNS, type ProjectListItem } from '@/types/dpwh';

/**
 * GET /api/dpwh/contracts?q=&region=&province=&municipality=&category=&status=
 *                         &contractor=&office=&source=&agency=&sector=&sort=&page=&pageSize=
 *
 * One page of the project directory (public.project_directory: DPWH
 * contracts, DPWH NEP 2027 proposals and DILG SubayBAYAN projects, each row
 * with its `source` and `agency`; `sector` is the DILG category). Filtering, sorting, and
 * pagination run in Postgres (indexed); the browser never receives the
 * full dataset. Public data: RLS allows reads for everyone.
 *
 * When `q` is a SubayBAYAN project code, rows with exactly that code (index
 * subaybayan_projects_code_idx) come first on page 1 and are left out of the
 * full-text results on every page, so they are listed once. The count is the
 * full-text count, which already includes them.
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
  const code = parsed.query.q ? asCode(parsed.query.q) : null;
  const exactBuilder = code
    ? (supabase.from('project_directory').select(PROJECT_LIST_COLUMNS.join(',')).eq('project_code', code) as unknown as ListBuilder)
    : null;
  const [{ data, error }, { count, error: countError }, exact] = await Promise.all([
    applyDirectoryQuery(builder, parsed.query, ['source', 'record_id']),
    applyDirectoryFilters(countBuilder, parsed.query),
    exactBuilder ? applyDirectoryFilters(exactBuilder, { ...parsed.query, q: null }).order('record_id', { ascending: true, nullsFirst: false }).range(0, 19) : null,
  ]);
  if (error || countError || exact?.error) {
    console.error('[LGU Tracker] DPWH directory query failed:', error ?? countError ?? exact?.error);
    return Response.json({ error: 'Could not load projects.' }, { status: 502 });
  }
  let items = (data ?? []) as unknown as ProjectListItem[];
  const pinned = (exact?.data ?? []) as unknown as ProjectListItem[];
  if (pinned.length) {
    const key = (r: ProjectListItem) => `${r.source}|${r.record_id}`;
    const pinnedKeys = new Set(pinned.map(key));
    items = [...(parsed.query.page === 1 ? pinned : []), ...items.filter((r) => !pinnedKeys.has(key(r)))];
  }
  return Response.json({
    items,
    total: count ?? 0,
    page: parsed.query.page,
    pageSize: parsed.query.pageSize,
  });
}
