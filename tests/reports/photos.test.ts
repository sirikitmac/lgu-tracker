import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitWithin, isImageFile, photoStoragePath, safePhotoName } from '@/lib/reports/photos';

test('file names are made safe and always end in .jpg', () => {
  assert.equal(safePhotoName('IMG 2041.HEIC'), 'IMG-2041.jpg');
  assert.equal(safePhotoName('../../etc/passwd'), 'passwd.jpg');
  assert.equal(safePhotoName('日本語.png'), 'photo.jpg');
  assert.equal(safePhotoName('a'.repeat(300) + '.jpg').length, 64);
});

test('the storage path matches what the bucket policy accepts', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const re = /^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/;
  assert.match(photoStoragePath(id, id, id, 'My Photo!.png'), re);
});

test('large pictures shrink to 1600 px on the long side, small ones stay', () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test('images are recognised by type or extension', () => {
  assert.equal(isImageFile({ type: 'image/png', name: 'a' }), true);
  assert.equal(isImageFile({ type: '', name: 'IMG.HEIC' }), true);
  assert.equal(isImageFile({ type: 'application/pdf', name: 'a.pdf' }), false);
});
