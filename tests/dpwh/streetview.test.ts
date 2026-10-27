import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bearingDegrees,
  distanceMeters,
  formatImageryDate,
  googleMapsStreetViewUrl,
  initialHeading,
  interpretMetadata,
  metadataUrl,
  parseLatLng,
  streetViewEmbedUrl,
} from '@/lib/streetview';

const q = (s: string) => new URLSearchParams(s);

test('parseLatLng accepts in-range coordinates and rounds them', () => {
  assert.deepEqual(parseLatLng(q('lat=8.2280123456&lng=124.2452987654')), { ok: true, point: { lat: 8.228012, lng: 124.245299 } });
  assert.deepEqual(parseLatLng(q('lat=-90&lng=180')), { ok: true, point: { lat: -90, lng: 180 } });
});

test('parseLatLng rejects missing, non-numeric and out-of-range values', () => {
  for (const s of ['', 'lat=8', 'lng=124', 'lat=&lng=124', 'lat=abc&lng=124', 'lat=91&lng=0', 'lat=0&lng=-181', 'lat=Infinity&lng=0']) {
    assert.equal(parseLatLng(q(s)).ok, false, s);
  }
});

test('metadata URL asks for outdoor imagery within the radius', () => {
  const url = new URL(metadataUrl({ lat: 8.5, lng: 124.6 }, 'KEY'));
  assert.equal(url.origin + url.pathname, 'https://maps.googleapis.com/maps/api/streetview/metadata');
  assert.equal(url.searchParams.get('location'), '8.5,124.6');
  assert.equal(url.searchParams.get('source'), 'outdoor');
  assert.equal(url.searchParams.get('radius'), '100');
  assert.equal(url.searchParams.get('key'), 'KEY');
});

test('interpretMetadata maps Google statuses', () => {
  assert.deepEqual(interpretMetadata({ status: 'OK', pano_id: 'abc', location: { lat: 8.1, lng: 124.2 }, date: '2023-05' }), {
    ok: true,
    lookup: { status: 'ok', panoId: 'abc', location: { lat: 8.1, lng: 124.2 }, date: '2023-05' },
  });
  assert.deepEqual(interpretMetadata({ status: 'OK', pano_id: 'abc', location: { lat: 8.1, lng: 124.2 } }), {
    ok: true,
    lookup: { status: 'ok', panoId: 'abc', location: { lat: 8.1, lng: 124.2 }, date: null },
  });
  assert.deepEqual(interpretMetadata({ status: 'ZERO_RESULTS' }), { ok: true, lookup: { status: 'none' } });
  assert.deepEqual(interpretMetadata({ status: 'NOT_FOUND' }), { ok: true, lookup: { status: 'none' } });
  assert.deepEqual(interpretMetadata({ status: 'REQUEST_DENIED' }), { ok: false, kind: 'denied', status: 'REQUEST_DENIED' });
  assert.deepEqual(interpretMetadata({ status: 'OVER_QUERY_LIMIT' }), { ok: false, kind: 'quota', status: 'OVER_QUERY_LIMIT' });
  assert.deepEqual(interpretMetadata({ status: 'UNKNOWN_ERROR' }), { ok: false, kind: 'error', status: 'UNKNOWN_ERROR' });
  assert.deepEqual(interpretMetadata(null), { ok: false, kind: 'error', status: 'MISSING' });
  assert.deepEqual(interpretMetadata({ status: 'OK', location: { lat: 1, lng: 2 } }), { ok: false, kind: 'error', status: 'MALFORMED' });
});

test('distance and bearing', () => {
  // One degree of latitude is about 111.2 km.
  assert.ok(Math.abs(distanceMeters({ lat: 8, lng: 124 }, { lat: 9, lng: 124 }) - 111_195) < 50);
  assert.equal(distanceMeters({ lat: 8, lng: 124 }, { lat: 8, lng: 124 }), 0);
  assert.equal(Math.round(bearingDegrees({ lat: 8, lng: 124 }, { lat: 9, lng: 124 })), 0);
  assert.equal(Math.round(bearingDegrees({ lat: 8, lng: 124 }, { lat: 8, lng: 125 })), 90);
  assert.equal(Math.round(bearingDegrees({ lat: 8, lng: 124 }, { lat: 7, lng: 124 })), 180);
  assert.equal(Math.round(bearingDegrees({ lat: 8, lng: 124 }, { lat: 8, lng: 123 })), 270);
});

test('initial heading faces the drop unless the panorama is on top of it', () => {
  const drop = { lat: 8.0005, lng: 124 };
  assert.equal(initialHeading(drop, null), 0);
  assert.equal(initialHeading(drop, { lat: 8.00049, lng: 124 }), 0);
  assert.equal(initialHeading(drop, { lat: 8.0005, lng: 123.9995 }), 90);
});

test('embed and Google Maps URLs', () => {
  const byPano = new URL(streetViewEmbedUrl('K', { panoId: 'P1', location: { lat: 8, lng: 124 }, heading: 45 }));
  assert.equal(byPano.origin + byPano.pathname, 'https://www.google.com/maps/embed/v1/streetview');
  assert.equal(byPano.searchParams.get('pano'), 'P1');
  assert.equal(byPano.searchParams.get('location'), null);
  assert.equal(byPano.searchParams.get('heading'), '45');
  const byLocation = new URL(streetViewEmbedUrl('K', { location: { lat: 8, lng: 124 } }));
  assert.equal(byLocation.searchParams.get('location'), '8,124');
  assert.equal(byLocation.searchParams.get('pano'), null);

  const maps = new URL(googleMapsStreetViewUrl({ location: { lat: 8, lng: 124 } }));
  assert.equal(maps.searchParams.get('map_action'), 'pano');
  assert.equal(maps.searchParams.get('viewpoint'), '8,124');
  assert.equal(maps.searchParams.get('key'), null);
});

test('imagery date reads as a month', () => {
  assert.equal(formatImageryDate('2023-05'), 'May 2023');
  assert.equal(formatImageryDate('2019'), '2019');
  assert.equal(formatImageryDate('2019-13'), '2019-13');
  assert.equal(formatImageryDate(null), null);
});
