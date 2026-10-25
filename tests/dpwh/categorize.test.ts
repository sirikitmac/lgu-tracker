import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categorize, isFundingLabel } from '@/lib/integrations/dpwh/nationwide/categorize';

const none = { sourceCategory: null, infraType: null, typesOfWork: [], description: null };

test('uses the DPWH source category when it is a work type', () => {
  const r = categorize({ ...none, sourceCategory: 'Bridges', description: 'CONSTRUCTION OF ROAD' });
  assert.deepEqual([r.category, r.method], ['bridges', 'source_category']);
});

test('reads the leading work type, not words describing the method', () => {
  const r = categorize({ ...none, sourceCategory: 'Roads: Construction - Slope Protection using Structural Measures (e.g. Revetment, Gabions)' });
  assert.equal(r.category, 'roads_highways');
  assert.equal(categorize({ ...none, sourceCategory: 'Bridges, Roads' }).category, 'bridges');
  assert.equal(categorize({ ...none, sourceCategory: 'Flood Control Structures, Roads' }).category, 'flood_control_drainage');
  assert.equal(categorize({ ...none, sourceCategory: 'Multi Purpose Buildings, School Buildings' }).category, 'buildings_facilities');
  assert.equal(categorize({ ...none, sourceCategory: 'Septage and Sewerage Plants' }).category, 'water_infrastructure');
});

test('skips funding labels and falls back to infra type', () => {
  assert.ok(isFundingLabel('GAA 2025 SSP'));
  assert.ok(isFundingLabel('Unprogrammed Appropriations 2024'));
  assert.ok(!isFundingLabel('Roads'));
  const r = categorize({ ...none, sourceCategory: 'GAA 2025 SSP', infraType: 'Water Provision and Storage' });
  assert.deepEqual([r.category, r.method], ['water_infrastructure', 'infra_type']);
});

test('falls back to component type of work, then description keywords', () => {
  const r1 = categorize({ ...none, sourceCategory: 'GAA 2024 OO-1', typesOfWork: ['Construction of Classrooms'] });
  assert.deepEqual([r1.category, r1.method], ['buildings_facilities', 'type_of_work']);
  const r2 = categorize({ ...none, description: 'CONSTRUCTION OF DRAINAGE ALONG NATIONAL ROADS' });
  assert.deepEqual([r2.category, r2.method], ['flood_control_drainage', 'description_keywords']);
  assert.equal(categorize({ ...none, description: 'WIDENING OF PERMANENT BRIDGE ALONG BUTUAN CITY ROAD' }).category, 'bridges');
  assert.equal(categorize({ ...none, description: 'CONCRETING OF FARM-TO-MARKET ROAD' }).category, 'roads_highways');
});

test('reports uncategorized only when nothing is usable, and never guesses', () => {
  const r = categorize({ ...none, sourceCategory: 'GAA 2025 SSP', description: 'PROCUREMENT OF SERVICES' });
  assert.deepEqual([r.category, r.method], ['uncategorized', 'none']);
  const other = categorize({ ...none, sourceCategory: 'Ports and Harbors' });
  assert.deepEqual([other.category, other.method], ['other_infrastructure', 'source_category']);
});

test('is deterministic and explains itself', () => {
  const input = { ...none, sourceCategory: 'GAA 2025 OO-2', description: 'REHABILITATION OF ROAD WITH SLIPS' };
  assert.deepEqual(categorize(input), categorize(input));
  assert.match(categorize(input).reason, /ROAD/);
});
