import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asCode,
  editDistance,
  joinList,
  looksLikeCode,
  lookupCode,
  MAX_SUGGESTIONS,
  normalizeCode,
  projectMapLink,
  revealFilters,
  toCodeMatch,
} from '@/lib/subaybayan/code';
import { EMPTY_FILTERS, matches, parseSubaybayanQuery, type IndexRow } from '@/lib/subaybayan/query';

const row = (id: string, patch: Partial<IndexRow> = {}): IndexRow => ({
  id,
  project_code: id,
  title: `Project ${id}`,
  sector_category: 'infrastructure',
  sector_subcategory: 'Roads and bridges',
  region: 'REGION X - NORTHERN MINDANAO',
  province: 'LANAO DEL NORTE',
  citymun: 'CITY OF ILIGAN',
  latitude: 8.2,
  longitude: 124.2,
  location_precision: 'barangay_centroid',
  funding_year: 2025,
  status: 'completed',
  source_dataset: 'rlip',
  project_type: 'Local Roads and Bridges',
  program: null,
  sector: null,
  mode_of_implementation: 'Contract',
  total_cost: 1_000_000,
  total_cost_review: false,
  ...patch,
});

// --- normalization ----------------------------------------------------------

test('normalize: trim, upper-case, collapse spaces, en/em dashes become "-"', () => {
  assert.equal(normalizeCode('  lime-25-13-02-00-000-41 '), 'LIME-25-13-02-00-000-41');
  assert.equal(normalizeCode('LIME–25–13–02–00–000–41'), 'LIME-25-13-02-00-000-41'); // en dash
  assert.equal(normalizeCode('LIME—25—13—02—00—000—41'), 'LIME-25-13-02-00-000-41'); // em dash
  assert.equal(normalizeCode('LIME − 25 - 13 -02- 00 - 000 - 41'), 'LIME-25-13-02-00-000-41'); // minus sign, spaces
  assert.equal(normalizeCode('ＬＩＭＥ－２５－１３－０２－００－０００－４１'), 'LIME-25-13-02-00-000-41'); // full-width
  assert.equal(normalizeCode('farm   to market\troad'), 'FARM TO MARKET ROAD');
});

// --- detection --------------------------------------------------------------

test('detection: every stored code shape counts as a code', () => {
  for (const c of [
    'LIME-25-13-02-00-000-41', 'LIME-26-11-23-17-000-11', 'RLIP-25-10-13-01-000-2', 'FALGU-25-13-06-00-000-1', 'SBDP-2025-10-43-08-076-01',
    'SBDP-26-02-15-23-000-14', 'GEF-26-14-44-09-000-16', 'GEF-26-17-59-04-000-4A', 'GEF-25-01-01-01-000-12B', 'SAFPB-25-01-02-03-000-1', 'GGG-25-10-00-00-000-1',
  ]) assert.ok(looksLikeCode(c), c);
});

test('detection: titles and partial input are not codes', () => {
  for (const t of ['FARM-TO-MARKET ROAD', 'CONCRETING OF ROAD', 'LIME', 'LIME-25', 'LIME-25-13', '2025-10-43', 'LIME-25-13-02-00-000-41 ROAD', 'Covid-19 isolation facility', '']) {
    assert.equal(looksLikeCode(normalizeCode(t)), false, t);
  }
});

test('detection: a mistyped code is still a code (so it gets suggestions)', () => {
  assert.equal(asCode('LIME-25-13-02-00-000-411'), 'LIME-25-13-02-00-000-411');
  assert.equal(asCode('lime 25 13 02 00 000 41'), null, 'spaces instead of dashes are not a code');
  assert.equal(asCode('LIME-25-13-02-00-00-41'), 'LIME-25-13-02-00-00-41');
});

// --- lookup -----------------------------------------------------------------

const INDEX: IndexRow[] = [
  row('LIME-25-13-02-00-000-41', { title: 'Construction of Slope Protection' }),
  row('LIME-25-13-02-00-000-42'),
  row('LIME-25-13-02-00-000-4'),
  row('LIME-25-13-02-00-001-41'),
  row('LIME-26-99-99-99-999-99'),
  row('rlip-b01-r122', { project_code: 'RLIP-25-12-47-04-000-80', title: 'WATER SYSTEM AT PUROK MADASIGON', funding_year: 2025 }),
  row('rlip-b01-r157', { project_code: 'RLIP-25-12-47-04-000-80', title: 'ROAD CONCRETING', funding_year: 2025 }),
  row('GGG-25-10-00-00-000-1', { source_dataset: 'lgsf', latitude: null, longitude: null, location_precision: 'unresolved' }),
  row('lgsf-b01-r9', { project_code: null }),
];

