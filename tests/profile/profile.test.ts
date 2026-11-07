import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AVATAR_PRESETS, TITLE_MAX, avatarPublicUrl, avatarStoragePath, initialsOf, isOwnAvatarPath, presetById, validateProfile,
} from '@/lib/profile/avatars';
import { centred, clampOffset, coverScale, scaleFor, sourceRect, zoomKeepingCentre, type View } from '@/lib/profile/crop';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const FILE = '33333333-3333-4333-8333-333333333333';

test('free avatars have unique, safe ids and a spread of faces', () => {
  const ids = AVATAR_PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]{0,23}$/);
  assert.ok(AVATAR_PRESETS.length >= 12);
  assert.ok(new Set(AVATAR_PRESETS.map((p) => p.look.skin)).size >= 4);
  assert.ok(new Set(AVATAR_PRESETS.map((p) => p.look.hair)).size >= 6);
  assert.equal(presetById('p3')?.id, 'p3');
  assert.equal(presetById('nope'), undefined);
  assert.equal(presetById(null), undefined);
});

test('photo paths: only your own folder, only our shape', () => {
  const own = avatarStoragePath(ME, FILE);
  assert.equal(own, `${ME}/${FILE}.jpg`);
  assert.ok(isOwnAvatarPath(own, ME));
  assert.ok(!isOwnAvatarPath(own, OTHER));
  for (const bad of ['', 'x.jpg', `${ME}/x.jpg`, `${ME}/${FILE}.png`, `${ME}/../${FILE}.jpg`, `${ME}/${FILE}.jpg/extra`]) assert.ok(!isOwnAvatarPath(bad, ME), bad);
});

test('the public link is built from the project URL, and absent without one', () => {
  assert.equal(avatarPublicUrl(`${ME}/${FILE}.jpg`, 'https://abc.supabase.co/'), `https://abc.supabase.co/storage/v1/object/public/avatars/${ME}/${FILE}.jpg`);
  assert.equal(avatarPublicUrl(null, 'https://abc.supabase.co'), null);
  assert.equal(avatarPublicUrl(`${ME}/${FILE}.jpg`, ''), null);
});

test('initials handle one name, many names and odd input', () => {
  assert.equal(initialsOf('Maricel Dela Cruz'), 'MC');
  assert.equal(initialsOf('  jun-jun  '), 'J');
  assert.equal(initialsOf('Ñoel Reyes'), 'ÑR');
  assert.equal(initialsOf('   '), '?');
  assert.equal(initialsOf('🙂🙂'), '?');
});

test('profile input is tidied and checked', () => {
  const ok = validateProfile({ fullName: '  Maria   Santos ', positionTitle: ' Teacher ', avatarPath: null, avatarPreset: 'p2' }, ME);
  assert.deepEqual(ok, { ok: true, value: { fullName: 'Maria Santos', positionTitle: 'Teacher', avatarPath: null, avatarPreset: 'p2' } });

  const nameless = validateProfile({ fullName: '   ', positionTitle: '' }, ME);
  assert.ok(!nameless.ok && nameless.field === 'fullName');
  const longTitle = validateProfile({ fullName: 'A', positionTitle: 'x'.repeat(TITLE_MAX + 1) }, ME);
  assert.ok(!longTitle.ok && longTitle.field === 'positionTitle');
  assert.ok(validateProfile({ fullName: 'A', positionTitle: 'x'.repeat(TITLE_MAX) }, ME).ok);

  assert.ok(!validateProfile({ fullName: 'A', avatarPath: `${ME}/${FILE}.jpg`, avatarPreset: 'p1' }, ME).ok, 'both');
  assert.ok(!validateProfile({ fullName: 'A', avatarPath: `${OTHER}/${FILE}.jpg` }, ME).ok, 'someone else\'s file');
  assert.ok(!validateProfile({ fullName: 'A', avatarPreset: 'zzz' }, ME).ok, 'unknown avatar');
  assert.ok(validateProfile({ fullName: 'A', avatarPath: `${ME}/${FILE}.jpg` }, ME).ok);
  assert.ok(!validateProfile(null, ME).ok);
  assert.equal((validateProfile({ fullName: 'Li\u0000on\n', positionTitle: '' }, ME) as { value: { fullName: string } }).value.fullName, 'Li on');
});

const wide: View = { width: 2000, height: 1000, size: 280 };
const tall: View = { width: 600, height: 1200, size: 280 };

test('crop: the picture always covers the window', () => {
  for (const v of [wide, tall, { width: 280, height: 280, size: 280 }, { width: 100, height: 100, size: 280 }]) {
    for (const zoom of [1, 1.5, 4]) {
      const s = scaleFor(v, zoom);
      assert.ok(v.width * s >= v.size - 1e-9 && v.height * s >= v.size - 1e-9);
      for (const o of [{ x: 500, y: 500 }, { x: -99999, y: -99999 }, { x: 0, y: 0 }, centred(v, s)]) {
        const c = clampOffset(v, s, o);
        assert.ok(c.x <= 0 && c.y <= 0);
        assert.ok(c.x + v.width * s >= v.size - 1e-9 && c.y + v.height * s >= v.size - 1e-9);
      }
    }
  }
});

test('crop: starts centred and the source square lies inside the picture', () => {
  const s = scaleFor(wide, 1);
  assert.equal(s, coverScale(wide));
  const o = centred(wide, s);
  const r = sourceRect(wide, s, o);
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  near(r.side, 1000);
  near(r.sx, 500); // the middle of a 2000 wide picture
  near(r.sy, 0);
  const z = sourceRect(tall, scaleFor(tall, 3), clampOffset(tall, scaleFor(tall, 3), { x: -99999, y: -99999 }));
  assert.ok(z.sx + z.side <= tall.width + 1e-9 && z.sy + z.side <= tall.height + 1e-9);
});

test('crop: zooming keeps the middle of the window on the same spot', () => {
  const s1 = scaleFor(wide, 1.2);
  const o1 = clampOffset(wide, s1, { x: -150, y: -10 });
  const mid1 = { x: (wide.size / 2 - o1.x) / s1, y: (wide.size / 2 - o1.y) / s1 };
  const s2 = scaleFor(wide, 2.4);
  const o2 = zoomKeepingCentre(wide, { scale: s1, offset: o1 }, s2);
  const mid2 = { x: (wide.size / 2 - o2.x) / s2, y: (wide.size / 2 - o2.y) / s2 };
  assert.ok(Math.abs(mid1.x - mid2.x) < 1e-6 && Math.abs(mid1.y - mid2.y) < 1e-6);
});
