import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/** Migration 20261117000100 (anonymous posts and comments) against local PGlite. Never touches the hosted project. */

const OTHER = '22222222-2222-2222-2222-222222222222';
const GONE = '33333333-3333-3333-3333-333333333333';
const PHOTO = `${USERS.citizen}/00000000-0000-4000-8000-000000000001.jpg`;
let db: PGlite;

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'other@test.local'), ('${GONE}', 'gone@test.local')`);
  await db.exec(`update public.profiles set full_name = 'Maria Clara Santos', position_title = 'Teacher', avatar_path = '${PHOTO}' where id = '${USERS.citizen}'`);
  await db.exec(`update public.profiles set full_name = 'Pedro Reyes' where id = '${OTHER}'`);
});

type Row = {
  id: string;
  author_id: string | null;
  author_name: string;
  author_title: string | null;
  author_avatar_path: string | null;
  author_avatar_preset: string | null;
  is_anonymous: boolean;
};

const anonPost = (who: string, title = 'Tanong ko lang, walang pangalan') =>
  as<Row>(db, 'authenticated', who,
    `insert into public.community_posts (author_id, title, body, is_anonymous) values (null, $1, 'Ayaw kong makilala, pero may nakita ako.', true) returning *`, [title]);
const anonComment = (who: string, postId: string) =>
  as<Row>(db, 'authenticated', who,
    `insert into public.community_comments (post_id, author_id, body, is_anonymous) values ($1, null, 'Totoo ito, nakita ko rin.', true) returning *`, [postId]);
const namedPost = (who: string, title = 'Usapang may pangalan dito') =>
  as<Row>(db, 'authenticated', who, `insert into public.community_posts (author_id, title, body) values ($1, $2, 'Ito ay may pangalan ng sumulat.') returning *`, [who, title]);

test('an anonymous post stores no author: only "Anonymous", no job, no picture', async () => {
  const res = await anonPost(USERS.citizen);
  assert.equal(res.error, undefined, String(res.error));
  const p = res.rows![0];
  assert.equal(p.is_anonymous, true);
  assert.equal(p.author_id, null);
  assert.equal(p.author_name, 'Anonymous');
  assert.equal(p.author_title, null);
  assert.equal(p.author_avatar_path, null);
  assert.equal(p.author_avatar_preset, null);
});

test('other users and visitors cannot learn who wrote an anonymous post or comment', async () => {
  const p = (await anonPost(USERS.citizen, 'Lihim na tanong ng isang tao')).rows![0];
  const c = (await anonComment(USERS.citizen, p.id)).rows![0];

  for (const [role, who] of [['anon', null], ['authenticated', OTHER]] as const) {
    const post = await as<Row>(db, role, who, `select * from public.community_posts where id = $1`, [p.id]);
    assert.equal(post.rows?.[0].author_id, null, role);
    assert.equal(post.rows?.[0].author_name, 'Anonymous', role);
    const comment = await as<Row>(db, role, who, `select * from public.community_comments where id = $1`, [c.id]);
    assert.equal(comment.rows?.[0].author_id, null, role);
    // Filtering or counting the public tables by author finds nothing anonymous.
    const mine = await as<{ n: number }>(db, role, who,
      `select count(*)::int as n from public.community_posts where author_id = $1 and id = $2`, [USERS.citizen, p.id]);
    assert.equal(mine.rows?.[0].n, 0, role);
  }

  // The private record: another signed-in user sees none of it, a visitor is refused outright.
  const other = await as<{ n: number }>(db, 'authenticated', OTHER, `select count(*)::int as n from public.community_anonymous_authors`);
  assert.equal(other.rows?.[0].n, 0);
  const visitor = await as(db, 'anon', null, `select * from public.community_anonymous_authors`);
  assert.equal(visitor.error?.code, '42501');
  // Nor through the ownership helper: it only ever answers for the caller.
  const probe = await as<{ yes: boolean }>(db, 'authenticated', OTHER, `select private.is_my_anonymous_community_item($1, null) as yes`, [p.id]);
  assert.equal(probe.rows?.[0].yes, false);
});

test('the author can tell which anonymous items are theirs, and delete them; others cannot delete', async () => {
  const p = (await anonPost(USERS.citizen, 'Akin ito pero walang pangalan')).rows![0];
  const c = (await anonComment(USERS.citizen, p.id)).rows![0];

  const own = await as<{ post_id: string | null; comment_id: string | null; author_id: string }>(db, 'authenticated', USERS.citizen,
    `select post_id, comment_id, author_id from public.community_anonymous_authors where post_id = $1 or comment_id = $2`, [p.id, c.id]);
  assert.equal(own.rows?.length, 2);
  assert.ok(own.rows!.every((r) => r.author_id === USERS.citizen));

  const stranger = await as(db, 'authenticated', OTHER, `delete from public.community_comments where id = $1 returning id`, [c.id]);
  assert.equal(stranger.rows?.length ?? 0, 0);
  const strangerPost = await as(db, 'authenticated', OTHER, `delete from public.community_posts where id = $1 returning id`, [p.id]);
  assert.equal(strangerPost.rows?.length ?? 0, 0);

  const delComment = await as(db, 'authenticated', USERS.citizen, `delete from public.community_comments where id = $1 returning id`, [c.id]);
  assert.equal(delComment.rows?.length, 1);
  const delPost = await as(db, 'authenticated', USERS.citizen, `delete from public.community_posts where id = $1 returning id`, [p.id]);
  assert.equal(delPost.rows?.length, 1);
  const left = await db.query<{ n: number }>(`select count(*)::int as n from public.community_anonymous_authors where post_id = $1`, [p.id]);
  assert.equal(left.rows[0].n, 0);
});

test('an administrator can see who wrote an anonymous item', async () => {
  const p = (await anonPost(USERS.citizen, 'Para makita ng admin kung sino')).rows![0];
  const res = await as<{ author_id: string; author_name: string }>(db, 'authenticated', USERS.admin,
    `select author_id, author_name from public.community_anonymous_authors where post_id = $1`, [p.id]);
  assert.deepEqual(res.rows, [{ author_id: USERS.citizen, author_name: 'Maria Clara Santos' }]);
  // Non-admin staff do not.
  const planner = await as<{ n: number }>(db, 'authenticated', USERS.planner,
    `select count(*)::int as n from public.community_anonymous_authors where post_id = $1`, [p.id]);
  assert.equal(planner.rows?.[0].n, 0);
});

test('forged anonymous or author values from the client are refused', async () => {
  // Anonymous, but claiming to be someone else.
  const asOther = await as(db, 'authenticated', USERS.citizen,
    `insert into public.community_posts (author_id, title, body, is_anonymous) values ($1, 'Peke na may-akda dito', 'Hindi dapat ito pumasok.', true)`, [OTHER]);
  assert.equal(asOther.error?.code, '42501');
  // Named, but with no author.
  const noAuthor = await as(db, 'authenticated', USERS.citizen,
    `insert into public.community_posts (author_id, title, body, is_anonymous) values (null, 'Walang may-akda dito', 'Hindi dapat ito pumasok.', false)`);
  assert.equal(noAuthor.error?.code, '42501');
  // Writing the private record directly.
  const p = (await namedPost(USERS.citizen, 'Post na aangkinin ng iba')).rows![0];
  const claim = await as(db, 'authenticated', OTHER,
    `insert into public.community_anonymous_authors (post_id, author_id) values ($1, $2)`, [p.id, OTHER]);
  assert.equal(claim.error?.code, '42501');
  const move = await as(db, 'authenticated', USERS.citizen, `update public.community_anonymous_authors set author_id = $1`, [OTHER]);
  assert.equal(move.error?.code, '42501');
  // Turning a named post anonymous afterwards, or the other way round.
  const flip = await as(db, 'authenticated', USERS.citizen, `update public.community_posts set is_anonymous = true where id = $1`, [p.id]);
  assert.equal(flip.error?.code, '42501');
  // Faking the shown name or picture on an anonymous post.
  const faked = await as(db, 'authenticated', USERS.citizen,
    `insert into public.community_posts (author_id, title, body, is_anonymous, author_name) values (null, 'Pekeng pangalan dito', 'Susubukan kong palitan.', true, 'Mayor')`);
  assert.equal(faked.error?.code, '42501');
  // Visitors cannot post anonymously.
  const visitor = await as(db, 'anon', null,
    `insert into public.community_posts (author_id, title, body, is_anonymous) values (null, 'Bisita na walang account', 'Hindi dapat ito pumasok.', true)`);
  assert.equal(visitor.error?.code, '42501');
  const visitorComment = await as(db, 'anon', null,
    `insert into public.community_comments (post_id, author_id, body, is_anonymous) values ($1, null, 'Bisita', true)`, [p.id]);
  assert.equal(visitorComment.error?.code, '42501');
});

test('profile edits do not de-anonymize old anonymous items', async () => {
  const anon = (await anonPost(USERS.citizen, 'Lumang lihim na tanong')).rows![0];
  const c = (await anonComment(USERS.citizen, anon.id)).rows![0];
  const named = (await namedPost(USERS.citizen, 'Lumang tanong na may pangalan')).rows![0];
  await db.exec(`update public.profiles set full_name = 'Maria C. Santos', position_title = 'Engineer', avatar_path = null, avatar_preset = 'p7' where id = '${USERS.citizen}'`);

  for (const [table, id] of [['community_posts', anon.id], ['community_comments', c.id]] as const) {
    const r = (await db.query<Row>(`select * from public.${table} where id = $1`, [id])).rows[0];
    assert.equal(r.author_id, null, table);
    assert.equal(r.author_name, 'Anonymous', table);
    assert.equal(r.author_title, null, table);
    assert.equal(r.author_avatar_path, null, table);
    assert.equal(r.author_avatar_preset, null, table);
  }
  const n = (await db.query<Row>(`select * from public.community_posts where id = $1`, [named.id])).rows[0];
  assert.equal(n.author_name, 'Maria C. Santos');
  assert.equal(n.author_avatar_preset, 'p7');
  // The administrators' copy follows the new name.
  const rec = (await db.query<{ author_name: string }>(`select author_name from public.community_anonymous_authors where post_id = $1`, [anon.id])).rows[0];
  assert.equal(rec.author_name, 'Maria C. Santos');
});

test('anonymous items count toward the rate limit', async () => {
  let refused: string | undefined;
  for (let i = 0; i < 12 && !refused; i++) {
    const res = i % 2
      ? await anonPost(OTHER, `Mabilis na lihim na tanong ${i}`)
      : await namedPost(OTHER, `Mabilis na usapan bilang ${i}`);
    refused = res.error?.message;
  }
  assert.match(refused ?? '', /too fast/);
});

test('deleting an account removes its anonymous items too', async () => {
  const p = (await anonPost(GONE, 'Mawawala kasama ng account')).rows![0];
  await db.exec(`delete from auth.users where id = '${GONE}'`);
  const left = await db.query<{ n: number }>(`select count(*)::int as n from public.community_posts where id = $1`, [p.id]);
  assert.equal(left.rows[0].n, 0);
});

test('existing posts are not anonymous', async () => {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from public.community_posts where is_sample and is_anonymous`);
  assert.equal(res.rows[0].n, 0);
});