test('lookup: exact code → one match with what the map needs', () => {
  const r = lookupCode(INDEX, 'LIME-25-13-02-00-000-41');
  assert.equal(r.status, 'found');
  assert.ok(r.status === 'found');
  assert.equal(r.matches.length, 1);
  assert.deepEqual(
    [r.matches[0].id, r.matches[0].title, r.matches[0].latitude, r.matches[0].location_precision],
    ['LIME-25-13-02-00-000-41', 'Construction of Slope Protection', 8.2, 'barangay_centroid']
  );
});

test('lookup: a prefix of a longer code is not a match (exact, not substring)', () => {
  const r = lookupCode(INDEX, 'LIME-25-13-02-00-000-4');
  assert.ok(r.status === 'found');
  assert.deepEqual(r.matches.map((m) => m.id), ['LIME-25-13-02-00-000-4']);
});

test('lookup: a code shared by two rows returns both, in a stable order', () => {
  const r = lookupCode(INDEX, 'RLIP-25-12-47-04-000-80');
  assert.ok(r.status === 'found');
  assert.deepEqual(r.matches.map((m) => [m.id, m.title]), [
    ['rlip-b01-r122', 'WATER SYSTEM AT PUROK MADASIGON'],
    ['rlip-b01-r157', 'ROAD CONCRETING'],
  ]);
});

test('lookup: an unmapped project is still found (no coordinates)', () => {
  const r = lookupCode(INDEX, 'GGG-25-10-00-00-000-1');
  assert.ok(r.status === 'found');
  assert.equal(r.matches[0].latitude, null);
  assert.equal(r.matches[0].location_precision, 'unresolved');
});

test('lookup: not found → same-prefix suggestions within edit distance 2, closest first', () => {
  const r = lookupCode(INDEX, 'LIME-25-13-02-00-000-43');
  assert.equal(r.status, 'not_found');
  assert.ok(r.status === 'not_found');
  assert.deepEqual(r.suggestions.map((s) => [s.code, s.distance]), [
    ['LIME-25-13-02-00-000-4', 1],
    ['LIME-25-13-02-00-000-41', 1],
    ['LIME-25-13-02-00-000-42', 1],
    ['LIME-25-13-02-00-001-41', 2],
  ]);
  assert.equal(r.dataset, 'rlip');
});

test('lookup: suggestions never cross prefixes and are capped', () => {
  const many = Array.from({ length: 20 }, (_, i) => row(`FALGU-25-01-01-01-000-${i + 10}`, { source_dataset: 'lgsf' }));
  const r = lookupCode([...INDEX, ...many, row('SBDP-25-01-01-01-000-10')], 'FALGU-25-01-01-01-000-1');
  assert.ok(r.status === 'not_found');
  assert.equal(r.suggestions.length, MAX_SUGGESTIONS);
  assert.ok(r.suggestions.every((s) => s.code.startsWith('FALGU-')));
  assert.equal(r.dataset, 'lgsf');
});

test('lookup: unknown prefix → no suggestions, no dataset', () => {
  const r = lookupCode(INDEX, 'XYZ-25-13-02-00-000-41');
  assert.ok(r.status === 'not_found');
  assert.deepEqual(r.suggestions, []);
  assert.equal(r.dataset, null);
});

test('edit distance: bounded Levenshtein', () => {
  assert.equal(editDistance('LIME-25-1', 'LIME-25-1', 2), 0);
  assert.equal(editDistance('LIME-25-1', 'LIME-25-2', 2), 1);
  assert.equal(editDistance('LIME-25-1', 'LIME-52-1', 2), 2);
  assert.equal(editDistance('LIME-25-1', 'LIME-52-12', 2), 3, 'over the bound reports bound + 1');
  assert.equal(editDistance('A', 'ABCDE', 2), 3, 'length gap alone is enough');
});

// --- revealing on the map ---------------------------------------------------

const target = toCodeMatch(row('LIME-25-13-02-00-000-41', { location_precision: 'municipality_centroid' }));

test('reveal: filters that already show the project are kept; the search becomes the code', () => {
  const f = { ...EMPTY_FILTERS, q: 'lime–25–13–02–00–000–41', category: 'infrastructure' as const, year: 2025, region: 'REGION X - NORTHERN MINDANAO' };
  const r = revealFilters(target, f, 'LIME-25-13-02-00-000-41');
  assert.deepEqual(r.cleared, []);
  assert.deepEqual(r.filters, { ...f, q: 'LIME-25-13-02-00-000-41' });
});

