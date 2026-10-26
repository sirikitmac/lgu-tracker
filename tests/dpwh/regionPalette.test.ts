import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLORED_REGIONS, REGION_NEUTRAL, regionColor, regionDisplayName, regionInfo } from '@/lib/regionPalette';
import { STATUS_TONES } from '@/lib/statusPalette';

// The ten regions in the DPWH contracts dataset, as the data spells them.
const DATA_REGIONS = [
  'Region VIII', 'Region X', 'Region VII', 'Region XI', 'Region VI', 'Negros Island Region',
  'Region XII', 'Region XIII', 'Region IX', 'Bangsamoro Autonomous Region in Muslim Mindanao',
];

test('every region in the contract data has its own colour', () => {
  const colors = DATA_REGIONS.map(regionColor);
  assert.equal(new Set(colors).size, DATA_REGIONS.length);
  assert.ok(!colors.includes(REGION_NEUTRAL));
  assert.deepEqual([...COLORED_REGIONS].sort(), [...DATA_REGIONS].sort());
});

test('region colours never reuse a status colour', () => {
  const statusFills = new Set(Object.values(STATUS_TONES).map((t) => t.fill.toUpperCase()));
  for (const region of DATA_REGIONS) assert.ok(!statusFills.has(regionColor(region).toUpperCase()), region);
});

test('colour is keyed by name, not order, and tolerates spacing, case and aliases', () => {
  assert.equal(regionColor('Region X'), regionColor('  region   x '));
  assert.equal(regionColor('BARMM'), regionColor('Bangsamoro Autonomous Region in Muslim Mindanao'));
  assert.equal(regionColor('Caraga'), regionColor('Region XIII'));
  assert.equal(regionDisplayName('Region X'), 'Region X · Northern Mindanao');
  assert.equal(regionDisplayName('Bangsamoro Autonomous Region in Muslim Mindanao'), 'BARMM');
});

test('missing, Luzon and unknown regions are neutral rather than borrowing a colour', () => {
  assert.equal(regionColor(null), REGION_NEUTRAL);
  assert.equal(regionColor(''), REGION_NEUTRAL);
  assert.equal(regionInfo(null).name, 'Region not reported');
  assert.equal(regionColor('Region IV-A'), REGION_NEUTRAL);
  assert.equal(regionInfo('Region IV-A').islandGroup, 'Luzon');
  assert.equal(regionColor('Atlantis'), REGION_NEUTRAL);
  assert.equal(regionDisplayName('Atlantis'), 'Atlantis');
});
