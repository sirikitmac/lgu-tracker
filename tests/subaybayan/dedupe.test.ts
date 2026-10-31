import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyPair,
  identifierCrossReference,
  matchDilgToDpwh,
  normalizeContractor,
  titleTokens,
  workKind,
  type DilgForMatch,
  type DpwhForMatch,
  type PairEvidence,
} from '../../scripts/subaybayan/lib/dedupe';

const ev = (patch: Partial<PairEvidence>): PairEvidence => ({
  title_similarity: 1,
  identifier: null,
  place_in_title: 'barangay',
  distance_km: null,
  year_diff: 0,
  cost_ratio: null,
  same_contractor: false,
  same_work_kind: true,
  ...patch,
});

test('titleTokens: stopwords, generic verbs and abbreviations', () => {
  assert.deepEqual(titleTokens('Construction of Multi-Purpose Bldg. @ Brgy. Luyang'), ['multipurpose', 'building', 'luyang']);
  assert.deepEqual(titleTokens('CONCRETING OF BRGY. PATAG FMR'), ['concrete', 'patag', 'farm', 'market', 'road']);
});

test('normalizeContractor ignores legal suffixes and punctuation', () => {
  assert.equal(normalizeContractor('J.D. Builders & Construction, Inc.'), normalizeContractor('JD BUILDERS CONSTRUCTION INC'));
});

test('workKind: roads and water are linear, halls and MPBs are buildings', () => {
  assert.equal(workKind('Concreting of Farm to Market Road'), 'linear');
  assert.equal(workKind('Construction of Multi-Purpose Building'), 'building');
  assert.equal(workKind('Improvement of Pikaw Falls'), null);
});

test('identifier cross-reference is an exact match', () => {
  const dilg = { project_code: 'RLIP-25-10-09-00-000-1', title: 'Road', component_details: null };
  assert.match(identifierCrossReference(dilg, { contract_id: '25K00001', title: 'ROAD (RLIP-25-10-09-00-000-1)', contract_name: null }) ?? '', /DILG code/);
  assert.match(identifierCrossReference({ ...dilg, title: 'Road, see DPWH 25K00001' }, { contract_id: '25K00001', title: 'X', contract_name: null }) ?? '', /DPWH contract/);
  assert.equal(classifyPair(ev({ identifier: 'x', title_similarity: 0 }), 'barangay_centroid').match_class, 'exact');
});

test('exact needs title, same year, cost within 1% and the same barangay', () => {
  assert.equal(classifyPair(ev({ cost_ratio: 0.995 }), 'barangay_centroid').match_class, 'exact');
  assert.equal(classifyPair(ev({ cost_ratio: 0.995, year_diff: 1 }), 'barangay_centroid').match_class, 'potential');
  assert.equal(classifyPair(ev({ cost_ratio: 0.995, place_in_title: 'citymun' }), 'barangay_centroid').match_class, 'potential');
});

test('different barangay, different town or different kind of work is never flagged', () => {
  assert.equal(classifyPair(ev({ place_in_title: 'conflict', cost_ratio: 1 }), 'barangay_centroid').match_class, null);
  assert.equal(classifyPair(ev({ same_work_kind: false, cost_ratio: 1 }), 'barangay_centroid').match_class, null);
});

test('similar title alone (no location, cost or contractor) is not a duplicate', () => {
  assert.equal(classifyPair(ev({ place_in_title: null }), 'municipality_centroid').match_class, null);
  assert.equal(classifyPair(ev({ place_in_title: 'citymun' }), 'municipality_centroid').match_class, null);
  assert.equal(classifyPair(ev({ place_in_title: 'citymun', cost_ratio: 0.95 }), 'municipality_centroid').match_class, 'potential');
});

test('very different costs need title, barangay and year to agree', () => {
  assert.equal(classifyPair(ev({ cost_ratio: 0.1, year_diff: 1 }), 'barangay_centroid').match_class, null);
  assert.equal(classifyPair(ev({ cost_ratio: 0.1 }), 'barangay_centroid').match_class, 'potential');
});

// --- matcher on a tiny fixture --------------------------------------------------

const dilgRow = (patch: Partial<DilgForMatch>): DilgForMatch => ({
  id: 'D1', project_code: 'LIME-25-10-43-06-000-3', title: 'Construction of Lanise Multi-Purpose Building', component_details: null,
  province: 'MISAMIS ORIENTAL', citymun: 'CLAVERIA', barangay: 'Lanise', psgc_province: 'P1', psgc_citymun: 'C1',
  latitude: 8.6, longitude: 124.9, location_precision: 'barangay_centroid', funding_year: 2025, total_cost: null, contractor: null, ...patch,
});
const dpwhRow = (patch: Partial<DpwhForMatch>): DpwhForMatch => ({
  contract_id: '24KL0017', title: 'CONSTRUCTION OF MULTI-PURPOSE BUILDING, BARANGAY LANISE, CLAVERIA, MISAMIS ORIENTAL', contract_name: null,
  province: 'Misamis Oriental', provinces: null, latitude: 8.61, longitude: 124.9, contract_amount: 4934742, approved_budget: null,
  budget: null, infra_year: 2024, contractor: null, ...patch,
});
const opts = {
  provinceCode: (l: string) => (l === 'Misamis Oriental' ? 'P1' : null),
  dpwhYears: [2016, 2025] as [number, number],
  dpwhRegions: new Set(['R10']),
  regionOfProvince: (c: string) => (c === 'P1' ? 'R10' : c === 'P9' ? 'R3' : null),
  barangaysOf: (c: string) => (c === 'C1' ? ['lanise', 'patrocenio', 'poblacion'] : []),
  citymunsOf: (p: string) => (p === 'P1' ? ['claveria', 'jasaan', 'initao'] : []),
};
const filler = Array.from({ length: 60 }, (_, i) => dpwhRow({ contract_id: `24KL9${String(i).padStart(3, '0')}`, title: `CONSTRUCTION OF ROAD SEGMENT ${i}, JASAAN, MISAMIS ORIENTAL`, latitude: null, longitude: null }));

test('matcher: same barangay and kind of work → potential; never merges', () => {
  const [r] = matchDilgToDpwh([dilgRow({})], [dpwhRow({}), ...filler], opts);
  assert.equal(r.match_class, 'potential');
  assert.equal(r.candidates[0].contract_id, '24KL0017');
  assert.equal(r.candidates[0].evidence.place_in_title, 'barangay');
});

test('matcher: a different barangay of the same town is not a match', () => {
  const [r] = matchDilgToDpwh([dilgRow({})], [dpwhRow({ title: 'CONSTRUCTION OF MULTI-PURPOSE BUILDING, BARANGAY PATROCENIO, CLAVERIA, MISAMIS ORIENTAL' }), ...filler], opts);
  assert.equal(r.match_class, 'none');
});

test('matcher: same barangay name in a different town is not a match', () => {
  const [r] = matchDilgToDpwh([dilgRow({})], [dpwhRow({ title: 'CONSTRUCTION OF MULTI-PURPOSE BUILDING, BARANGAY LANISE, JASAAN, MISAMIS ORIENTAL' }), ...filler], opts);
  assert.equal(r.match_class, 'none');
});

test('matcher: regions outside the DPWH import are "out of scope", not "no match"', () => {
  const [r] = matchDilgToDpwh([dilgRow({ psgc_province: 'P9' })], [dpwhRow({})], opts);
  assert.equal(r.match_class, 'out_of_scope');
  assert.equal(r.out_of_scope_reason, 'region not in DPWH import');
});
