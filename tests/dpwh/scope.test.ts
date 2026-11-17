import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLORED_REGIONS } from '@/lib/regionPalette';
import { DEFAULT_SCOPE_REGIONS, LUZON_REGIONS, scopeFromEnv } from '@/lib/integrations/dpwh/nationwide/scope';
import { REGION_NAMES, regionCode } from '@/components/landing/content';

test('the default sync scope is Visayas, Mindanao and the Luzon slice, each region once', () => {
  assert.equal(new Set(DEFAULT_SCOPE_REGIONS).size, DEFAULT_SCOPE_REGIONS.length);
  assert.equal(DEFAULT_SCOPE_REGIONS.length, 13);
  for (const region of LUZON_REGIONS) assert.ok(DEFAULT_SCOPE_REGIONS.includes(region), region);
  assert.deepEqual(scopeFromEnv(undefined), DEFAULT_SCOPE_REGIONS);
});

test('every region in the default scope has a colour and a common name', () => {
  for (const region of DEFAULT_SCOPE_REGIONS) {
    assert.ok(COLORED_REGIONS.includes(region), `${region} has no colour`);
    assert.ok(REGION_NAMES[region], `${region} has no common name`);
  }
  assert.equal(regionCode('National Capital Region'), 'NCR');
  assert.equal(regionCode('Region III'), 'Region III');
});
