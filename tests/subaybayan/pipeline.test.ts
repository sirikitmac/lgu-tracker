import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyProject } from '../../scripts/subaybayan/lib/classify';
import { normalizePlaceName, splitPlaceList } from '../../scripts/subaybayan/lib/names';
import { assignIds } from '../../scripts/subaybayan/lib/records';
import { mapStatus, parseDate, parseMoney, parseOwpa, pickCost, plausibleTotal, resolveCost, assertHeaders, COL } from '../../scripts/subaybayan/lib/extract';
import { Gazetteer, locate } from '../../scripts/subaybayan/lib/locate';
import type { Place } from '../../scripts/subaybayan/lib/gazetteer';
import { columnIndex, decodeXml } from '../../scripts/subaybayan/lib/xlsx';

const cat = (title: string, extra: Partial<Parameters<typeof classifyProject>[0]> = {}) => classifyProject({ title, ...extra });

// --- categorization -----------------------------------------------------------

test('classify: first matching rule wins, in rule order', () => {
  assert.equal(cat('Construction of Evacuation Center / Multi-Purpose Hall').subcategory, 'Evacuation centers');
  assert.equal(cat('Construction of Slope Protection along Barangay Road').category, 'disaster');
  assert.equal(cat('Rehabilitation of Barangay Health Station').subcategory, 'Health facilities');
  assert.equal(cat('Concreting of Farm-to-Market Road').subcategory, 'Roads and bridges');
  assert.equal(cat('Construction of Multi-Purpose Building').subcategory, 'Markets and multipurpose buildings');
  assert.equal(cat('Construction of Covered Court').subcategory, 'Community facilities');
  assert.equal(cat('Construction of Barangay Hall').subcategory, 'Public buildings');
  assert.equal(cat('Installation of Solar Streetlights').subcategory, 'Other public infrastructure');
  assert.equal(cat('Level II Water System').subcategory, 'Water supply systems');
});

test('classify: title is matched through all rules before component details', () => {
  const r = cat('Concreting of Barangay Road', { componentDetails: 'Grouted riprap, slope protection, toilet' });
  assert.equal(r.subcategory, 'Roads and bridges');
  assert.equal(r.reason, 'title keyword "concreting"');
  const c = cat('Construction of Kibuyayo Protection Wall', { componentDetails: 'Grouted riprap' });
  assert.equal(c.category, 'disaster');
  assert.match(c.reason, /^component keyword "riprap"/);
});

test('classify: whole words only ("park" does not match "motorpool")', () => {
  assert.equal(cat('Construction of Municipal Motorpool').subcategory, 'Public buildings');
  assert.equal(cat('Improvement of Public Park').subcategory, 'Community facilities');
  assert.equal(cat('Repair of Supports').category, 'uncategorized'); // "port" inside "support"
});

test('classify: bare "rice" and "food" are not social services; aid phrases are', () => {
  assert.notEqual(cat('Construction of Rice Mill').subcategory, 'Social services');
  assert.notEqual(cat('Construction of Food Park').subcategory, 'Social services');
  assert.equal(cat('Rice Distribution to Indigent Families').subcategory, 'Social services');
  assert.equal(cat('Distribution of Milled Rice').subcategory, 'Social services');
  assert.equal(cat('Food Assistance Program').subcategory, 'Social services');
});

test('classify: fallbacks by project type, program, placeholder', () => {
  assert.deepEqual(cat('Pamilihang Bayan Phase 3', { projectType: 'Local Roads and Bridges' }), {
    category: 'infrastructure', subcategory: 'Roads and bridges', reason: 'project type "Local Roads and Bridges"',
  });
  assert.equal(cat('Something', { program: ' Support and Assistance Fund to Participatory Budgeting (SAFPB)' }).subcategory, 'Community development programs');
  assert.equal(cat('Something', { program: 'Green Green Green' }).category, 'environment');
  assert.equal(cat('<Please Insert Project Title>').reason, 'placeholder title ("please insert")');
  assert.equal(cat('Improvement of Pikaw Falls').category, 'uncategorized');
});

// --- names --------------------------------------------------------------------

