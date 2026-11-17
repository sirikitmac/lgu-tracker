import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResponseCache } from '@/lib/dpwh/responseCache';

test('returns what was stored and nothing for an unknown key', () => {
  const cache = new ResponseCache<number>();
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
});

test('drops the least recently used entry beyond the limit', () => {
  const cache = new ResponseCache<number>(2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.size, 2);
});

test('entries expire after the time to live', () => {
  let t = 0;
  const cache = new ResponseCache<number>(5, 1000, () => t);
  cache.set('a', 1);
  t = 999;
  assert.equal(cache.get('a'), 1);
  t = 1001;
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 0);
});
