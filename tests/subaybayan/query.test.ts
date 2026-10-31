import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY_FILTERS,
  MAX_SUMMARY_IDS,
  buildFacets,
  buildPoints,
  filtersToParams,
  parseIds,
  parseSubaybayanQuery,
  withCategory,
  type IndexRow,
} from '@/lib/subaybayan/query';

const parse = (qs: string) => parseSubaybayanQuery(new URLSearchParams(qs));

test('params: empty query gives the defaults (approximate locations included)', () => {
  const r = parse('');
  assert.ok(r.ok);
  assert.deepEqual(r.filters, EMPTY_FILTERS);
});

test('params: valid filters parse and round-trip through filtersToParams', () => {
  const qs = 'q=farm road&category=infrastructure&source=rlip&region=REGION X - NORTHERN MINDANAO&province=CITY OF ILIGAN&city=CITY OF ILIGAN&year=2025&status=ongoing&approx=0&sub=Roads and bridges&type=Local Roads and Bridges&mode=Contract';
  const r = parse(qs);
  assert.ok(r.ok);
  assert.equal(r.filters.year, 2025);
  assert.equal(r.filters.approx, false);
  const again = parseSubaybayanQuery(filtersToParams(r.filters));
  assert.ok(again.ok);
  assert.deepEqual(again.filters, r.filters);
});

test('params: rejects unknown enum values, bad years, bad approx', () => {
  for (const qs of ['category=roads', 'source=dpwh', 'status=done', 'year=25', 'year=1800', 'year=2025.5', 'approx=yes']) {
    const r = parse(qs);
    assert.equal(r.ok, false, qs);
  }
});

test('params: rejects over-long and unsafe text', () => {
  assert.equal(parse(`q=${'a'.repeat(201)}`).ok, false);
  assert.equal(parse('region=<script>').ok, false);
  assert.equal(parse('q=a;drop table').ok, false);
  assert.ok(parse("q=Sto. Niño (Pob.) / Purok 3, Cagayan de Oro – 20%").ok);
});

test('params: place filters must cascade (province needs region, city needs province)', () => {
  assert.equal(parse('province=BUKIDNON').ok, false);
  assert.equal(parse('region=X&city=Y').ok, false);
  assert.ok(parse('region=X&province=Y&city=Z').ok);
});

test('params: category-specific filters only with a category that uses them', () => {
  assert.equal(parse('sub=Roads and bridges').ok, false);
  assert.equal(parse('category=environment&mode=Contract').ok, false); // environment: sub, program
  assert.equal(parse('category=uncategorized&sub=x').ok, false); // uncategorized: type, sector
  assert.ok(parse('category=uncategorized&type=Others&sector=Social Services').ok);
  assert.ok(parse('category=health&program=Growth Equity Fund').ok);
});

test('withCategory resets only the category-specific filters', () => {
  const f = { ...EMPTY_FILTERS, q: 'x', region: 'R', year: 2025, category: 'infrastructure' as const, sub: 'Roads and bridges', mode: 'Contract' };
  assert.deepEqual(withCategory(f, 'health'), { ...f, category: 'health', sub: '', mode: '' });
});

test('parseIds: validates and limits ids', () => {
  assert.deepEqual(parseIds('A-1, B-2,A-1'), { ok: true, ids: ['A-1', 'B-2'] });
  assert.equal(parseIds('').ok, false);
  assert.equal(parseIds('a b').ok, false);
  assert.equal(parseIds("x'--").ok, false);
  assert.equal(parseIds(Array.from({ length: MAX_SUMMARY_IDS + 1 }, (_, i) => `id${i}`).join(',')).ok, false);
});

// --- filtering, points, facets ----------------------------------------------------

const row = (id: string, patch: Partial<IndexRow> = {}): IndexRow => ({
  id, project_code: id, title: 'Concreting of Farm to Market Road', sector_category: 'infrastructure', sector_subcategory: 'Roads and bridges',
  region: 'R10', province: 'P1', citymun: 'C1', latitude: 8.123456, longitude: 124.654321, location_precision: 'barangay_centroid',
  funding_year: 2025, status: 'completed', source_dataset: 'rlip', project_type: 'Local Roads and Bridges', program: 'LIME', sector: 'Economic Services',
  mode_of_implementation: 'Contract', total_cost: 1000000.4, total_cost_review: false, ...patch,
});
const index: IndexRow[] = [
  row('A'),
  row('B', { location_precision: 'municipality_centroid', citymun: 'C2' }),
  row('C', { location_precision: 'province_centroid', citymun: null, province: 'P2', sector_category: 'health', sector_subcategory: 'Health facilities', title: 'Barangay Health Station' }),
  row('D', { location_precision: 'unresolved', latitude: null, longitude: null, region: 'R10', province: null, citymun: null, status: 'ongoing' }),
  row('E', { region: 'R7', province: 'P7', citymun: 'C7', source_dataset: 'lgsf', funding_year: 2024 }),
];

test('points: counts by precision; approx toggle hides approximate markers but not the counts', () => {
  const all = buildPoints(index, EMPTY_FILTERS);
  assert.equal(all.total, 5);
  assert.deepEqual(all.counts, { barangay: 2, approximate: 2, unmapped: 1 });
  assert.equal(all.rows, 5);
  assert.deepEqual(all.columns.lat, [8.12346, 8.12346, 8.12346, null, 8.12346]);
  assert.equal(all.columns.cost[0], 1000000);
  assert.deepEqual(all.columns.review, [0, 0, 0, 0, 0]);
  assert.deepEqual(buildPoints([row('R', { total_cost_review: true })], EMPTY_FILTERS).columns.review, [1]);
  const exact = buildPoints(index, { ...EMPTY_FILTERS, approx: false });
  assert.equal(exact.total, 5);
  assert.deepEqual(exact.columns.id, ['A', 'D', 'E']);
});

test('points: filters by category, place, year, status, source and search', () => {
  const ids = (f: Partial<typeof EMPTY_FILTERS>) => buildPoints(index, { ...EMPTY_FILTERS, ...f }).columns.id;
  assert.deepEqual(ids({ category: 'health' }), ['C']);
  assert.deepEqual(ids({ region: 'R10', province: 'P1', city: 'C2' }), ['B']);
  assert.deepEqual(ids({ year: 2024 }), ['E']);
  assert.deepEqual(ids({ status: 'ongoing' }), ['D']);
  assert.deepEqual(ids({ source: 'lgsf' }), ['E']);
  assert.deepEqual(ids({ q: 'health station' }), ['C']);
  assert.deepEqual(ids({ q: 'e' }).length, 5); // titles contain "e"
  assert.deepEqual(ids({ q: 'zzz' }), []);
});

test('facets: each list ignores its own filter; provinces and cities cascade', () => {
  const f = buildFacets(index, { ...EMPTY_FILTERS, region: 'R10', category: 'infrastructure' });
  assert.equal(f.total, 3); // A, B, D
  assert.deepEqual(f.regions.map((r) => [r.value, r.count]), [['R10', 3], ['R7', 1]]);
  assert.deepEqual(f.categories.map((c) => [c.value, c.count]), [['infrastructure', 3], ['health', 1]]);
  assert.deepEqual(f.provinces.map((p) => p.value), ['P1']);
  assert.deepEqual(f.cities, []); // no province chosen yet
  assert.deepEqual(Object.keys(f.details).sort(), ['mode', 'sub', 'type']);
  assert.equal(buildFacets(index, EMPTY_FILTERS).provinces.length, 0);
});