test('normalizePlaceName: accents, parentheses, city prefixes, abbreviations', () => {
  assert.equal(normalizePlaceName('CITY OF LAS PIñAS'), 'las pinas');
  assert.equal(normalizePlaceName('City of Las Piñas'), 'las pinas');
  assert.equal(normalizePlaceName('CITY OF CAGAYAN DE ORO (CAPITAL)'), 'cagayan de oro');
  assert.equal(normalizePlaceName('Quezon City'), 'quezon');
  assert.equal(normalizePlaceName('COTABATO (NORTH COTABATO)'), 'cotabato');
  assert.equal(normalizePlaceName('Brgy. Sto. Niño'), 'santo nino');
  assert.equal(normalizePlaceName('Sta. Cruz'), 'santa cruz');
  assert.equal(normalizePlaceName('Gen. Ferrer Pob.'), 'general ferrer poblacion');
  assert.equal(normalizePlaceName('Barangay 3'), '3');
  assert.equal(normalizePlaceName("T'bolok"), 't bolok');
  assert.equal(normalizePlaceName(null), '');
});

test('splitPlaceList: lists split on comma, "and", slash, semicolon', () => {
  assert.deepEqual(splitPlaceList('Batug, Casulongan'), ['Batug', 'Casulongan']);
  assert.deepEqual(splitPlaceList('Bantayan and Bato / Lapu; Tala'), ['Bantayan', 'Bato', 'Lapu', 'Tala']);
  assert.deepEqual(splitPlaceList('Abuno'), ['Abuno']);
});

// --- ids ----------------------------------------------------------------------

test('assignIds: unique codes kept, repeated or missing codes get batch/row ids, all unique', () => {
  const ids = assignIds([
    { source_dataset: 'rlip', project_code: 'A-1', source_batch: 1, source_row: 11 },
    { source_dataset: 'rlip', project_code: 'B-1', source_batch: 1, source_row: 12 },
    { source_dataset: 'rlip', project_code: 'B-1', source_batch: 3, source_row: 40 },
    { source_dataset: 'rlip', project_code: null, source_batch: 2, source_row: 15 },
    { source_dataset: 'lgsf', project_code: 'B-1', source_batch: 1, source_row: 11 },
  ]);
  assert.deepEqual(ids, ['A-1', 'rlip-b01-r12', 'rlip-b03-r40', 'rlip-b02-r15', 'B-1']);
  assert.equal(new Set(ids).size, ids.length);
});

test('assignIds: throws when ids collide', () => {
  assert.throws(
    () => assignIds([
      { source_dataset: 'rlip', project_code: 'rlip-b01-r12', source_batch: 9, source_row: 9 },
      { source_dataset: 'rlip', project_code: null, source_batch: 1, source_row: 12 },
    ]),
    /not unique/
  );
});

// --- value parsing ------------------------------------------------------------

test('parsers: money, OWPA, dates, status, cost choice', () => {
  const issues: string[] = [];
  const issue = (f: string) => issues.push(f);
  assert.equal(parseMoney('3,900,169.00', 'x', issue), 3900169);
  assert.equal(parseMoney(2490000, 'x', issue), 2490000);
  assert.equal(parseMoney('', 'x', issue), null);
  assert.equal(parseMoney('about 2M', 'x', issue), null);
  assert.deepEqual(issues, ['x']);
  assert.equal(parseOwpa('1). 20\n2). 65.5\n', issue), 65.5);
  assert.equal(parseOwpa(100, issue), 100);
  assert.equal(parseOwpa(140, issue), null);
  assert.equal(parseDate('2025-11-17', 'd', issue), '2025-11-17');
  assert.equal(parseDate('2025-02-30', 'd', issue), null);
  assert.equal(parseDate(45000, 'd', issue), '2023-03-15');
  assert.equal(mapStatus('On-going'), 'ongoing');
  assert.equal(mapStatus('Not-Implemented'), 'cancelled');
  assert.equal(mapStatus('Terminated'), 'cancelled');
  assert.equal(mapStatus('Suspended'), 'unknown');
  assert.equal(pickCost(100, 90, 50, 5), 100);
  assert.equal(pickCost(null, 90, 50, 5), 90);
  assert.equal(pickCost(null, null, 50, 5), 55);
  assert.equal(pickCost(null, null, null, 0), null);
  assert.equal(pickCost(0, null, null, null), null);
});

