import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/**
 * Migration 20261111000100 (landing page reviews) against a local PGlite
 * database. Never touches the hosted project.
 */

const OTHER = '22222222-2222-2222-2222-222222222222';
const PHOTO = `${USERS.citizen}/00000000-0000-4000-8000-000000000001.jpg`;
let db: PGlite;

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'other@test.local')`);
  await db.exec(`update public.profiles set full_name = 'Maria Clara Santos', position_title = 'Teacher', avatar_path = '${PHOTO}' where id = '${USERS.citizen}'`);
  await db.exec(`update public.profiles set full_name = 'Pedro Reyes', avatar_preset = 'p4' where id = '${OTHER}'`);
});

type Row = { id: string; user_id: string; rating: number; body: string; display_name: string; job_title: string | null; avatar_path: string | null; avatar_preset: string | null; status: string };

const write = (who: string, rating: number, body: string, extra = '', extraVals = '') =>
  as<Row>(db, 'authenticated', who,
    `insert into public.reviews (user_id, rating, body, display_name${extra}) values ($1, $2, $3, 'x'${extraVals}) returning *`,
    [who, rating, body]);
const row = async (who: string) =>
  (await db.query<Row>(`select * from public.reviews where user_id = $1`, [who])).rows[0];
const update = (who: string, target: string, set: string, params: unknown[] = []) =>
  as<Row>(db, 'authenticated', who, `update public.reviews set ${set} where user_id = '${target}' returning *`, params);

test('anon cannot write a review', async () => {
  const res = await as(db, 'anon', null,
    `insert into public.reviews (user_id, rating, body, display_name) values ('${USERS.citizen}', 5, 'Napakagandang tool!', 'Anon')`);
  assert.equal(res.error?.code, '42501');
});

test('a signed-in person writes one review; name, job and picture come from their profile', async () => {
  const res = await write(USERS.citizen, 4, '  Malaking tulong sa barangay namin.  ');
  assert.equal(res.error, undefined, String(res.error));
  const r = await row(USERS.citizen);
  assert.equal(r.rating, 4);
  assert.equal(r.body, 'Malaking tulong sa barangay namin.', 'trimmed');
  assert.equal(r.display_name, 'Maria Clara Santos', 'a made-up name is replaced by the profile name');
  assert.equal(r.job_title, 'Teacher');
  assert.equal(r.avatar_path, PHOTO);
  assert.equal(r.status, 'published');

  const again = await write(USERS.citizen, 5, 'Second review from the same person.');
  assert.equal(again.error?.code, '23505', 'one review per person');
});

test('"first name only" is the one choice the author has over their name', async () => {
  const res = await update(USERS.citizen, USERS.citizen, `display_name = 'Maria'`);
  assert.equal(res.error, undefined, String(res.error));
  assert.equal((await row(USERS.citizen)).display_name, 'Maria');
  await update(USERS.citizen, USERS.citizen, `display_name = 'Mayor Somebody'`);
  assert.equal((await row(USERS.citizen)).display_name, 'Maria Clara Santos');
});

test('nobody can write a review in someone else\'s name or put another person\'s photo on it', async () => {
  const res = await as(db, 'authenticated', OTHER,
    `insert into public.reviews (user_id, rating, body, display_name) values ('${USERS.citizen}', 1, 'Pretending to be someone else.', 'x')`);
  assert.equal(res.error?.code, '42501');

  const photo = await as(db, 'service_role', null,
    `insert into public.reviews (user_id, rating, body, display_name, avatar_path) values ($1, 3, 'Photo from a different folder', 'Pedro', $2)`,
    [OTHER, PHOTO]);
  assert.equal(photo.error?.code, '23514', 'avatar_path must be in the author\'s own folder');
  for (const bad of ['', 'P4', "p1'; drop", 'x'.repeat(30)]) {
    const preset = await as(db, 'service_role', null,
      `insert into public.reviews (user_id, rating, body, display_name, avatar_preset) values ($1, 3, 'Bad avatar id here', 'Pedro', $2)`,
      [OTHER, bad]);
    assert.equal(preset.error?.code, '23514', bad);
  }
});

test('rating is 1 to 5 and the text is 10 to 500 characters after trimming', async () => {
  for (const rating of [0, 6, -1]) {
    assert.equal((await write(OTHER, rating, 'A perfectly fine review.')).error?.code, '23514', String(rating));
  }
  for (const body of ['too short', '         short    ', 'x'.repeat(501)]) {
    assert.equal((await write(OTHER, 3, body)).error?.code, '23514', `length ${body.length}`);
  }
  assert.equal((await write(OTHER, 3, 'x'.repeat(500))).error, undefined, '500 is allowed');
  const r = await row(OTHER);
  assert.equal(r.display_name, 'Pedro Reyes');
  assert.equal(r.avatar_preset, 'p4');
  assert.equal(r.job_title, null);
});

test('you cannot edit or delete someone else\'s review', async () => {
  const edit = await update(OTHER, USERS.citizen, `body = 'Rewritten by somebody else.'`);
  assert.equal(edit.rows?.length ?? 0, 0);
  const del = await as(db, 'authenticated', OTHER, `delete from public.reviews where user_id = '${USERS.citizen}' returning id`);
  assert.equal(del.rows?.length ?? 0, 0);
  assert.equal((await row(USERS.citizen)).body, 'Malaking tulong sa barangay namin.');
});

test('you can edit your own rating and text but not its status or owner', async () => {
  const ok = await update(USERS.citizen, USERS.citizen, `rating = 5, body = 'Mas gumanda pa ngayon!'`);
  assert.equal(ok.error, undefined, String(ok.error));
  assert.equal((await row(USERS.citizen)).rating, 5);

  assert.equal((await update(USERS.citizen, USERS.citizen, `status = 'hidden'`)).error?.code, '42501');
  assert.equal((await row(USERS.citizen)).status, 'published');
  assert.equal((await update(USERS.citizen, USERS.citizen, `user_id = '${OTHER}'`)).error?.code, '42501');
  assert.equal((await update(USERS.citizen, USERS.citizen, `created_at = now() - interval '1 year'`)).error?.code, '42501');
});

test('an administrator can hide a review, which anon then cannot see; the author still can', async () => {
  const notAdmin = await update(USERS.planner, OTHER, `status = 'hidden'`);
  assert.equal(notAdmin.rows?.length ?? 0, 0, 'staff who are not administrators cannot moderate');

  const hide = await update(USERS.admin, OTHER, `status = 'hidden'`);
  assert.equal(hide.error, undefined, String(hide.error));
  assert.equal(hide.rows?.length, 1);

  const anon = await as<Row>(db, 'anon', null, `select user_id, status from public.reviews`);
  assert.deepEqual(anon.rows?.map((r) => r.user_id), [USERS.citizen], 'anon sees only published');
  const someone = await as<Row>(db, 'authenticated', USERS.engineer, `select user_id from public.reviews`);
  assert.deepEqual(someone.rows?.map((r) => r.user_id), [USERS.citizen]);
  const author = await as<Row>(db, 'authenticated', OTHER, `select status from public.reviews where user_id = '${OTHER}'`);
  assert.equal(author.rows?.[0]?.status, 'hidden', 'the author can still find their hidden review');

  const rewrite = await update(USERS.admin, USERS.citizen, `body = 'An administrator rewrote this.'`);
  assert.equal(rewrite.error?.code, '42501', 'administrators cannot rewrite what someone else wrote');

  const show = await update(USERS.admin, OTHER, `status = 'published'`);
  assert.equal(show.error, undefined, String(show.error));
  assert.equal((await row(OTHER)).status, 'published');
});

test('you can delete your own review, and an administrator can delete any', async () => {
  const own = await as(db, 'authenticated', USERS.citizen, `delete from public.reviews where user_id = '${USERS.citizen}' returning id`);
  assert.equal(own.rows?.length, 1);
  const admin = await as(db, 'authenticated', USERS.admin, `delete from public.reviews where user_id = '${OTHER}' returning id`);
  assert.equal(admin.rows?.length, 1);
  assert.equal((await db.query(`select 1 from public.reviews`)).rows.length, 0);
});

test('a review goes away with its author\'s account', async () => {
  assert.equal((await write(OTHER, 4, 'Leaving soon, but thanks.')).error, undefined);
  await db.exec(`delete from public.profiles where id = '${OTHER}'; delete from auth.users where id = '${OTHER}'`);
  assert.equal((await db.query(`select 1 from public.reviews`)).rows.length, 0);
});
