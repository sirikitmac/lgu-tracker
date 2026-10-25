import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashRecord, normalizeDetailsRow, titleCasePlace } from '@/lib/integrations/dpwh/nationwide/normalize';
import { realRow, revision, rowWithId } from './fixtures';

function ok(row: Record<string, unknown>) {
  const result = normalizeDetailsRow(row, revision);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  return result.record;
}

test('keeps the implementing office separate from the reported location', () => {
  const r = ok(realRow);
  // The source "province" column holds the implementing office ("Region XIII").
  assert.equal(r.implementing_office, 'Region XIII');
  assert.equal(r.implementing_region, 'Region XIII');
  // Location comes from the component.
  assert.equal(r.region, 'Region XIII');
  assert.equal(r.province, 'Agusan del Norte');
  assert.deepEqual(r.provinces, ['Agusan del Norte']);
  // Not in the source: never inferred.
  assert.equal(r.municipality, null);
  assert.equal(r.barangay, null);
});

test('does not use the office region as location when components are missing', () => {
  const r = ok(rowWithId('20N00066', { components: [] }));
  assert.equal(r.region, null);
  assert.equal(r.province, null);
  assert.equal(r.implementing_region, 'Region XIII');
  assert.ok(r.data_warnings.includes('no_component_location'));
});

test('flags multi-province contracts instead of picking one', () => {
  const second = { ...(realRow.components as object[])[0], componentId: 'X-2', province: 'SURIGAO DEL NORTE' };
  const r = ok(rowWithId('20N00067', { components: [...(realRow.components as object[]), second] }));
  assert.equal(r.province, null);
  assert.deepEqual(r.provinces, ['Agusan del Norte', 'Surigao del Norte']);
  assert.ok(r.data_warnings.includes('multiple_provinces'));
});

test('parses amounts, dates, and booleans from their real source formats', () => {
  const r = ok(realRow);
  assert.equal(r.contract_amount, 102410000); // "102,410,000.00"
  assert.equal(r.approved_budget, 102874773.39);
  assert.equal(r.budget, 102874773.39);
  assert.equal(r.amount_paid, 0); // bigint 0
  assert.equal(r.award_date, '2020-02-17'); // "2020-02-17 00:00:00.0000000"
  assert.equal(r.start_date, '2020-03-25'); // Date object
  assert.equal(r.latest_image_date, '2021-03-01');
  assert.equal(r.total_images, 12);
  assert.equal(r.infra_year, 2020);
  assert.equal(r.status, 'completed');
  assert.equal(r.category, 'flood_control_drainage');
  // Identical to the description in the source, so not stored twice.
  assert.equal(r.contract_name, null);
  assert.equal(ok(rowWithId('20N00071', { contractName: 'SEAWALL PACKAGE 2' })).contract_name, 'SEAWALL PACKAGE 2');
});

test('drops invalid values with a warning instead of guessing', () => {
  const r = ok(rowWithId('20N00068', {
    progress: 140, awardAmount: 'TBD', dateOfAward: '17/02/2020', latitude: 0, longitude: 0, status: 'Suspended',
  }));
  assert.equal(r.progress, null);
  assert.equal(r.contract_amount, null);
  assert.equal(r.award_date, null);
  assert.equal(r.latitude, null);
  assert.equal(r.status, 'unknown');
  for (const code of ['invalid_progress', 'invalid_number:awardAmount', 'invalid_date:dateOfAward', 'invalid_coordinates', 'unknown_status']) {
    assert.ok(r.data_warnings.includes(code), code);
  }
});

test('rejects only rows without a usable identifier or description', () => {
  assert.deepEqual(normalizeDetailsRow(rowWithId('', {}), revision), { ok: false, contractId: null, reason: 'Missing contractId.' });
  assert.equal((normalizeDetailsRow(rowWithId('bad id!'), revision) as { reason: string }).reason, 'Malformed contractId.');
  assert.equal((normalizeDetailsRow(rowWithId('20N00069', { description: '  ' }), revision) as { reason: string }).reason, 'Missing description.');
  assert.ok(normalizeDetailsRow(rowWithId('20N00070', { components: null, contractor: null, abc: null }), revision).ok);
});

test('hash is stable, ignores the snapshot URL, and changes with source values', () => {
  const a = ok(realRow);
  const b = normalizeDetailsRow(realRow, { ...revision, fileUrl: 'https://example.org/newer.parquet' });
  assert.ok(b.ok);
  assert.equal(b.record.source_hash, a.source_hash);
  assert.notEqual(ok(rowWithId('20N00065', { progress: 99 })).source_hash, a.source_hash);
  const { source_hash, ...rest } = a;
  assert.equal(hashRecord(rest), source_hash);
});

test('title-cases Philippine place names', () => {
  assert.equal(titleCasePlace('DAVAO DEL SUR'), 'Davao del Sur');
  assert.equal(titleCasePlace('TAWI-TAWI'), 'Tawi-Tawi');
  assert.equal(titleCasePlace('METROPOLITAN MANILA'), 'Metropolitan Manila');
  assert.equal(titleCasePlace(null), null);
});