test('reveal: hiding filters are cleared, with their dependants, and named', () => {
  const f = {
    ...EMPTY_FILTERS,
    category: 'health' as const, sub: 'Health facilities', region: 'REGION VII - CENTRAL VISAYAS', province: 'CEBU', city: 'CEBU CITY',
    year: 2024, status: 'ongoing' as const, approx: false, source: 'rlip' as const,
  };
  const r = revealFilters(target, f, 'LIME-25-13-02-00-000-41');
  assert.deepEqual(r.cleared, ['category', 'region', 'funding year', 'status', 'approximate-locations']);
  assert.equal(r.filters.category, '');
  assert.equal(r.filters.sub, '');
  assert.deepEqual([r.filters.region, r.filters.province, r.filters.city], ['', '', '']);
  assert.equal(r.filters.source, 'rlip', 'a matching source filter stays');
  assert.equal(r.filters.approx, true);
  assert.ok(matches(row('LIME-25-13-02-00-000-41', { location_precision: 'municipality_centroid' }), r.filters));
});

test('reveal: a wrong city alone clears only the city', () => {
  const f = { ...EMPTY_FILTERS, region: 'REGION X - NORTHERN MINDANAO', province: 'LANAO DEL NORTE', city: 'TUBOD' };
  const r = revealFilters(target, f, 'LIME-25-13-02-00-000-41');
  assert.deepEqual(r.cleared, ['city / municipality']);
  assert.deepEqual([r.filters.region, r.filters.province, r.filters.city], ['REGION X - NORTHERN MINDANAO', 'LANAO DEL NORTE', '']);
});

test('reveal: a category-specific filter that hides it is cleared on its own', () => {
  const f = { ...EMPTY_FILTERS, category: 'infrastructure' as const, type: 'Water Supply' };
  const r = revealFilters(target, f, 'LIME-25-13-02-00-000-41');
  assert.deepEqual(r.cleared, ['project type']);
  assert.equal(r.filters.category, 'infrastructure');
});

test('reveal: the resulting filters are valid map parameters (shareable)', () => {
  const r = revealFilters(target, { ...EMPTY_FILTERS, region: 'X', province: 'Y' }, 'LIME-25-13-02-00-000-41');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(r.filters)) if (v !== '' && v !== null && v !== true) params.set(k, String(v));
  assert.ok(parseSubaybayanQuery(params).ok);
});

// --- links and wording --------------------------------------------------------

test('map link: by code when the code is unique to the row, by id otherwise', () => {
  assert.equal(projectMapLink({ id: 'LIME-25-13-02-00-000-41', project_code: 'LIME-25-13-02-00-000-41' }), '/projects/map?layer=subaybayan&code=LIME-25-13-02-00-000-41');
  assert.equal(projectMapLink({ id: 'rlip-b01-r122', project_code: 'RLIP-25-12-47-04-000-80' }), '/projects/map?layer=subaybayan&focus=rlip-b01-r122');
  assert.equal(projectMapLink({ id: 'lgsf-b01-r9', project_code: null }), '/projects/map?layer=subaybayan&focus=lgsf-b01-r9');
});

test('the search box accepts pasted dashes', () => {
  assert.ok(parseSubaybayanQuery(new URLSearchParams('q=LIME—25—13')).ok);
  assert.equal(joinList(['category']), 'category');
  assert.equal(joinList(['category', 'region', 'status']), 'category, region and status');
});

test('code full-text query: Postgres lexemes as an ordered phrase, prefix on the last part', async () => {
  const { codeTsQuery } = await import('@/lib/subaybayan/code');
  assert.equal(codeTsQuery('LIME-25-13-02-00-000-4'), 'lime <-> -25 <-> -13 <-> -02 <-> -00 <-> -000 <-> -4:*');
  assert.equal(codeTsQuery('lime–25–13'), 'lime <-> -25 <-> -13:*');
  assert.equal(codeTsQuery('GEF-26-17-59-04-000-4A'), 'gef <-> -26 <-> -17 <-> -59 <-> -04 <-> -000 <-> -4 <-> a:*');
  assert.equal(codeTsQuery('COVID-19'), 'covid <-> -19:*');
  for (const t of ['farm road', 'LIME', 'FARM-TO-MARKET', '25-13', "LIME-25' | x", 'LIME-25-13 road']) assert.equal(codeTsQuery(t), null, t);
});