test('assertHeaders: fails loudly when a key column moves', () => {
  const fields: (string | null)[] = [];
  const subs: (string | null)[] = [];
  const set = (i: number, v: string) => (fields[i] = v);
  set(COL.region, 'REGION'); set(COL.province, 'PROVINCE'); set(COL.citymun, 'CITY /\nMUNICIPALITY'); set(COL.barangay, 'BARANGAY');
  set(COL.projectCode, 'PROJECT CODE'); set(COL.title, 'PROJECT TITLE'); set(COL.componentDetails, 'COMPONENT DETAILS');
  set(COL.program, 'PROGRAM'); set(COL.projectType, 'PROJECT TYPE'); set(COL.fundingYear, 'FUNDING YEAR');
  set(COL.physicalStatus, 'PHYSICAL STATUS'); set(COL.startDate, 'START DATE'); set(COL.endDate, 'END DATE');
  set(COL.totalCost, 'TOTAL PROGRAM / PROJECT COST'); set(COL.owpa, 'LATEST OWPA TO DATE (%)');
  set(COL.contractor, 'CONTRACTOR'); set(COL.contractAmount, 'CONTRACT AMOUNT');
  subs[COL.nationalSubsidy] = 'NATIONAL SUBSIDY';
  subs[COL.lguCounterpart] = 'LGU COUNTERPART';
  const rows = [...Array(8).fill([]), fields, subs];
  assert.doesNotThrow(() => assertHeaders('f.xlsx', rows));
  fields[COL.projectCode] = 'CODE';
  assert.throws(() => assertHeaders('f.xlsx', rows), /column 5 is "CODE", expected "PROJECT CODE"/);
});

test('xlsx helpers: column letters and XML entities', () => {
  assert.equal(columnIndex('A'), 0);
  assert.equal(columnIndex('AA'), 26);
  assert.equal(columnIndex('EL'), 141);
  assert.equal(decodeXml('A &amp; B &lt;x&gt; &#241;'), 'A & B <x> ñ');
});

// --- locations ----------------------------------------------------------------

const place = (level: Place['level'], code: string, name: string, parent: string | null, lat: number, lng: number): Place => ({
  level, code, name, norm: normalizePlaceName(name), parent, lat, lng,
});
const fixture = new Gazetteer([
  place('region', '1000000000', 'Region X (Northern Mindanao)', null, 8, 124),
  place('region', '1300000000', 'National Capital Region (NCR)', null, 14.6, 121),
  place('province', '1003500000', 'Lanao del Norte', '1000000000', 8, 124),
  place('province', '1004300000', 'Misamis Oriental', '1000000000', 8.5, 124.7),
  place('citymun', '1030900000', 'City of Iligan', '1003500000', 8.2, 124.3),
  place('citymun', '1003501000', 'Bacolod', '1003500000', 8.18, 124.0),
  place('barangay', '1030900001', 'Abuno', '1030900000', 8.18, 124.25),
  place('barangay', '1030900050', 'Sixto Velez, Sr.', '1030900000', 8.21, 124.2),
  place('barangay', '1030900060', 'Poblacion', '1030900000', 8.22, 124.23),
  place('barangay', '1030900061', 'Poblacion', '1030900000', 8.23, 124.24),
  place('province', '1307400000', 'NCR, Second District (Not a Province)', '1300000000', 14.6, 121.05),
  place('citymun', '1380600000', 'Quezon City', '1307400000', 14.65, 121.05),
]);
const loc = (region: string, province: string | null, citymun: string | null, barangay: string | null) =>
  locate(fixture, { region, province, citymun, barangay });

test('locate: barangay within city within province', () => {
  const r = loc('REGION X - NORTHERN MINDANAO', 'LANAO DEL NORTE', 'BACOLOD', null);
  assert.equal(r.location_precision, 'municipality_centroid');
  assert.equal(r.psgc_citymun, '1003501000');
});

