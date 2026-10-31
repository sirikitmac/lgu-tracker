import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { as, createTestDb } from './pglite';
import { directoryProvinceLabel, directoryRegionLabel } from '@/lib/subaybayan/ui';

/**
 * Migration 20261105000100: DILG SubayBAYAN rows in public.project_directory,
 * against a local PGlite database with every migration applied in order.
 * Never touches the hosted project.
 */

let db: PGlite;
before(async () => {
  db = await createTestDb();
  const rows = [
    row('RLIP-ROAD', { region: 'REGION X - NORTHERN MINDANAO', province: 'LANAO DEL NORTE', citymun: 'CITY OF ILIGAN', total_cost: 2_000_000, owpa: 40, status: 'ongoing' }),
    row('LIME-SIGN', { sector_category: 'community', sector_subcategory: 'Livelihood initiatives', total_cost: 2_500_000_000, total_cost_review: true, region: 'MIMAROPA', province: 'PALAWAN' }),
    row('FALGU-RICE', { source_dataset: 'lgsf', sector_category: 'health', sector_subcategory: 'Social services', status: 'cancelled', total_cost: 384_000_000, region: 'REGION IV-A - CALABARZON', province: 'DAVAO DE ORO' }),
    row('rlip-b01-r9', { project_code: null, sector_subcategory: 'Disaster mitigation and preparedness', sector_category: 'disaster', status: 'unknown', total_cost: null, total_cost_reported: 9_000_000, total_cost_basis: 'contract_amount', region: 'CORDILLERA ADMINISTRATIVE REGION' }),
  ];
  for (const r of rows) {
    const cols = Object.keys(r);
    const res = await as(db, 'service_role', null, `insert into public.subaybayan_projects (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(r));
    assert.equal(res.error, undefined, String(res.error));
  }
});

function row(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    source_dataset: 'rlip',
    project_code: id,
    title: 'Concreting of Barangay Road',
    sector_category: 'infrastructure',
    sector_subcategory: 'Roads and bridges',
    classification_reason: 'title keyword "road"',
    latitude: 8.2,
    longitude: 124.2,
    location_precision: 'barangay_centroid',
    status: 'completed',
    project_owner: 'Citymun',
    barangay: 'POBLACION',
    source_url: 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip',
    retrieved_at: '2026-10-31',
    source_hash: 'abc',
    ...patch,
  };
}

const PREVIOUS_COLUMNS = [
  'source', 'record_id', 'title', 'contract_name', 'category', 'status', 'region', 'province', 'provinces', 'municipality',
  'implementing_office', 'contractor', 'budget', 'contract_amount', 'progress', 'start_date', 'completion_date', 'infra_year',
  'search', 'latitude', 'longitude', 'contract_effectivity_date', 'amount_label', 'status_key',
];

test('existing columns keep their order and types; DILG columns are appended', async () => {
  const res = await db.query<{ column_name: string; udt_name: string }>(
    `select column_name, udt_name from information_schema.columns where table_schema = 'public' and table_name = 'project_directory' order by ordinal_position`
  );
  const names = res.rows.map((r) => r.column_name);
  assert.deepEqual(names.slice(0, PREVIOUS_COLUMNS.length), PREVIOUS_COLUMNS);
  assert.deepEqual(names.slice(PREVIOUS_COLUMNS.length), [
    'agency', 'sector_category', 'sector_subcategory', 'location_precision', 'cost_adjusted', 'amount_needs_review',
    'total_cost', 'project_owner', 'project_code', 'barangay',
  ]);
  const types = Object.fromEntries(res.rows.map((r) => [r.column_name, r.udt_name]));
  assert.equal(types.category, 'dpwh_category');
  assert.equal(types.status, 'dpwh_status');
  assert.equal(types.contract_amount, 'numeric');
  assert.equal(types.latitude, 'float8');
  assert.equal(types.infra_year, 'int2');
  const opts = await db.query<{ reloptions: string[] | null }>(`select reloptions from pg_class where oid = 'public.project_directory'::regclass`);
  assert.ok(opts.rows[0].reloptions?.includes('security_invoker=true'));
});

test('DILG rows map onto the directory columns for the public', async () => {
  const res = await as<Record<string, unknown>>(db, 'anon', null, `
    select source, record_id, agency, category::text, status::text, status_key, region, province, provinces, municipality,
           contract_amount::float8 contract_amount, budget, total_cost::float8 total_cost, progress::float8 progress,
           amount_label, cost_adjusted, amount_needs_review, sector_category, sector_subcategory, project_code
    from public.project_directory where agency = 'DILG' order by record_id`);
  assert.equal(res.error, undefined);
  const by = Object.fromEntries(res.rows!.map((r) => [r.record_id, r]));
  assert.deepEqual(Object.keys(by).sort(), ['FALGU-RICE', 'LIME-SIGN', 'RLIP-ROAD', 'rlip-b01-r9']);

  const road = by['RLIP-ROAD'];
  assert.equal(road.source, 'subaybayan_rlip');
  assert.equal(road.category, 'roads_highways');
  assert.equal(road.status, 'ongoing');
  assert.equal(road.region, 'Region X');
  assert.equal(road.province, 'Lanao del Norte');
  assert.deepEqual(road.provinces, ['Lanao del Norte']);
  assert.equal(road.municipality, 'CITY OF ILIGAN');
  assert.equal(road.contract_amount, 2_000_000);
  assert.equal(road.total_cost, 2_000_000);
  assert.equal(road.budget, null);
  assert.equal(road.progress, 40);
  assert.equal(road.amount_label, 'Total project cost');

  // Flagged total: still shown (total_cost), but kept out of the amount sort column.
  const sign = by['LIME-SIGN'];
  assert.equal(sign.amount_needs_review, true);
  assert.equal(sign.contract_amount, null);
  assert.equal(sign.total_cost, 2_500_000_000);
  assert.equal(sign.category, 'uncategorized', 'non-infrastructure DILG work maps to uncategorized');
  assert.equal(sign.region, 'Region IV-B');

  const rice = by['FALGU-RICE'];
  assert.equal(rice.source, 'subaybayan_lgsf');
  assert.equal(rice.status, 'terminated', 'cancelled -> terminated');
  assert.equal(rice.status_key, 'terminated');
  assert.equal(rice.region, 'Region IV-A');
  assert.equal(rice.province, 'Davao de Oro');

  const disaster = by['rlip-b01-r9'];
  assert.equal(disaster.category, 'flood_control_drainage');
  assert.equal(disaster.status, 'unknown');
  assert.equal(disaster.cost_adjusted, true);
  assert.equal(disaster.project_code, null);
  assert.equal(disaster.region, 'Cordillera Administrative Region');
});

test('the client label helpers match the SQL ones', async () => {
  const samples = ['REGION X - NORTHERN MINDANAO', 'REGION IV-A - CALABARZON', 'MIMAROPA', 'NATIONAL CAPITAL REGION', 'NEGROS ISLAND REGION', 'Somewhere'];
  for (const r of samples) {
    const sql = await db.query<{ v: string }>(`select private.subaybayan_region_label($1) v`, [r]);
    assert.equal(directoryRegionLabel(r), sql.rows[0].v, r);
  }
  for (const p of ['LANAO DEL NORTE', 'DAVAO DE ORO', 'CITY OF LAS PIñAS', 'COTABATO (NORTH COTABATO)', 'CITY OF ISABELA (Not a Province)', 'MOUNTAIN PROVINCE']) {
    const sql = await db.query<{ v: string }>(`select private.subaybayan_province_label($1) v`, [p]);
    assert.equal(directoryProvinceLabel(p), sql.rows[0].v, p);
  }
});

test('agency, sector and search filters', async () => {
  const count = async (where: string) =>
    (await as<{ n: number }>(db, 'anon', null, `select count(*)::int n from public.project_directory where ${where}`)).rows![0].n;
  assert.equal(await count(`agency = 'DILG'`), 4);
  assert.equal(await count(`agency = 'DPWH'`), await count(`source in ('dpwh_contracts', 'dpwh_nep_2027')`));
  assert.equal(await count(`sector_category = 'health'`), 1);
  assert.equal(await count(`source = 'subaybayan_lgsf'`), 1);
  assert.equal(await count(`search @@ to_tsquery('simple', 'iligan:*') and agency = 'DILG'`), 1);
  assert.equal(await count(`region = 'Region X' and agency = 'DILG'`), 1);
  assert.equal(await count(`provinces @> array['Lanao del Norte'] and agency = 'DILG'`), 1);
});

test('default sort ranks unverified DILG totals after verified ones', async () => {
  const res = await as<{ record_id: string }>(db, 'anon', null,
    `select record_id from public.project_directory where agency = 'DILG' order by contract_amount desc nulls last, source, record_id`);
  assert.deepEqual(res.rows!.map((r) => r.record_id), ['FALGU-RICE', 'RLIP-ROAD', 'LIME-SIGN', 'rlip-b01-r9']);
});

test('the DILG arm reads its expression indexes (view and index expressions stay in sync)', async () => {
  const plan = async (sql: string) => {
    await db.exec('set enable_seqscan = off; set enable_sort = off;');
    try {
      return (await db.query<{ 'QUERY PLAN': string }>(`explain ${sql}`)).rows.map((r) => r['QUERY PLAN']).join('\n');
    } finally {
      await db.exec('reset enable_seqscan; reset enable_sort;');
    }
  };
  const cols = 'source, record_id';
  const cases: [string, string][] = [
    [`select ${cols} from public.project_directory where agency = 'DILG' order by contract_amount desc nulls last, source, record_id limit 5`, 'subaybayan_projects_directory_amount_idx'],
    [`select ${cols} from public.project_directory where agency = 'DILG' order by contract_amount asc nulls last, source, record_id limit 5`, 'subaybayan_projects_directory_amount_asc_idx'],
    [`select ${cols} from public.project_directory where agency = 'DILG' order by progress desc nulls last, source, record_id limit 5`, 'subaybayan_projects_directory_progress_idx'],
    [`select ${cols} from public.project_directory where agency = 'DILG' order by start_date desc nulls last, source, record_id limit 5`, 'subaybayan_projects_directory_start_idx'],
    [`select ${cols} from public.project_directory where agency = 'DILG' order by title asc nulls last, source, record_id limit 5`, 'subaybayan_projects_directory_title_idx'],
    [`select ${cols} from public.project_directory where agency = 'DILG' order by region asc nulls last, province asc nulls last, source, record_id limit 5`, 'subaybayan_projects_directory_location_idx'],
    [`select count(*) from public.project_directory where search @@ to_tsquery('simple', 'road:*') and agency = 'DILG'`, 'subaybayan_projects_search_idx'],
    [`select count(*) from public.project_directory where region = 'Region X' and agency = 'DILG'`, 'subaybayan_projects_directory_region_idx'],
    [`select count(*) from public.project_directory where status_key = 'terminated' and agency = 'DILG'`, 'subaybayan_projects_directory_status_idx'],
    [`select count(*) from public.project_directory where category = 'roads_highways' and agency = 'DILG'`, 'subaybayan_projects_directory_category_idx'],
    [`select count(*) from public.project_directory where source = 'subaybayan_lgsf'`, 'subaybayan_projects_directory_source_idx'],
  ];
  for (const [sql, index] of cases) assert.match(await plan(sql), new RegExp(index), sql);
  // The agency filter is a constant per arm: DPWH tables are not read for DILG.
  assert.doesNotMatch(await plan(`select ${cols} from public.project_directory where agency = 'DILG' limit 5`), /dpwh_contracts|infrastructure_projects/);
});
