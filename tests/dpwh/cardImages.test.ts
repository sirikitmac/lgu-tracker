import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignCardImages, categoryPool, hashKey, recordKey, type ImageSubject } from '@/components/dpwh/categoryImages';
import { CATEGORY_PHOTO_POOLS } from '@/components/dpwh/categoryPhotoCatalog';

const rows = (category: string | null, n: number, prefix = 'C'): ImageSubject[] =>
  Array.from({ length: n }, (_, i) => ({ source: 'dpwh_contracts', record_id: `${prefix}${String(i).padStart(5, '0')}`, category }));
const srcOf = (m: ReturnType<typeof assignCardImages>, r: ImageSubject) => {
  const image = m.get(recordKey(r));
  return image?.kind === 'representative' ? image.photo.src : null;
};

test('every category in the catalogue has its own pictures, no file shared between categories', () => {
  const seen = new Map<string, string>();
  for (const [category, pool] of Object.entries(CATEGORY_PHOTO_POOLS)) {
    for (const photo of pool) {
      assert.equal(photo.category, category, `${photo.src} is filed under ${category}`);
      assert.ok(!seen.has(photo.src), `${photo.src} appears in ${seen.get(photo.src)} and ${category}`);
      seen.set(photo.src, category);
      assert.ok(photo.title && photo.creator && photo.license && photo.licenseUrl && photo.sourceUrl, `${photo.src} lacks a credit`);
    }
  }
});

test('the hash is stable', () => {
  assert.equal(hashKey('dpwh_contracts:21Z00007'), hashKey('dpwh_contracts:21Z00007'));
  assert.notEqual(hashKey('dpwh_contracts:21Z00007'), hashKey('dpwh_contracts:21Z00008'));
});

test('a page never shows the same photo twice', () => {
  const page = [...rows('roads_highways', 40), ...rows('bridges', 30, 'B'), ...rows('buildings_facilities', 30, 'S')];
  const shown = [...assignCardImages(page).values()].filter((i) => i.kind === 'representative').map((i) => (i.kind === 'representative' ? i.photo.src : ''));
  assert.equal(new Set(shown).size, shown.length);
});

test('pictures do not depend on display order', () => {
  const page = [...rows('roads_highways', 20), ...rows('bridges', 5, 'B')];
  const a = assignCardImages(page);
  const b = assignCardImages([...page].reverse());
  for (const r of page) assert.equal(srcOf(a, r), srcOf(b, r));
});

test('a record keeps its picture when it has no collision, on any page', () => {
  const pool = categoryPool('bridges');
  const lone = { source: 'dpwh_contracts', record_id: '22L00004', category: 'bridges' };
  const alone = srcOf(assignCardImages([lone]), lone);
  assert.equal(alone, pool[hashKey(recordKey(lone)) % pool.length].src);
  assert.equal(srcOf(assignCardImages([lone, ...rows('roads_highways', 25)]), lone), alone, 'other categories never take its picture');
});

test('pictures match the record category', () => {
  const page = [...rows('roads_highways', 5), ...rows('water_infrastructure', 5, 'W')];
  const m = assignCardImages(page);
  for (const r of page) {
    const image = m.get(recordKey(r));
    if (image?.kind === 'representative') assert.equal(image.photo.category, r.category);
  }
});

test('once a category runs out, the rest get the placeholder rather than a repeat', () => {
  const size = categoryPool('water_infrastructure').length;
  const m = assignCardImages(rows('water_infrastructure', size + 3, 'W'));
  const kinds = [...m.values()].map((i) => i.kind);
  assert.equal(kinds.filter((k) => k === 'representative').length, size);
  assert.equal(kinds.filter((k) => k === 'placeholder').length, 3);
});

test('categories without pictures get the placeholder', () => {
  for (const category of ['uncategorized', 'other_infrastructure', null, 'not_a_category']) {
    const [r] = rows(category, 1);
    assert.deepEqual(assignCardImages([r]).get(recordKey(r)), { kind: 'placeholder', reason: 'no-pool' });
  }
});
