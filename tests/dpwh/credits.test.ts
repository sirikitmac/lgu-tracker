import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_PHOTO_POOLS } from '@/components/dpwh/categoryPhotoCatalog';
import { PHOTOS } from '@/components/landing/content';
import { TRAIL_PHOTOS, WALL_COLUMNS, WAY_PHOTOS } from '@/components/landing/wall';
import { cardPhotoCredits, DATA_CREDITS, landingPhotoCredits } from '@/components/landing/credits';

/** CC BY / CC BY-SA require attribution: /credits must name every photo the app shows, with links. */

const https = (url: string) => /^https:\/\//.test(url);

test('/credits lists every landing photo once, with author, license and source links', () => {
  const credits = landingPhotoCredits();
  const listed = new Set(credits.map((p) => p.src));
  assert.equal(listed.size, credits.length, 'no photo listed twice');
  const shown = [...WALL_COLUMNS.flat(), ...Object.values(WAY_PHOTOS), ...TRAIL_PHOTOS, ...Object.values(PHOTOS)];
  for (const p of shown) if (p) assert.ok(listed.has(p.src), `missing credit for ${p.src}`);
  for (const p of credits) {
    assert.ok(p.creator.trim(), `no author for ${p.src}`);
    assert.ok(p.license.trim() && https(p.licenseUrl), `no license link for ${p.src}`);
    assert.ok(https(p.sourceUrl), `no source link for ${p.src}`);
  }
});

test('/credits covers the whole project-card catalogue, without repeating landing photos', () => {
  const landing = new Set(landingPhotoCredits().map((p) => p.src));
  const cards = cardPhotoCredits().flatMap((g) => g.photos);
  const catalog = Object.values(CATEGORY_PHOTO_POOLS).flat();
  for (const p of catalog) assert.ok(landing.has(p!.src) || cards.some((c) => c.src === p!.src), `missing credit for ${p!.src}`);
  for (const p of cards) {
    assert.ok(!landing.has(p.src), `${p.src} listed twice`);
    assert.ok(p.creator.trim() && https(p.licenseUrl) && https(p.sourceUrl), `incomplete credit for ${p.src}`);
  }
});

test('/credits names every data source and its license', () => {
  const text = DATA_CREDITS.map((d) => `${d.name} ${d.what} ${d.license}`).join('\n');
  for (const needle of ['BetterGov.ph', 'CC0', 'SubayBAYAN', 'Oct 31, 2026', 'NAMRIA', 'OCHA', 'CC BY-IGO', 'OpenStreetMap']) {
    assert.ok(text.includes(needle), `credits mention ${needle}`);
  }
  for (const d of DATA_CREDITS) {
    assert.ok(https(d.sourceUrl), `source link for ${d.name}`);
    if (d.licenseUrl) assert.ok(https(d.licenseUrl), `license link for ${d.name}`);
  }
});
