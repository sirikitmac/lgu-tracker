import type {
  BoundaryPosition,
  CoordinateEvidence,
  IliganClassification,
  IliganEvidence,
} from '@/types/dpwhImport';
import {
  ILIGAN_BARANGAYS,
  ILIGAN_BOUNDARY_RING,
  OTHER_MUNICIPALITIES,
  OTHER_PROVINCES,
} from './reference';

/**
 * Pure evidence extraction and classification for Iligan City candidates.
 *
 * DPWH marks no coordinate in this dataset as verified, so no single field
 * is trusted on its own. A record is confirmed only when three independent
 * signals agree: the description names Iligan City as the location, it names
 * a PSGC Iligan barangay, and every reported coordinate falls inside the
 * reference boundary. Neither the implementing office nor a bare mention of
 * "Iligan City" is ever enough.
 */

export const DPWH_ILIGAN_DEO = 'Iligan City DEO';

/** Explicit "Iligan City" / "City of Iligan" (not MILIGAN, CASILIGAN, ...). */
export const ILIGAN_CITY_PATTERN = /\bILIGAN\s+CITY\b|\bCITY\s+OF\s+ILIGAN\b/i;

/** Coordinates this close to the boundary line are treated as ambiguous. */
export const EDGE_TOLERANCE_M = 300;

/**
 * A record that mentions Iligan City only in a road name is excluded on
 * coordinates alone only when every point is at least this far outside.
 */
export const EXCLUSION_DISTANCE_M = 2_000;

/** Clauses with these words name a road, bridge, or other linear feature. */
const FEATURE_CLAUSE = /\b(ROADS?|RD|ROUTE|HIGHWAY|HWY|BY-?PASS|DIVERSION|CIRCUMFERENTIAL|ALTERNATE|ALONG|STREET|AVENUE|AVE|BRIDGES?|BR)\b/;
const HYPHENATED_ILIGAN = /-\s*(ILIGAN CITY|CITY OF ILIGAN)|(ILIGAN CITY|CITY OF ILIGAN)\s*-/;
const CLAUSE_STARTS_WITH_ILIGAN = /^(ILIGAN CITY|CITY OF ILIGAN)\b/;

function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/\bBRGYS?\.?(?=\s|$)|\bBGY\.?(?=\s|$)|\bBARANGAY\b/g, 'BARANGAY')
    .replace(/\bSTA\.?\s+/g, 'SANTA ')
    .replace(/\bSTO\.?\s+/g, 'SANTO ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Letters of a place name, allowing hyphens/spaces to vary ("BURU-UN" = "BURUUN"). */
function namePattern(name: string): string {
  return normalizeText(name)
    .split(/[-\s]+/)
    .map((part) => part.split('').map(escapeRegExp).join('-?'))
    .join('[-\\s]*');
}

const BARANGAY_PATTERNS = ILIGAN_BARANGAYS.map((barangay) => ({
  ...barangay,
  prefixed: new RegExp(`\\bBARANGAY\\s+(${namePattern(barangay.name)})\\b`),
  bare: new RegExp(`^(?:BARANGAY\\s+)?(${namePattern(barangay.name)})$`),
}));

const OTHER_PLACE_PATTERNS = [...OTHER_MUNICIPALITIES, ...OTHER_PROVINCES]
  .sort((a, b) => b.length - a.length)
  .map((name) => ({ name, pattern: new RegExp(`\\b${namePattern(name)}\\b`, 'g') }));

export interface TextEvidence {
  descriptionLocatesInIliganCity: boolean;
  iliganOnlyInRoadNames: boolean;
  barangays: IliganEvidence['barangays'];
  otherPlaces: string[];
}

/**
 * Parenthesized text in DPWH descriptions usually details a route
 * ("(JCT. CDO-KIBARITAN ROAD/... ROGONGON, ILIGAN CITY)") rather than the
 * project location, so it is blanked out, including an unclosed trailing "(".
 */
function withoutParentheticals(text: string): string {
  let depth = 0;
  let out = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    else if (char === ')' && depth > 0) depth -= 1;
    else if (depth === 0) out += char;
  }
  return out;
}