test('locate: HUC / NCR city written in the province column is matched as a city in the region', () => {
  const r = loc('REGION X - NORTHERN MINDANAO', 'CITY OF ILIGAN', 'CITY OF ILIGAN', 'Abuno');
  assert.equal(r.location_precision, 'barangay_centroid');
  assert.equal(r.psgc_barangay, '1030900001');
  assert.equal(r.psgc_province, '1003500000');
  assert.deepEqual([r.latitude, r.longitude], [8.18, 124.25]);
  const ncr = loc('NATIONAL CAPITAL REGION', 'QUEZON CITY', 'QUEZON CITY', null);
  assert.equal(ncr.psgc_citymun, '1380600000');
  assert.equal(ncr.location_precision, 'municipality_centroid');
});

test('locate: comma inside one barangay name is tried whole; real lists fall back to the city', () => {
  assert.equal(loc('REGION X - NORTHERN MINDANAO', 'CITY OF ILIGAN', 'CITY OF ILIGAN', 'Sixto Velez, Sr.').psgc_barangay, '1030900050');
  const list = loc('REGION X - NORTHERN MINDANAO', 'CITY OF ILIGAN', 'CITY OF ILIGAN', 'Abuno, Sixto Velez Sr.');
  assert.equal(list.location_precision, 'municipality_centroid');
  assert.match(list.note, /several barangays/);
});

test('locate: ambiguous names are not guessed; province-level and unknown regions', () => {
  const amb = loc('REGION X - NORTHERN MINDANAO', 'CITY OF ILIGAN', 'CITY OF ILIGAN', 'Poblacion');
  assert.equal(amb.location_precision, 'municipality_centroid');
  assert.match(amb.note, /ambiguous/);
  const prov = loc('REGION X - NORTHERN MINDANAO', 'MISAMIS ORIENTAL', null, null);
  assert.equal(prov.location_precision, 'province_centroid');
  assert.deepEqual([prov.latitude, prov.longitude], [8.5, 124.7]);
  const none = loc('REGION X - NORTHERN MINDANAO', null, null, null);
  assert.equal(none.location_precision, 'unresolved');
  assert.equal(none.latitude, null);
  assert.equal(loc('ATLANTIS', 'X', 'Y', 'Z').location_precision, 'unresolved');
});

test("plausibleTotal: totals far above the row's own amounts are logged and skipped, never rescaled", () => {
  const issues: string[] = [];
  const issue = (f: string) => issues.push(f);
  assert.equal(plausibleTotal(1994699780, null, 2000000, null, issue), null);
  assert.equal(pickCost(plausibleTotal(1994699780, null, 2000000, null, issue), null, 2000000, null), 2000000);
  assert.equal(plausibleTotal(2490000, 2490000, 2500000, 0, issue), 2490000);
  assert.equal(plausibleTotal(8789534586, null, null, null, issue), 8789534586); // no reference: kept as reported
  // A tiny contract amount is the suspect value, not the total: the total is kept.
  assert.equal(plausibleTotal(999017.83, 99, null, null, issue), 999017.83);
  assert.equal(plausibleTotal(200000, 1999.83, null, null, issue), 200000);
  assert.deepEqual(issues, ['total_project_cost_implausible', 'total_project_cost_implausible']);
});

test('resolveCost: a replaced total keeps the reported value and says what is used instead', () => {
  const noop = () => undefined;
  assert.deepEqual(resolveCost(1994699780, null, 2000000, null, noop), { total_cost: 2000000, total_cost_reported: 1994699780, total_cost_basis: 'subsidy_plus_counterpart' });
  assert.deepEqual(resolveCost(101072637659, 1994838.96, 2000000, null, noop), { total_cost: 1994838.96, total_cost_reported: 101072637659, total_cost_basis: 'contract_amount' });
  assert.deepEqual(resolveCost(2490000, 2490000, 2500000, 0, noop), { total_cost: 2490000, total_cost_reported: null, total_cost_basis: null });
  assert.deepEqual(resolveCost(null, null, 2000000, 0, noop), { total_cost: 2000000, total_cost_reported: null, total_cost_basis: null });
});
