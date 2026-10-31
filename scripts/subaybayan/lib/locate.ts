/**
 * Offline place matching: SubayBAYAN region / province / city-municipality /
 * barangay labels → PSGC codes and an area representative point.
 *
 * Only unambiguous name matches are accepted. Nothing is guessed: a record
 * whose place cannot be matched keeps the coarser level it did match, or is
 * left unresolved without coordinates.
 */
import type { LocationPrecision } from '@/lib/subaybayan/categories';
import { normalizePlaceName, splitPlaceList } from './names';
import type { Place } from './gazetteer';

/** SubayBAYAN region labels → PSGC region codes (explicit; no fuzzy matching). */
export const REGION_CODES: Record<string, string> = {
  'REGION I - ILOCOS REGION': '0100000000',
  'REGION II - CAGAYAN VALLEY': '0200000000',
  'REGION III - CENTRAL LUZON': '0300000000',
  'REGION IV-A - CALABARZON': '0400000000',
  'REGION V - BICOL REGION': '0500000000',
  'REGION VI - WESTERN VISAYAS': '0600000000',
  'REGION VII - CENTRAL VISAYAS': '0700000000',
  'REGION VIII - EASTERN VISAYAS': '0800000000',
  'REGION IX - ZAMBOANGA PENINSULA': '0900000000',
  'REGION X - NORTHERN MINDANAO': '1000000000',
  'REGION XI - DAVAO REGION': '1100000000',
  'REGION XII - SOCCSKSARGEN': '1200000000',
  'NATIONAL CAPITAL REGION': '1300000000',
  'CORDILLERA ADMINISTRATIVE REGION': '1400000000',
  'REGION XIII - CARAGA': '1600000000',
  MIMAROPA: '1700000000',
  'NEGROS ISLAND REGION': '1800000000',
  'BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO': '1900000000',
};

export interface LocationInput {
  region: string | null;
  province: string | null;
  citymun: string | null;
  barangay: string | null;
}

export interface LocationResult {
  psgc_region: string | null;
  psgc_province: string | null;
  psgc_citymun: string | null;
  psgc_barangay: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: LocationPrecision;
  /** Short machine-readable note on how the place was matched (report only). */
  note: string;
}

export class Gazetteer {
  private byCode = new Map<string, Place>();
  /** `${level}|${parent}|${norm}` → places */
  private byParent = new Map<string, Place[]>();
  private children = new Map<string, Place[]>();
  private memo = new Map<string, Place | null | 'ambiguous'>();

  constructor(places: Place[]) {
    for (const p of places) {
      this.byCode.set(p.code, p);
      const key = `${p.level}|${p.parent ?? ''}|${p.norm}`;
      (this.byParent.get(key) ?? this.byParent.set(key, []).get(key)!).push(p);
      if (p.parent) (this.children.get(p.parent) ?? this.children.set(p.parent, []).get(p.parent)!).push(p);
    }
  }

  childrenOf(code: string): Place[] {
    return this.children.get(code) ?? [];
  }

  get(code: string): Place | undefined {
    return this.byCode.get(code);
  }

  /** Unique child of `parent` at `level` whose normalized name is `norm`. */
  child(level: Place['level'], parent: string, norm: string): Place | null | 'ambiguous' {
    const hits = this.byParent.get(`${level}|${parent}|${norm}`) ?? [];
    return hits.length === 1 ? hits[0] : hits.length > 1 ? 'ambiguous' : null;
  }

  /** Unique descendant at `level` anywhere under `ancestor` (e.g. a city anywhere in a region). */
  descendant(level: Place['level'], ancestor: string, norm: string): Place | null | 'ambiguous' {
    const key = `d|${level}|${ancestor}|${norm}`;
    if (this.memo.has(key)) return this.memo.get(key)!;
    const hits: Place[] = [];
    const walk = (code: string) => {
      for (const c of this.children.get(code) ?? []) {
        if (c.level === level) {
          if (c.norm === norm) hits.push(c);
        } else walk(c.code);
      }
    };
    walk(ancestor);
    const out = hits.length === 1 ? hits[0] : hits.length > 1 ? 'ambiguous' : null;
    this.memo.set(key, out);
    return out;
  }