export function analyzeDescription(description: string): TextEvidence {
  const clauses = withoutParentheticals(description).split(/[,;]/).map(normalizeText).filter(Boolean);
  const isFeature = clauses.map((clause) => FEATURE_CLAUSE.test(clause));

  const mentioned = ILIGAN_CITY_PATTERN.test(description);
  const locates = clauses.some(
    (clause, i) => ILIGAN_CITY_PATTERN.test(clause) && !isFeature[i] && !HYPHENATED_ILIGAN.test(clause)
  );
  const otherPlaces = new Set<string>();

  const barangays = new Map<string, IliganEvidence['barangays'][number]>();
  clauses.forEach((clause, i) => {
    for (const barangay of BARANGAY_PATTERNS) {
      if (barangays.has(barangay.psgcCode)) continue;
      // "BRGY. X" is explicit anywhere; a bare "X" only as its own clause
      // directly before "ILIGAN CITY" (e.g. "..., ROGONGON, ILIGAN CITY").
      const match =
        clause.match(barangay.prefixed) ??
        (!isFeature[i] && CLAUSE_STARTS_WITH_ILIGAN.test(clauses[i + 1] ?? '') ? clause.match(barangay.bare) : null);
      if (match) {
        barangays.set(barangay.psgcCode, { psgcCode: barangay.psgcCode, name: barangay.name, matchedText: match[0] });
      }
    }
    if (isFeature[i]) return;
    // Longest names first; matched text is blanked so "BACOLOD-KALAWI" is not also "BACOLOD".
    let rest = clause;
    for (const place of OTHER_PLACE_PATTERNS) {
      const next = rest.replace(place.pattern, ' ');
      if (next !== rest) otherPlaces.add(place.name);
      rest = next;
    }
  });

  return {
    descriptionLocatesInIliganCity: locates,
    iliganOnlyInRoadNames: mentioned && !locates,
    barangays: [...barangays.values()],
    otherPlaces: [...otherPlaces],
  };
}

// -----------------------------------------------------------------------------
// Geometry (equirectangular approximation; accurate to metres at this scale)
// -----------------------------------------------------------------------------

const M_PER_DEG_LAT = 110_574;

function isInsideRing(longitude: number, latitude: number, ring: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToRingM(longitude: number, latitude: number, ring: ReadonlyArray<readonly [number, number]>): number {
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - longitude) * mPerDegLon;
    const ay = (ring[i][1] - latitude) * M_PER_DEG_LAT;
    const bx = (ring[i + 1][0] - longitude) * mPerDegLon;
    const by = (ring[i + 1][1] - latitude) * M_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  return Math.hypot((a.longitude - b.longitude) * mPerDegLon, (a.latitude - b.latitude) * M_PER_DEG_LAT);
}

export function isUsableCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return (
    typeof latitude === 'number' && typeof longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export function locatePoint(
  origin: CoordinateEvidence['origin'],
  latitude: number,
  longitude: number,
  source: string | null,
  locationVerified: boolean | null
): CoordinateEvidence {
  const distanceToBoundaryM = Math.round(distanceToRingM(longitude, latitude, ILIGAN_BOUNDARY_RING));
  const position: BoundaryPosition =
    distanceToBoundaryM <= EDGE_TOLERANCE_M
      ? 'edge'
      : isInsideRing(longitude, latitude, ILIGAN_BOUNDARY_RING) ? 'inside' : 'outside';
  return { origin, latitude, longitude, position, distanceToBoundaryM, source, locationVerified };
}

export function summarizeCoordinates(points: CoordinateEvidence[]): IliganEvidence['coordinates'] {
  if (points.length === 0) return { status: 'missing', points, spreadM: null };
  let spreadM = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) spreadM = Math.max(spreadM, distanceM(points[i], points[j]));
  }
  const positions = new Set(points.map((p) => p.position));
  const status =
    positions.has('inside') && positions.has('outside')
      ? 'conflicting'
      : positions.size === 1 && positions.has('inside')
        ? 'inside'
        : positions.has('outside') && !positions.has('edge')
          ? 'outside'
          : 'edge';
  return { status, points, spreadM: Math.round(spreadM) };
}

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

