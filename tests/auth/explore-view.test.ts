import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exploreViewHref, parseExploreView, showsProjectsSidebar, subaybayanAddress } from '@/lib/nav/exploreView';

test('?view= picks the dashboard only when asked; everything else is the map', () => {
  assert.equal(parseExploreView('dashboard'), 'dashboard');
  assert.equal(parseExploreView(['dashboard', 'map']), 'dashboard');
  assert.equal(parseExploreView('map'), 'map');
  assert.equal(parseExploreView(undefined), 'map');
  assert.equal(parseExploreView(null), 'map');
  assert.equal(parseExploreView(''), 'map');
  assert.equal(parseExploreView('Dashboard'), 'map');
  assert.equal(parseExploreView('charts'), 'map');
});

test('view links: the map keeps the short address, the dashboard adds ?view=', () => {
  assert.equal(exploreViewHref('map'), '/projects/map');
  assert.equal(exploreViewHref('dashboard'), '/projects/map?view=dashboard');
  assert.equal(exploreViewHref('dashboard', { region: 'Region VII' }), '/projects/map?view=dashboard&region=Region+VII');
  assert.equal(exploreViewHref('map', { layer: 'subaybayan', region: null }), '/projects/map?layer=subaybayan');
});

test('the sidebar hides only on the map view', () => {
  assert.equal(showsProjectsSidebar('/projects/map', null), false);
  assert.equal(showsProjectsSidebar('/projects/map', 'map'), false);
  assert.equal(showsProjectsSidebar('/projects/map', 'bogus'), false);
  assert.equal(showsProjectsSidebar('/projects/map', 'dashboard'), true);
  assert.equal(showsProjectsSidebar('/projects', null), true);
  assert.equal(showsProjectsSidebar('/projects/25KA0001', null), true);
  assert.equal(showsProjectsSidebar('/projects/mapping', null), true);
});

test('the SubayBAYAN address keeps ?view= and the layer', () => {
  assert.equal(subaybayanAddress('region=X&year=2024', ''), '/projects/map?region=X&year=2024&layer=subaybayan');
  assert.equal(subaybayanAddress('', '?view=map&layer=subaybayan'), '/projects/map?layer=subaybayan&view=map');
  assert.equal(subaybayanAddress('q=abc', '?layer=subaybayan&focus=x'), '/projects/map?q=abc&layer=subaybayan');
});
