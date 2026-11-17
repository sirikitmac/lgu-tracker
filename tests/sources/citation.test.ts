import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCitation, citationDate, dpwhCitation, subaybayanCitation } from '@/lib/sources/citation';

test('no dataset, no citation', () => {
  assert.equal(buildCitation({ dataset: null }), null);
  assert.equal(buildCitation({ dataset: '  ' }), null);
});

test('only the dataset when nothing else is known', () => {
  assert.deepEqual(buildCitation({ dataset: 'X dataset' }), { text: 'From the X dataset.', link: null });
});

test('dates are listed in order, and missing or unreadable ones are left out', () => {
  const some = buildCitation({ dataset: 'X dataset', publisher: 'Pub', snapshotAt: '2026-11-01', syncedAt: 'not a date' });
  assert.equal(some?.text, 'From the X dataset, published by Pub. Values as of the Nov 1, 2026 snapshot.');
  const all = buildCitation({
    dataset: 'X dataset',
    retrievedAt: '2026-10-31',
    snapshotAt: '2026-11-01T02:00:00Z',
    syncedAt: '2026-11-07T03:30:00Z',
  });
  assert.equal(all?.text, 'From the X dataset. Retrieved Oct 31, 2026; values as of the Nov 1, 2026 snapshot; last synced Nov 7, 2026.');
});

test('dates use Philippine time', () => {
  // 17:00 UTC on Nov 6 is already Nov 7 in Manila.
  assert.equal(citationDate('2026-11-06T17:00:00Z'), 'Nov 7, 2026');
  assert.equal(citationDate(null), null);
  assert.equal(citationDate('garbage'), null);
});

test('only http(s) links are kept', () => {
  assert.equal(buildCitation({ dataset: 'X', sourceUrl: 'javascript:alert(1)' })?.link, null);
  assert.equal(buildCitation({ dataset: 'X', sourceUrl: 'not a url' })?.link, null);
  assert.deepEqual(buildCitation({ dataset: 'X', sourceUrl: 'https://example.org/r/1' })?.link, {
    href: 'https://example.org/r/1',
    label: 'View at the source',
  });
});

test('a DPWH contract cites the BetterGov.ph dataset and its record link', () => {
  const c = dpwhCitation(
    { source_snapshot_at: '2026-11-01T00:00:00Z', bettergov_record_url: 'https://bettergov.ph/dpwh/1' },
    '2026-11-07T00:00:00Z',
  );
  assert.equal(
    c?.text,
    'From the DPWH nationwide contracts dataset (DPWH Transparency Portal), published by BetterGov.ph. Values as of the Nov 1, 2026 snapshot; last synced Nov 7, 2026.',
  );
  assert.equal(c?.link?.href, 'https://bettergov.ph/dpwh/1');
  // No sync recorded and no link: those parts are simply left out.
  const bare = dpwhCitation({}, null);
  assert.equal(bare?.link, null);
  assert.ok(!/synced|snapshot/.test(bare?.text ?? ''));
});

test('a SubayBAYAN project cites its own agency and retrieval date, or nothing', () => {
  const c = subaybayanCitation(
    { source_agency: 'DILG', retrieved_at: '2026-10-31', source_url: 'https://subaybayan.dilg.gov.ph/x' },
    'Locally Funded Projects (LGSF)',
  );
  assert.equal(c?.text, 'From the DILG SubayBAYAN dataset (Locally Funded Projects (LGSF)). Retrieved Oct 31, 2026.');
  assert.equal(c?.link?.href, 'https://subaybayan.dilg.gov.ph/x');
  assert.equal(subaybayanCitation({ source_agency: null }, 'LGSF'), null);
});
