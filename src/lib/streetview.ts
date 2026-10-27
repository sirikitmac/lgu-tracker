/**
 * Street View for the project map's cat ("drop the cat to look around").
 *
 * The spot a person drops the cat on is just a place on the map, never a
 * DPWH contract: these helpers only deal in coordinates. Google answers with
 * the nearest panorama, which can be some metres from the drop, so both
 * points are kept and the distance between them is shown.
 *
 * Configuration (both optional; see .env.example):
 * - GOOGLE_MAPS_API_KEY (server only): Street View Static API metadata
 *   requests, which say whether imagery exists. Free and not billed.
 * - NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY (browser): the Maps Embed API, which
 *   shows the panorama inside the app. Free and not billed.
 * Without them the cat still works and opens Google Maps in a new tab.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** How far from the drop Google may look for a panorama, in metres. */
export const STREET_VIEW_RADIUS_M = 100;

export type StreetViewLookup =
  /** Imagery found; `location` is the panorama's own position. */
  | { status: 'ok'; panoId: string; location: LatLng; date: string | null }
  /** Google has no outdoor imagery within the radius. */
  | { status: 'none' }
  /** No server key, so availability was not checked. */
  | { status: 'unchecked' };

/** Six decimals is about 0.1 m: plenty, and keeps URLs and cache keys stable. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** `lat` and `lng` query parameters, rejected unless both are finite and in range. */
export function parseLatLng(params: URLSearchParams): { ok: true; point: LatLng } | { ok: false; error: string } {
  const rawLat = params.get('lat');
  const rawLng = params.get('lng');
  if (!rawLat?.trim() || !rawLng?.trim()) return { ok: false, error: 'Both lat and lng are required.' };
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: 'lat must be a number between -90 and 90.' };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: 'lng must be a number between -180 and 180.' };
  return { ok: true, point: { lat: round(lat), lng: round(lng) } };
}

export function metadataUrl(point: LatLng, key: string): string {
  const params = new URLSearchParams({
    location: `${point.lat},${point.lng}`,
    radius: String(STREET_VIEW_RADIUS_M),
    // Outdoor only: indoor business tours are not what someone looking at a road expects.
    source: 'outdoor',
    key,
  });
  return `https://maps.googleapis.com/maps/api/streetview/metadata?${params}`;
}

/**
 * A Street View metadata response as a lookup result, or the reason it is
 * not one. `kind` separates our configuration problems (a bad key) from
 * Google being busy or failing.
 */
export function interpretMetadata(
  body: unknown
): { ok: true; lookup: StreetViewLookup } | { ok: false; kind: 'denied' | 'quota' | 'error'; status: string } {
  const b = (body ?? {}) as { status?: unknown; pano_id?: unknown; location?: { lat?: unknown; lng?: unknown }; date?: unknown };
  const status = typeof b.status === 'string' ? b.status : 'MISSING';
  if (status === 'ZERO_RESULTS' || status === 'NOT_FOUND') return { ok: true, lookup: { status: 'none' } };
  if (status === 'OK') {
    const lat = Number(b.location?.lat);
    const lng = Number(b.location?.lng);
    if (typeof b.pano_id !== 'string' || !b.pano_id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, kind: 'error', status: 'MALFORMED' };
    }
    return {
      ok: true,
      lookup: { status: 'ok', panoId: b.pano_id, location: { lat, lng }, date: typeof b.date === 'string' && b.date ? b.date : null },
    };
  }
  if (status === 'REQUEST_DENIED') return { ok: false, kind: 'denied', status };
  if (status === 'OVER_QUERY_LIMIT') return { ok: false, kind: 'quota', status };
  return { ok: false, kind: 'error', status };
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from `from` to `to`, 0–360 degrees clockwise from north. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Which way the camera starts: toward the dropped spot when the panorama is
 * far enough from it for the direction to mean something, otherwise north.
 */
export function initialHeading(drop: LatLng, pano: LatLng | null): number {
  if (!pano || distanceMeters(pano, drop) < 5) return 0;
  return Math.round(bearingDegrees(pano, drop));
}

/** Maps Embed API Street View URL; `pano` wins over `location` when known. */
export function streetViewEmbedUrl(key: string, opts: { panoId?: string; location: LatLng; heading?: number }): string {
  const params = new URLSearchParams({ key });
  if (opts.panoId) params.set('pano', opts.panoId);
  else params.set('location', `${opts.location.lat},${opts.location.lng}`);
  params.set('heading', String(opts.heading ?? 0));
  params.set('pitch', '0');
  params.set('fov', '90');
  return `https://www.google.com/maps/embed/v1/streetview?${params}`;
}

/** Keyless Google Maps URL that opens Street View (Google picks the nearest panorama). */
export function googleMapsStreetViewUrl(opts: { panoId?: string; location: LatLng; heading?: number }): string {
  const params = new URLSearchParams({ api: '1', map_action: 'pano', viewpoint: `${opts.location.lat},${opts.location.lng}` });
  if (opts.panoId) params.set('pano', opts.panoId);
  if (opts.heading !== undefined) params.set('heading', String(opts.heading));
  return `https://www.google.com/maps/@?${params}`;
}

export function formatLatLng(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

/** "2023-05" → "May 2023"; anything else is returned as given. */
export function formatImageryDate(date: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(date);
  if (!m) return date;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return date;
  return `${new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${m[1]}`;
}
