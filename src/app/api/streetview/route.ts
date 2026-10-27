import type { NextRequest } from 'next/server';
import { interpretMetadata, metadataUrl, parseLatLng, type StreetViewLookup } from '@/lib/streetview';

/**
 * GET /api/streetview?lat=&lng=
 *
 * Whether Google has outdoor Street View imagery near a spot on the map, and
 * the nearest panorama if so. Proxied so the server key (GOOGLE_MAPS_API_KEY)
 * never reaches the browser. Without a key the answer is `unchecked` and the
 * map opens Street View without checking first.
 */
export async function GET(request: NextRequest) {
  const parsed = parseLatLng(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return Response.json({ status: 'unchecked' } satisfies StreetViewLookup);

  let body: unknown;
  try {
    const res = await fetch(metadataUrl(parsed.point, key), { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    body = await res.json();
  } catch (error) {
    console.error('[LGU Tracker] Street View metadata request failed:', (error as Error)?.name ?? 'error');
    return Response.json({ error: 'Could not reach Google Street View. Please try again.' }, { status: 502 });
  }

  const result = interpretMetadata(body);
  if (!result.ok) {
    console.error('[LGU Tracker] Street View metadata answered', result.status);
    if (result.kind === 'quota') return Response.json({ error: 'Street View is busy right now. Wait a moment and try again.' }, { status: 429 });
    if (result.kind === 'denied') return Response.json({ error: 'Street View is not set up correctly on this site.' }, { status: 503 });
    return Response.json({ error: 'Google Street View could not answer. Please try again.' }, { status: 502 });
  }
  // Coverage changes rarely; let browsers and the CDN reuse answers for a day.
  return Response.json(result.lookup, { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
}
