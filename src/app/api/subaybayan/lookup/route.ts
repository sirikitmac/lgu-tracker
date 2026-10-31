import type { NextRequest } from 'next/server';
import { asCode, lookupCode, MAX_CODE_LENGTH } from '@/lib/subaybayan/code';
import { getSubaybayanIndex, SNAPSHOT_CACHE_HEADERS, SubaybayanUnavailableError } from '@/lib/subaybayan/server';

/**
 * GET /api/subaybayan/lookup?code=LIME-25-13-02-00-000-41
 *
 * Exact project-code lookup. The code is normalized first (case, spaces,
 * en/em dashes), and must have the shape of a SubayBAYAN code.
 *   found:     { code, status: 'found', matches: [{ id, title, place, lat/lng, precision, filter fields }] }
 *              (two matches for the 15 codes shared by two rows)
 *   not found: { code, status: 'not_found', suggestions: [{ code, title, distance }], dataset }
 *              (same prefix, edit distance ≤ 2; dataset names the portal list for the prefix)
 * Reads the same in-memory snapshot index as the map points, so a lookup
 * and the markers always agree. Snapshot data: cached.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('code');
  if (raw === null || raw.trim() === '') return Response.json({ error: 'code is required.' }, { status: 400 });
  if (raw.length > MAX_CODE_LENGTH * 2) return Response.json({ error: 'code is too long.' }, { status: 400 });
  const code = asCode(raw);
  if (!code) return Response.json({ error: 'That does not look like a SubayBAYAN project code (e.g. LIME-25-13-02-00-000-41).' }, { status: 400 });
  try {
    const index = await getSubaybayanIndex();
    return Response.json(lookupCode(index, code), { headers: SNAPSHOT_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof SubaybayanUnavailableError) return Response.json({ error: 'Supabase is not configured.' }, { status: 503 });
    console.error('[LGU Tracker] SubayBAYAN code lookup failed:', error);
    return Response.json({ error: 'Could not look up this project code.' }, { status: 502 });
  }
}
