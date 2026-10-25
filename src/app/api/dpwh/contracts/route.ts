import type { NextRequest } from 'next/server';
import { applyDirectoryQuery, parseDirectoryQuery, type FilterBuilder } from '@/lib/integrations/dpwh/nationwide/query';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DPWH_LIST_COLUMNS, type DpwhContractListItem } from '@/types/dpwh';

/**
 * GET /api/dpwh/contracts?q=&region=&province=&municipality=&category=&status=
 *                         &contractor=&office=&sort=&page=&pageSize=
 *
 * One page of the nationwide DPWH directory. Filtering, sorting, and
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
    .from('dpwh_contracts_directory')
    .select(DPWH_LIST_COLUMNS.join(','), { count: 'exact' }) as unknown as ListBuilder;
  const { data, error, count } = await applyDirectoryQuery(builder, parsed.query);
  if (error) {
    console.error('[LGU Tracker] DPWH directory query failed:', error);
    return Response.json({ error: 'Could not load DPWH contracts.' }, { status: 502 });
  }
  return Response.json({
    items: (data ?? []) as unknown as DpwhContractListItem[],
    total: count ?? 0,
    page: parsed.query.page,
    pageSize: parsed.query.pageSize,
  });
}
