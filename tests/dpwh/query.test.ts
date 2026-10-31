import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAP_POINT_LIMIT,
  applyDirectoryQuery,
  applyMapQuery,
  parseBounds,
  parseDirectoryQuery,
  toContractorPrefix,
  toPrefixTsQuery,
  type MapBuilder,
} from '@/lib/integrations/dpwh/nationwide/query';

class Recorder implements MapBuilder<Recorder> {
  calls: [string, ...unknown[]][] = [];
  eq(c: string, v: string) { this.calls.push(['eq', c, v]); return this; }
  contains(c: string, v: string[]) { this.calls.push(['contains', c, v]); return this; }
  ilike(c: string, p: string) { this.calls.push(['ilike', c, p]); return this; }
  textSearch(c: string, q: string, o: { config: string }) { this.calls.push(['textSearch', c, q, o.config]); return this; }
  order(c: string, o: { ascending: boolean; nullsFirst: boolean }) { this.calls.push(['order', c, o.ascending, o.nullsFirst]); return this; }
  range(f: number, t: number) { this.calls.push(['range', f, t]); return this; }
  gte(c: string, v: number) { this.calls.push(['gte', c, v]); return this; }
  lte(c: string, v: number) { this.calls.push(['lte', c, v]); return this; }
  not(c: string, op: string, v: null) { this.calls.push(['not', c, op, v]); return this; }
  limit(n: number) { this.calls.push(['limit', n]); return this; }
}

const parse = (qs: string) => parseDirectoryQuery(new URLSearchParams(qs));

test('defaults: contract amount descending, first page of 25', () => {
  const r = parse('');
  assert.ok(r.ok);
  const b = applyDirectoryQuery(new Recorder(), r.query);
  assert.deepEqual(b.calls, [
    ['order', 'contract_amount', false, false],
    ['order', 'contract_id', true, false],
    ['range', 0, 24],
  ]);
});

test('applies every filter to the right column', () => {
  const r = parse('q=seawall nasipit&region=Region XIII&province=Agusan del Norte&category=bridges&status=ongoing&office=Region XIII&contractor=mamsar&sort=progress-asc&page=3&pageSize=50');
  assert.ok(r.ok);
  const calls = applyDirectoryQuery(new Recorder(), r.query).calls;
  assert.deepEqual(calls, [
    ['textSearch', 'search', 'seawall:* & nasipit:*', 'simple'],
    ['eq', 'region', 'Region XIII'],
    ['contains', 'provinces', ['Agusan del Norte']],
    ['eq', 'category', 'bridges'],
    ['eq', 'status_key', 'ongoing'],
    ['eq', 'implementing_office', 'Region XIII'],
    ['ilike', 'contractor', 'MAMSAR%'],
    ['order', 'progress', true, false],
    ['order', 'contract_id', true, false],
    ['range', 100, 149],
  ]);
});

test('rejects invalid parameters', () => {
  for (const qs of ['category=parks', 'status=paused', 'sort=random', 'page=0', 'page=1.5', 'pageSize=101', `q=${'x'.repeat(201)}`, `region=${'x'.repeat(201)}`]) {
    assert.equal(parse(qs).ok, false, qs);
  }
});

test('search input cannot inject tsquery operators', () => {
  assert.equal(toPrefixTsQuery("23KM0042 & !(drop) | 'x':*"), '23km0042:* & drop:* & x:*');
  assert.equal(toPrefixTsQuery('&&& |||'), null);
  assert.equal(toPrefixTsQuery('a b c d e f g h i j')?.split('&').length, 8);
});

test('location and contract-date sorts', () => {
  const location = parse('sort=location-asc');
  assert.ok(location.ok);
  assert.deepEqual(applyDirectoryQuery(new Recorder(), location.query).calls.slice(0, 3), [
    ['order', 'region', true, false],
    ['order', 'province', true, false],
    ['order', 'contract_id', true, false],
  ]);
  const date = parse('sort=contract_date-desc');
  assert.ok(date.ok);
  assert.deepEqual(applyDirectoryQuery(new Recorder(), date.query).calls[0], ['order', 'contract_effectivity_date', false, false]);
});

test('map query: filters, coordinates required, viewport, largest first, capped', () => {
  const r = parse('status=ongoing');
  assert.ok(r.ok);
  const bounds = parseBounds('120.5,10,125.25,14');
  assert.ok(bounds.ok);
  assert.deepEqual(applyMapQuery(new Recorder(), r.query, bounds.bounds).calls, [
    ['eq', 'status_key', 'ongoing'],
    ['not', 'latitude', 'is', null],
    ['not', 'longitude', 'is', null],
    ['gte', 'latitude', 10],
    ['lte', 'latitude', 14],
    ['gte', 'longitude', 120.5],
    ['lte', 'longitude', 125.25],
    ['order', 'contract_amount', false, false],
    ['order', 'contract_id', true, false],
    ['limit', MAP_POINT_LIMIT],
  ]);
});

test('bbox validation', () => {
  assert.deepEqual(parseBounds(null), { ok: true, bounds: null });
  for (const bad of ['1,2,3', 'a,b,c,d', '0,10,1,5', '-200,0,0,1', '0,-91,1,0', '5,0,1,1']) {
    assert.equal(parseBounds(bad).ok, false, bad);
  }
});

test('contractor prefix strips wildcard characters', () => {
  assert.equal(toContractorPrefix('ab%c_d*'), 'ABCD%');
  assert.equal(toContractorPrefix('%%'), null);
});

test('agency and DILG category (sector) filters', () => {
  const r = parse('agency=DILG&sector=health');
  assert.ok(r.ok);
  assert.equal(r.query.agency, 'DILG');
  assert.equal(r.query.sector, 'health');
  const b = applyDirectoryQuery(new Recorder(), r.query, ['source', 'record_id']);
  assert.deepEqual(b.calls.slice(0, 2), [['eq', 'agency', 'DILG'], ['eq', 'sector_category', 'health']]);

  const dpwh = parse('agency=DPWH&source=dpwh_nep_2027');
  assert.ok(dpwh.ok);
  assert.equal(parse('agency=DILG&source=dpwh_contracts').ok, false, 'source must belong to the agency');
  assert.equal(parse('agency=DPWH&sector=health').ok, false, 'DILG category needs DILG records');
  assert.equal(parse('source=dpwh_contracts&sector=health').ok, false);
  assert.equal(parse('agency=dilg').ok, false);
  assert.equal(parse('sector=roads').ok, false);
  const src = parse('source=subaybayan_rlip&sector=disaster');
  assert.ok(src.ok);
});
