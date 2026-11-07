import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/**
 * Migration 20261110000100 (profile picture, free avatars, job title) against
 * a local PGlite database with a small Storage stand-in. Never touches the
 * hosted project.
 */

const OTHER = '22222222-2222-2222-2222-222222222222';
let db: PGlite;
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const photo = (who: string) => `${who}/${uuid()}.jpg`;

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'other@test.local')`);
});

const update = (who: string, target: string, set: string, params: unknown[] = []) =>
  as(db, 'authenticated', who, `update public.profiles set ${set} where id = '${target}' returning id`, params);
const profile = async (id: string) =>
  (await db.query<{ full_name: string; position_title: string | null; avatar_path: string | null; avatar_preset: string | null; role: string }>(
    `select full_name, position_title, avatar_path, avatar_preset, role from public.profiles where id = '${id}'`)).rows[0];

test('anyone can set their own name, job title and a free avatar', async () => {
  const res = await update(USERS.citizen, USERS.citizen, `full_name = 'Maria Santos', position_title = 'Teacher', avatar_preset = 'p3'`);
  assert.equal(res.error, undefined, String(res.error));
  assert.deepEqual(await profile(USERS.citizen), { full_name: 'Maria Santos', position_title: 'Teacher', avatar_path: null, avatar_preset: 'p3', role: 'citizen' });
});

test('a photo path must sit in your own folder and look like one of ours', async () => {
  const own = photo(USERS.citizen);
  const ok = await update(USERS.citizen, USERS.citizen, `avatar_path = $1, avatar_preset = null`, [own]);
  assert.equal(ok.error, undefined, String(ok.error));
  assert.equal((await profile(USERS.citizen)).avatar_path, own);

  for (const bad of [photo(OTHER), 'photo.jpg', `${USERS.citizen}/../x.jpg`, `${USERS.citizen}/${uuid()}.png`]) {
    const res = await update(USERS.citizen, USERS.citizen, `avatar_path = $1`, [bad]);
    assert.equal(res.error?.code, '23514', bad);
  }
});

test('a picture is either a photo or a free avatar, never both; the avatar id has a safe shape', async () => {
  assert.equal((await update(USERS.citizen, USERS.citizen, `avatar_preset = 'p4'`)).error?.code, '23514');
  for (const bad of ['', 'P4', 'a b', "p1'; drop", 'x'.repeat(30)]) {
    assert.equal((await update(USERS.citizen, USERS.citizen, `avatar_path = null, avatar_preset = $1`, [bad])).error?.code, '23514', bad);
  }
  assert.equal((await update(USERS.citizen, USERS.citizen, `avatar_path = null, avatar_preset = 'p4'`)).error, undefined);
});

test('you cannot edit anyone else\'s picture or title, and your role stays locked', async () => {
  const other = await update(USERS.citizen, USERS.planner, `position_title = 'Hacked'`);
  assert.equal(other.rows?.length ?? 0, 0, 'RLS hides the row from a plain update');
  assert.notEqual((await profile(USERS.planner)).position_title, 'Hacked');

  const role = await update(USERS.citizen, USERS.citizen, `role = 'lgu_admin'`);
  assert.equal(role.error?.code, '42501');
  assert.equal((await profile(USERS.citizen)).role, 'citizen');
});

test('the avatars bucket is public and only takes small images', async () => {
  const b = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
    `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`);
  assert.equal(b.rows[0].public, true);
  assert.equal(Number(b.rows[0].file_size_limit), 1024 * 1024);
  assert.deepEqual(b.rows[0].allowed_mime_types, ['image/jpeg', 'image/webp']);
});

test('you can add and remove files in your own folder only', async () => {
  const put = (who: string, name: string) => as(db, 'authenticated', who, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [name]);
  const mine = photo(USERS.citizen);
  assert.equal((await put(USERS.citizen, mine)).error, undefined);
  assert.equal((await put(USERS.citizen, photo(OTHER))).error?.code, '42501');
  assert.equal((await as(db, 'anon', null, `insert into storage.objects (bucket_id, name) values ('avatars', '${photo(USERS.citizen)}')`)).error?.code, '42501');
  for (const name of ['pic.jpg', `${USERS.citizen}/${uuid()}.gif`, `${USERS.citizen}/../${uuid()}.jpg`]) {
    assert.equal((await put(USERS.citizen, name)).error?.code, '42501', name);
  }

  const seen = await as<{ name: string }>(db, 'anon', null, `select name from storage.objects where bucket_id = 'avatars'`);
  assert.ok(seen.rows?.some((r) => r.name === mine), 'anyone can read a profile picture');

  const theirs = await as(db, 'authenticated', OTHER, `delete from storage.objects where bucket_id = 'avatars' and name = $1 returning name`, [mine]);
  assert.equal(theirs.rows?.length ?? 0, 0, 'someone else cannot remove it');
  const own = await as(db, 'authenticated', USERS.citizen, `delete from storage.objects where bucket_id = 'avatars' and name = $1 returning name`, [mine]);
  assert.equal(own.rows?.length, 1);
});
