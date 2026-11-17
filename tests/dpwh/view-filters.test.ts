import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_VIEW_FILTERS, hasViewFilters, parseViewFilters, sameViewFilters, searchWithViewFilters, toggleViewFilter } from '@/lib/dpwh/viewFilters';

const from = (qs: string) => {
  const p = new URLSearchParams(qs);
  return (k: string) => p.get(k);
};

test('parses the shared filters and drops what it does not know', () => {
  assert.deepEqual(parseViewFilters(from('region=Region%20IX&status=ongoing&category=bridges')).status, 'ongoing');
  assert.equal(parseViewFilters(from('region=Region%20IX')).region, 'Region IX');
  assert.deepEqual(parseViewFilters(from('status=nonsense&category=nope&region=%3Cscript%3E')), EMPTY_VIEW_FILTERS);
  assert.deepEqual(parseViewFilters(() => undefined), EMPTY_VIEW_FILTERS);
  assert.equal(parseViewFilters(() => ['completed', 'ongoing']).status, 'completed');
});

test('toggling one filter sets it, and the same value again clears it', () => {
  const a = toggleViewFilter(EMPTY_VIEW_FILTERS, 'region', 'Region IX');
  assert.equal(a.region, 'Region IX');
  assert.equal(toggleViewFilter(a, 'region', 'Region IX').region, '');
  assert.equal(toggleViewFilter(a, 'region', 'Region X').region, 'Region X');
  assert.equal(toggleViewFilter(a, 'region', null).region, '');
  assert.equal(toggleViewFilter(a, 'status', 'completed').region, 'Region IX', 'other filters stay');
});

test('compares and counts filters', () => {
  assert.equal(hasViewFilters(EMPTY_VIEW_FILTERS), false);
  assert.equal(hasViewFilters({ ...EMPTY_VIEW_FILTERS, status: 'completed' }), true);
  assert.equal(sameViewFilters(EMPTY_VIEW_FILTERS, { region: '', status: '', category: '' }), true);
});

test('writes the filters into the query and keeps every other parameter', () => {
  const next = searchWithViewFilters('?focus=ABC&lat=8.2&lng=124.2&view=dashboard', { region: 'Region X', status: 'ongoing', category: '' });
  const p = new URLSearchParams(next);
  assert.equal(p.get('region'), 'Region X');
  assert.equal(p.get('status'), 'ongoing');
  assert.equal(p.get('category'), null);
  assert.equal(p.get('focus'), 'ABC');
  assert.equal(p.get('view'), 'dashboard');
  assert.equal(searchWithViewFilters('?region=X', EMPTY_VIEW_FILTERS), '');
});
