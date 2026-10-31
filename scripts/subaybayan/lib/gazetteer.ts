/**
 * PSGC gazetteer built offline from the faeldon/philippines-json-maps
 * low-resolution GeoJSON release: every region, province (or NCR district /
 * independent city), city/municipality and barangay with its PSGC code,
 * parent code and one representative point inside its polygon.
 *
 * The representative point is the pole of inaccessibility (polylabel) of the
 * largest polygon part: always inside the area, unlike a plain centroid of a
 * crescent-shaped or multi-island unit.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import polylabel from 'polylabel';
import { BOUNDARY_SOURCE } from '@/lib/subaybayan/source';
import { normalizePlaceName } from './names';

export type GazetteerLevel = 'region' | 'province' | 'citymun' | 'barangay';

export interface Place {
  level: GazetteerLevel;
  /** 10-digit PSGC code, zero-padded. */
  code: string;
  name: string;
  norm: string;
  parent: string | null;
  lat: number;
  lng: number;
}

type Ring = number[][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } | null;

export const psgc = (n: number | string) => String(n).padStart(10, '0');

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return Math.abs(a / 2);
}

/** [lng, lat] inside the largest polygon part, or null for an empty geometry. */
export function representativePoint(geometry: Geometry): [number, number] | null {
  if (!geometry) return null;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  let best: Ring[] | null = null;
  let bestArea = -1;
  for (const poly of polygons) {
    const area = poly[0] ? ringArea(poly[0]) : 0;
    if (area > bestArea) {
      best = poly;
      bestArea = area;
    }
  }
  if (!best) return null;
  const p = polylabel(best, 0.0005) as unknown as number[];
  return [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))];
}

export async function ensureBoundaryZip(cacheDir: string): Promise<string> {
  const file = path.join(cacheDir, BOUNDARY_SOURCE.asset);
  if (!existsSync(file)) {
    mkdirSync(cacheDir, { recursive: true });
    console.log(`Downloading ${BOUNDARY_SOURCE.url} …`);
    const res = await fetch(BOUNDARY_SOURCE.url);
    if (!res.ok) throw new Error(`Boundary download failed: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (sha !== BOUNDARY_SOURCE.sha256) throw new Error(`${file}: SHA-256 ${sha} does not match the pinned release (${BOUNDARY_SOURCE.sha256}).`);
  return file;
}

interface Feature {
  properties: Record<string, string | number | null>;
  geometry: Geometry;
}

export function buildGazetteer(zipFile: string): Place[] {
  const files = unzipSync(new Uint8Array(readFileSync(zipFile)), { filter: (f) => f.name.endsWith('.json') });
  const read = (prefix: string): Feature[] =>
    Object.keys(files)
      .filter((n) => n.startsWith(prefix))
      .sort()
      .flatMap((n) => (JSON.parse(strFromU8(files[n])) as { features: Feature[] }).features);

  const places: Place[] = [];
  const add = (level: GazetteerLevel, f: Feature, codeKey: string, nameKey: string, parentKey: string | null) => {
    const point = representativePoint(f.geometry);
    const name = String(f.properties[nameKey] ?? '').trim();
    if (!point || !name) return;
    places.push({
      level,
      code: psgc(f.properties[codeKey] as number),
      name,
      norm: normalizePlaceName(name),
      parent: parentKey ? psgc(f.properties[parentKey] as number) : null,
      lng: point[0],
      lat: point[1],
    });
  };
  for (const f of read('geojson/country/')) add('region', f, 'adm1_psgc', 'adm1_en', null);
  for (const f of read('geojson/regions/')) add('province', f, 'adm2_psgc', 'adm2_en', 'adm1_psgc');
  for (const f of read('geojson/provdists/')) add('citymun', f, 'adm3_psgc', 'adm3_en', 'adm2_psgc');
  for (const f of read('geojson/municities/')) add('barangay', f, 'adm4_psgc', 'adm4_en', 'adm3_psgc');
  return places;
}

/** Builds once and caches as JSON next to the zip. */
export async function loadGazetteer(cacheDir: string): Promise<Place[]> {
  const cached = path.join(cacheDir, `gazetteer-${BOUNDARY_SOURCE.release}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8')) as Place[];
  const zip = await ensureBoundaryZip(cacheDir);
  console.log('Building gazetteer from boundaries (one-time) …');
  const places = buildGazetteer(zip);
  writeFileSync(cached, JSON.stringify(places));
  return places;
}
