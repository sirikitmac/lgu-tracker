import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/env';
import { DETAIL_COLUMNS, INDEX_COLUMNS, SUMMARY_COLUMNS, type IndexRow, type SubaybayanDetail, type SubaybayanSummary } from './query';

/**
 * Server-side access to the SubayBAYAN snapshot.
 *
 * The data is a one-time export, so the map's index (every row, filter
 * columns only) is loaded once per server instance and kept for an hour.
 * PostgREST returns at most 1,000 rows per request, so the table is read in
 * parallel .range() pages after an exact count; the load fails rather than
 * serving a partial index.
 *
 * Uses the publishable key without cookies: the table is public read under
 * RLS, and the cached result must not depend on who asked.
 */

const PAGE = 1000;
const CONCURRENCY = 8;
const TTL_MS = 60 * 60 * 1000;

let client: SupabaseClient | null = null;
function publicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export class SubaybayanUnavailableError extends Error {}

let cached: { rows: IndexRow[]; loadedAt: number } | null = null;
let loading: Promise<IndexRow[]> | null = null;

async function loadIndex(db: SupabaseClient): Promise<IndexRow[]> {
  const { count, error } = await db.from('subaybayan_projects').select('id', { count: 'exact', head: true });
  if (error || count === null) throw new Error(`Counting subaybayan_projects failed: ${error?.message ?? 'no count'}`);
  const pages = Math.ceil(count / PAGE);
  const out: IndexRow[][] = new Array(pages);
  let next = 0;
  const worker = async () => {
    while (next < pages) {
      const page = next++;
      const { data, error: pageError } = await db
        .from('subaybayan_projects')
        .select(INDEX_COLUMNS.join(','))
        .order('id')
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (pageError) throw new Error(`Reading subaybayan_projects page ${page} failed: ${pageError.message}`);
      out[page] = (data ?? []) as unknown as IndexRow[];
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pages) }, worker));
  const rows = out.flat().map((r) => ({ ...r, total_cost: r.total_cost === null ? null : Number(r.total_cost) }));
  if (rows.length !== count) throw new Error(`Read ${rows.length} SubayBAYAN rows, expected ${count}.`);
  return rows;
}

/** Every SubayBAYAN row (filter columns). Cached in memory for an hour; concurrent callers share one load. */
export async function getSubaybayanIndex(): Promise<IndexRow[]> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached.rows;
  const db = publicClient();
  if (!db) throw new SubaybayanUnavailableError('Supabase is not configured.');
  loading ??= loadIndex(db)
    .then((rows) => {
      cached = { rows, loadedAt: Date.now() };
      return rows;
    })
    .finally(() => {
      loading = null;
    });
  // Serve the previous copy while a refresh is in flight.
  if (cached) {
    loading.catch((e) => console.error('[LGU Tracker] SubayBAYAN index refresh failed:', e));
    return cached.rows;
  }
  return loading;
}

export async function getSubaybayanDetail(id: string): Promise<SubaybayanDetail | null> {
  const db = publicClient();
  if (!db) throw new SubaybayanUnavailableError('Supabase is not configured.');
  const { data, error } = await db.from('subaybayan_projects').select(DETAIL_COLUMNS.join(',')).eq('id', id).maybeSingle();
  if (error) throw new Error(`Reading project ${id} failed: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  for (const k of ['total_cost', 'total_cost_reported', 'national_subsidy', 'lgu_counterpart', 'owpa'] as const) if (row[k] !== null) row[k] = Number(row[k]);
  return row as SubaybayanDetail;
}

export async function getSubaybayanSummaries(ids: string[]): Promise<SubaybayanSummary[]> {
  const db = publicClient();
  if (!db) throw new SubaybayanUnavailableError('Supabase is not configured.');
  const { data, error } = await db.from('subaybayan_projects').select(SUMMARY_COLUMNS.join(',')).in('id', ids);
  if (error) throw new Error(`Reading project summaries failed: ${error.message}`);
  const byId = new Map((data as unknown as SubaybayanSummary[]).map((r) => [r.id, { ...r, total_cost: r.total_cost === null ? null : Number(r.total_cost) }]));
  return ids.map((id) => byId.get(id)).filter((r): r is SubaybayanSummary => !!r);
}

/** Shared CDN caching for the snapshot endpoints. */
export const SNAPSHOT_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };
