import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flagCostOutliers, median, REVIEW_MEDIAN_FACTOR, REVIEW_MIN_COST, reviewThreshold, subcategoryMedians } from '../../scripts/subaybayan/lib/review';
import { withCostReview, rowHash, type ProjectRow } from '../../scripts/subaybayan/lib/records';
import { dilgPhotoCategory, directoryProvinceLabel, directoryRegionLabel, implementingLgu, tidyPlace } from '@/lib/subaybayan/ui';
import { assignCardImages, photoSubjects } from '@/components/dpwh/categoryImages';
import { agencyOf, isDilgSource, projectHref, subaybayanMapHref } from '@/lib/integrations/bettergov/sources';

// --- "needs review" rule --------------------------------------------------------

test('median matches percentile_cont(0.5)', () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([4, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test('flags totals at least P100M and 100x their subcategory median, nothing else', () => {
  const rows = [
    ...Array.from({ length: 9 }, (_, i) => ({ id: `road${i}`, sector_subcategory: 'Roads and bridges', total_cost: 2_000_000 })),
    { id: 'road-big', sector_subcategory: 'Roads and bridges', total_cost: 150_000_000 }, // 75x: not flagged
    { id: 'road-slip', sector_subcategory: 'Roads and bridges', total_cost: 1_475_655_520 },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `rice${i}`, sector_subcategory: 'Social services', total_cost: 5_000_000 })),
    { id: 'rice-big', sector_subcategory: 'Social services', total_cost: 384_000_000 }, // 77x: below the P500M bar
    ...Array.from({ length: 5 }, (_, i) => ({ id: `tiny${i}`, sector_subcategory: 'Tiny', total_cost: 100_000 })),
    { id: 'tiny-big', sector_subcategory: 'Tiny', total_cost: 20_000_000 }, // 200x but under P100M
    { id: 'no-cost', sector_subcategory: 'Roads and bridges', total_cost: null },
    { id: 'zero', sector_subcategory: 'Roads and bridges', total_cost: 0 },
  ];
  assert.deepEqual([...flagCostOutliers(rows)], ['road-slip']);
  const medians = subcategoryMedians(rows);
  assert.equal(medians.get('Roads and bridges'), 2_000_000, 'zeros and nulls are not part of the median');
  assert.equal(reviewThreshold(medians.get('Social services')), 500_000_000);
  assert.equal(reviewThreshold(medians.get('Tiny')), REVIEW_MIN_COST);
  assert.equal(reviewThreshold(undefined), null);
  assert.equal(REVIEW_MEDIAN_FACTOR, 100);
});

test('flagging re-hashes the row and only adds the flag', () => {
  const fields = { id: 'X', title: 'T', total_cost: 1 } as unknown as Omit<ProjectRow, 'source_hash'>;
  const base = { ...fields, source_hash: rowHash(fields) } as ProjectRow;
  const flagged = withCostReview(base);
  assert.equal(flagged.total_cost_review, true);
  assert.equal(flagged.total_cost, 1);
  assert.notEqual(flagged.source_hash, base.source_hash);
  assert.equal(flagged.source_hash, rowHash({ ...fields, total_cost_review: true }));
});

// --- directory labels and helpers ---------------------------------------------------

test('region and province labels match the DPWH directory spelling', () => {
  assert.equal(directoryRegionLabel('REGION X - NORTHERN MINDANAO'), 'Region X');
  assert.equal(directoryRegionLabel('REGION IV-A - CALABARZON'), 'Region IV-A');
  assert.equal(directoryRegionLabel('MIMAROPA'), 'Region IV-B');
  assert.equal(directoryRegionLabel('CORDILLERA ADMINISTRATIVE REGION'), 'Cordillera Administrative Region');
  assert.equal(directoryRegionLabel(null), null);
  assert.equal(directoryProvinceLabel('LANAO DEL NORTE'), 'Lanao del Norte');
  assert.equal(directoryProvinceLabel('DAVAO DE ORO'), 'Davao de Oro');
  assert.equal(directoryProvinceLabel('COTABATO (NORTH COTABATO)'), 'Cotabato (North Cotabato)');
});

test('implementing LGU names the owner level from the location', () => {
  const loc = { province: 'Lanao del Norte', municipality: 'CITY OF ILIGAN', barangay: 'TIBANGA' };
  assert.equal(implementingLgu({ ...loc, project_owner: 'Province' }), 'Lanao del Norte (province)');
  assert.equal(implementingLgu({ ...loc, project_owner: 'Citymun' }), 'City of Iligan (city / municipality)');
  assert.equal(implementingLgu({ ...loc, project_owner: 'Barangay' }), 'Brgy. Tibanga, City of Iligan (barangay)');
  assert.equal(implementingLgu({ ...loc, project_owner: null }), null);
  assert.equal(tidyPlace('CAGAYAN DE ORO'), 'Cagayan de Oro');
});

test('DILG photos only where the picture shows the same kind of work', () => {
  assert.equal(dilgPhotoCategory('Roads and bridges', 'Concreting of Farm-to-Market Road'), 'roads_highways');
  assert.equal(dilgPhotoCategory('Roads and bridges', 'Construction of Hanging Bridge'), 'bridges');
  assert.equal(dilgPhotoCategory('Water supply systems', 'Level II Water System'), 'water_infrastructure');
  assert.equal(dilgPhotoCategory('Public buildings', 'Construction of Barangay Hall'), 'buildings_facilities');
  assert.equal(dilgPhotoCategory('Markets and multipurpose buildings', 'Public Market'), 'buildings_facilities');
  assert.equal(dilgPhotoCategory('Disaster mitigation and preparedness', 'Construction of Slope Protection'), 'flood_control_drainage');
  assert.equal(dilgPhotoCategory('Disaster mitigation and preparedness', 'Purchase of Fire Truck'), null, 'a fire truck is not flood control');
  for (const sub of ['Health facilities', 'Social services', 'Community development programs', 'Livelihood initiatives', 'Community facilities',
    'Waste and sanitation', 'Environmental protection', 'Evacuation centers', 'Other public infrastructure', 'Uncategorized', null]) {
    assert.equal(dilgPhotoCategory(sub, 'Food assistance / rice distribution road bridge'), null, String(sub));
  }
});

test('card pictures: DILG rows without a fitting pool get the placeholder, DPWH rows are unchanged', () => {
  const items = [
    { source: 'dpwh_contracts', record_id: 'C1', category: 'roads_highways', title: 'Road' },
    { source: 'subaybayan_lgsf', record_id: 'D1', category: 'uncategorized', title: 'Rice distribution', sector_subcategory: 'Social services' },
    { source: 'subaybayan_rlip', record_id: 'D2', category: 'roads_highways', title: 'Concreting of road', sector_subcategory: 'Roads and bridges' },
  ];
  const images = assignCardImages(photoSubjects(items));
  assert.equal(images.get('dpwh_contracts:C1')?.kind, 'representative');
  assert.deepEqual(images.get('subaybayan_lgsf:D1'), { kind: 'placeholder', reason: 'no-pool' });
  const road = images.get('subaybayan_rlip:D2');
  assert.equal(road?.kind, 'representative');
  assert.equal(road?.kind === 'representative' && road.photo.category, 'roads_highways');
});

test('sources: agency, detail and map links for DILG records', () => {
  assert.equal(agencyOf('subaybayan_rlip'), 'DILG');
  assert.equal(agencyOf('dpwh_nep_2027'), 'DPWH');
  assert.equal(agencyOf('nope'), null);
  assert.ok(isDilgSource('subaybayan_lgsf'));
  assert.equal(projectHref('subaybayan_rlip', 'LIME-26-01-29-08-000-2'), '/projects/source/subaybayan_rlip/LIME-26-01-29-08-000-2');
  assert.equal(subaybayanMapHref('rlip-b01-r9'), '/projects/map?layer=subaybayan&focus=rlip-b01-r9');
});