export const CLASSIFICATION_CRITERIA: Record<IliganClassification, string> = {
  confirmed_iligan:
    'All of: description names Iligan City as the location (not only in a road name); description names a PSGC Iligan barangay; every DPWH coordinate is inside the reference boundary (more than ' +
    `${EDGE_TOLERANCE_M} m from the line); no other municipality or province named as a location; no component province other than Lanao del Norte. ` +
    'Confirmation is against source data only; DPWH coordinates are unverified and no site inspection is implied.',
  potential_iligan:
    'Positive Iligan location evidence with no conflicting evidence, but short of confirmation: e.g. Iligan City named without a barangay, coordinates missing or near the boundary, ' +
    'or coordinates inside the boundary with Iligan named only in a road name.',
  needs_verification:
    'Conflicting or insufficient evidence: description says Iligan but coordinates fall outside; coordinates disagree with each other; another municipality or province is also named; ' +
    'or the record has no location evidence beyond the implementing office.',
  excluded:
    'Evidence points elsewhere: Iligan City appears only in a road or route name (or not at all), no Iligan barangay is named as a location, and either ' +
    `another municipality/province is named as the location (coordinates not inside), or every coordinate is at least ${EXCLUSION_DISTANCE_M / 1000} km outside the boundary.`,
};

export function classifyIligan(evidence: IliganEvidence): { classification: IliganClassification; reasons: string[] } {
  const reasons: string[] = [];
  const coords = evidence.coordinates.status;
  const textIligan = evidence.descriptionLocatesInIliganCity || evidence.barangays.length > 0;
  const otherProvinces = evidence.componentProvinces.filter((p) => p !== 'LANAO DEL NORTE');
  const pointsElsewhere = evidence.otherPlaces.length > 0 || otherProvinces.length > 0;

  if (evidence.isIliganCityDeo) reasons.push('Implementing office is Iligan City DEO (not location evidence by itself).');
  if (evidence.descriptionLocatesInIliganCity) reasons.push('Description names Iligan City as the location.');
  if (evidence.iliganOnlyInRoadNames) reasons.push('Iligan City appears only in a road/route name.');
  if (evidence.barangays.length > 0) {
    reasons.push(`Description names Iligan barangay(s): ${evidence.barangays.map((b) => b.name).join(', ')}.`);
  }
  if (evidence.otherPlaces.length > 0) reasons.push(`Description also names: ${evidence.otherPlaces.join(', ')}.`);
  if (otherProvinces.length > 0) reasons.push(`Component province(s): ${[...new Set(otherProvinces)].join(', ')}.`);
  reasons.push(
    {
      inside: 'All coordinates are inside the Iligan City boundary.',
      edge: `Coordinates are within ${EDGE_TOLERANCE_M} m of the boundary.`,
      outside: 'Coordinates fall outside the Iligan City boundary.',
      missing: 'No usable coordinates.',
      conflicting: 'Coordinates disagree: some inside, some outside the boundary.',
    }[coords]
  );

  let classification: IliganClassification;
  if (!textIligan && pointsElsewhere && coords !== 'inside' && coords !== 'edge' && coords !== 'conflicting') {
    classification = 'excluded';
  } else if (
    !textIligan &&
    evidence.iliganOnlyInRoadNames &&
    coords === 'outside' &&
    evidence.coordinates.points.every((p) => p.distanceToBoundaryM >= EXCLUSION_DISTANCE_M)
  ) {
    classification = 'excluded';
  } else if (coords === 'conflicting' || (textIligan && (coords === 'outside' || pointsElsewhere))) {
    classification = 'needs_verification';
  } else if (
    evidence.descriptionLocatesInIliganCity &&
    evidence.barangays.length > 0 &&
    coords === 'inside' &&
    !pointsElsewhere
  ) {
    classification = 'confirmed_iligan';
  } else if (!pointsElsewhere && ((textIligan && coords !== 'outside') || coords === 'inside')) {
    classification = 'potential_iligan';
  } else {
    classification = 'needs_verification';
  }
  return { classification, reasons };
}