  /** Unique place at `level` in the whole country. */
  anywhere(level: Place['level'], norm: string): Place | null | 'ambiguous' {
    const key = `a|${level}|${norm}`;
    if (this.memo.has(key)) return this.memo.get(key)!;
    const hits = [...this.byCode.values()].filter((p) => p.level === level && p.norm === norm);
    const out = hits.length === 1 ? hits[0] : hits.length > 1 ? 'ambiguous' : null;
    this.memo.set(key, out);
    return out;
  }
}

const found = (p: Place | null | 'ambiguous'): p is Place => p !== null && p !== 'ambiguous';

export function locate(g: Gazetteer, input: LocationInput): LocationResult {
  const result: LocationResult = {
    psgc_region: null,
    psgc_province: null,
    psgc_citymun: null,
    psgc_barangay: null,
    latitude: null,
    longitude: null,
    location_precision: 'unresolved',
    note: '',
  };
  const notes: string[] = [];
  const regionCode = input.region ? REGION_CODES[input.region.trim().toUpperCase()] : undefined;
  if (!regionCode || !g.get(regionCode)) {
    result.note = `region not mapped: ${input.region ?? '(empty)'}`;
    return result;
  }
  result.psgc_region = regionCode;

  // Province within region; a province that moved region (e.g. into NIR) is accepted when unique nationally.
  const provNorm = normalizePlaceName(input.province);
  let province: Place | null = null;
  if (provNorm) {
    const inRegion = g.child('province', regionCode, provNorm);
    if (found(inRegion)) province = inRegion;
    else if (inRegion === null) {
      const national = g.anywhere('province', provNorm);
      if (found(national)) {
        province = national;
        notes.push('province matched outside the listed region');
      }
    }
  }

  // City/municipality: within the province; else within the region (renamed/moved
  // provinces, and cities written in the province column — NCR cities and HUCs).
  const cityLabels = [input.citymun, province ? null : input.province].filter((v): v is string => !!v && !!normalizePlaceName(v));
  let citymun: Place | null = null;
  for (const label of cityLabels) {
    const norm = normalizePlaceName(label);
    const inProvince = province ? g.child('citymun', province.code, norm) : null;
    if (found(inProvince)) {
      citymun = inProvince;
      break;
    }
    const inRegion = g.descendant('citymun', regionCode, norm);
    if (found(inRegion)) {
      citymun = inRegion;
      if (province && inRegion.parent !== province.code) notes.push('city/municipality matched outside the listed province');
      break;
    }
  }
  if (citymun && !province) province = g.get(citymun.parent ?? '') ?? null;

  if (province) result.psgc_province = province.code;
  if (citymun) result.psgc_citymun = citymun.code;

  // Barangay within the city/municipality: whole cell first, then a list → city centroid.
  let barangay: Place | null = null;
  if (citymun && input.barangay?.trim()) {
    const whole = g.child('barangay', citymun.code, normalizePlaceName(input.barangay));
    if (found(whole)) barangay = whole;
    else {
      const parts = splitPlaceList(input.barangay);
      if (parts.length > 1) notes.push('several barangays listed');
      else notes.push(whole === 'ambiguous' ? 'barangay name ambiguous' : 'barangay not matched');
    }
  }

  const point = barangay ?? citymun ?? province;
  if (barangay) {
    result.psgc_barangay = barangay.code;
    result.location_precision = 'barangay_centroid';
  } else if (citymun) result.location_precision = 'municipality_centroid';
  else if (province) {
    result.location_precision = 'province_centroid';
    if (input.citymun?.trim()) notes.push('city/municipality not matched');
  } else notes.push(provNorm ? 'province not matched' : 'no province');
  if (point) {
    result.latitude = point.lat;
    result.longitude = point.lng;
  }
  result.note = notes.join('; ');
  return result;
}
