import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';
import { MOCK_COMMENTS, MOCK_POSTS } from '@/lib/community/mock';

/** Migrations 20261112000100/200 (Bantay Community) against local PGlite. Never touches the hosted project. */

const OTHER = '22222222-2222-2222-2222-222222222222';
const PHOTO = `${USERS.citizen}/00000000-0000-4000-8000-000000000001.jpg`;
let db: PGlite;

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'other@test.local')`);
  await db.exec(`update public.profiles set full_name = 'Maria Clara Santos', position_title = 'Teacher', avatar_path = '${PHOTO}' where id = '${USERS.citizen}'`);
  await db.exec(`update public.profiles set full_name = 'Pedro Reyes', avatar_preset = 'p4' where id = '${OTHER}'`);
});

type Post = { id: string; author_id: string | null; title: string; body: string; author_name: string; author_title: string | null; author_avatar_path: string | null; author_avatar_preset: string | null; score: number; comment_count: number; is_sample: boolean };
type Comment = Post & { post_id: string; parent_id: string | null };

const post = (who: string, title = 'Bitak ang kalsada sa amin', extra = '') =>
  as<Post>(db, 'authenticated', who, `insert into public.community_posts (author_id, title, body${extra ? ', ' + extra.split('|')[0] : ''}) values ($1, $2, 'Sino pa ang nakakita nito sa barangay ninyo?'${extra ? ', ' + extra.split('|')[1] : ''}) returning *`, [who, title]);
const comment = (who: string, postId: string, body = 'Oo, nakita ko rin.', parent: string | null = null) =>
  as<Comment>(db, 'authenticated', who, `insert into public.community_comments (post_id, parent_id, author_id, body) values ($1, $2, $3, $4) returning *`, [postId, parent, who, body]);
const vote = (who: string, col: 'post_id' | 'comment_id', target: string, value: number) =>
  as(db, 'authenticated', who, `insert into public.community_votes (user_id, ${col}, value) values ($1, $2, $3) returning *`, [who, target, value]);
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

test('the sample discussions are stored and readable by anyone', async () => {
  const res = await as<{ n: number }>(db, 'anon', null, `select count(*)::int as n from public.community_posts where is_sample`);
  assert.equal(res.rows?.[0].n, MOCK_POSTS.length);
  const c = await as<{ n: number }>(db, 'anon', null, `select count(*)::int as n from public.community_comments where is_sample`);
  assert.equal(c.rows?.[0].n, MOCK_COMMENTS.length);
  const counts = await one<{ bad: number }>(`select count(*)::int as bad from public.community_posts p where p.comment_count <> (select count(*) from public.community_comments c where c.post_id = p.id)`);
  assert.equal(counts.bad, 0);
});

test('anon cannot post, comment or vote', async () => {
  const res = await as(db, 'anon', null, `insert into public.community_posts (author_id, title, body) values ('${USERS.citizen}', 'Hindi dapat ito', 'Hindi ito dapat makapasok.')`);
  assert.equal(res.error?.code, '42501');
  const v = await as(db, 'anon', null, `insert into public.community_votes (user_id, post_id, value) select '${USERS.citizen}', id, 1 from public.community_posts limit 1`);
  assert.equal(v.error?.code, '42501');
});

test('a post carries the author name, job and picture from their profile, not what the client sends', async () => {
  const res = await as<Post>(db, 'authenticated', USERS.citizen,
    `insert into public.community_posts (author_id, title, body) values ($1, '  Bitak ang kalsada sa amin  ', 'Sino pa ang nakakita nito?') returning *`, [USERS.citizen]);
  assert.equal(res.error, undefined, String(res.error));
  const p = res.rows![0];
  assert.equal(p.title, 'Bitak ang kalsada sa amin');
  assert.equal(p.author_name, 'Maria Clara Santos');
  assert.equal(p.author_title, 'Teacher');
  assert.equal(p.author_avatar_path, PHOTO);
  assert.equal(p.score, 0);
  assert.equal(p.is_sample, false);
  const faked = await as(db, 'authenticated', USERS.citizen,
    `insert into public.community_posts (author_id, title, body, author_name) values ($1, 'Pekeng pangalan dito', 'Susubukan kong palitan ang pangalan.', 'Admin') returning *`, [USERS.citizen]);
  assert.equal(faked.error?.code, '42501', 'author_name is not a writable column');
});

test('nobody posts or comments as someone else', async () => {
  const res = await as(db, 'authenticated', USERS.citizen,
    `insert into public.community_posts (author_id, title, body) values ($1, 'Gamit ang pangalan ng iba', 'Hindi ito dapat gumana.')`, [OTHER]);
  assert.equal(res.error?.code, '42501');
  const p = (await post(USERS.citizen, 'Para sa mga komento sa ibaba')).rows![0];
  const c = await as(db, 'authenticated', USERS.citizen, `insert into public.community_comments (post_id, author_id, body) values ($1, $2, 'peke')`, [p.id, OTHER]);
  assert.equal(c.error?.code, '42501');
});

test('limits: title 8-140, body 10-2000, comment 1-1000, project link stays on this site', async () => {
  assert.equal((await post(USERS.citizen, 'Maikli')).error?.code, '23514');
  assert.equal((await post(USERS.citizen, 'x'.repeat(141))).error?.code, '23514');
  assert.equal((await post(USERS.citizen, 'May link sa proyekto', `project_href|'https://evil.example/phish'`)).error?.code, '23514');
  assert.equal((await post(USERS.citizen, 'May link sa proyekto', `project_href|'javascript:alert(1)'`)).error?.code, '23514');
  const ok = await post(USERS.citizen, 'May link na tama dito', `project_href|'/projects?q=road%20concreting'`);
  assert.equal(ok.error, undefined, String(ok.error));
  assert.equal((await comment(USERS.citizen, ok.rows![0].id, '   ')).error?.code, '23514');
  assert.equal((await comment(USERS.citizen, ok.rows![0].id, 'x'.repeat(1001))).error?.code, '23514');
});

test('comment counts follow comments; a reply must belong to the same post', async () => {
  const a = (await post(USERS.citizen, 'Unang usapan para sa bilang')).rows![0];
  const b = (await post(USERS.citizen, 'Pangalawang usapan para sa bilang')).rows![0];
  const c1 = (await comment(OTHER, a.id)).rows![0];
  await comment(USERS.citizen, a.id, 'Salamat sa sagot.', c1.id);
  assert.equal((await one<{ comment_count: number }>(`select comment_count from public.community_posts where id = $1`, [a.id])).comment_count, 2);
  const cross = await comment(OTHER, b.id, 'Maling thread', c1.id);
  assert.equal(cross.error?.code, '23514');
  const del = await as(db, 'authenticated', OTHER, `delete from public.community_comments where id = $1 returning id`, [c1.id]);
  assert.equal(del.rows?.length, 1);
  assert.equal((await one<{ comment_count: number }>(`select comment_count from public.community_posts where id = $1`, [a.id])).comment_count, 0, 'its reply went with it');
});

test('votes: one per person, change or take back, scores follow; a sample keeps its starting score', async () => {
  const p = (await post(USERS.citizen, 'Usapan para sa mga boto')).rows![0];
  assert.equal((await vote(OTHER, 'post_id', p.id, 1)).error, undefined);
  assert.equal((await vote(USERS.citizen, 'post_id', p.id, 1)).error, undefined);
  assert.equal((await vote(OTHER, 'post_id', p.id, 1)).error?.code, '23505', 'only one vote each');
  const score = () => one<{ score: number }>(`select score from public.community_posts where id = $1`, [p.id]).then((r) => r.score);
  assert.equal(await score(), 2);
  await as(db, 'authenticated', OTHER, `update public.community_votes set value = -1 where user_id = $1 and post_id = $2`, [OTHER, p.id]);
  assert.equal(await score(), 0);
  await as(db, 'authenticated', USERS.citizen, `delete from public.community_votes where user_id = $1 and post_id = $2`, [USERS.citizen, p.id]);
  assert.equal(await score(), -1);

  const sample = await one<{ id: string; score: number }>(`select id, score from public.community_posts where sample_author = 'ramon'`);
  assert.equal(sample.score, 118);
  await vote(OTHER, 'post_id', sample.id, 1);
  assert.equal((await one<{ score: number }>(`select score from public.community_posts where id = $1`, [sample.id])).score, 119);
});

test('votes are private to the voter and cannot be cast for, moved or counted by someone else', async () => {
  const p = (await post(USERS.citizen, 'Usapan para sa pribadong boto')).rows![0];
  await vote(OTHER, 'post_id', p.id, 1);
  const seen = await as<{ n: number }>(db, 'authenticated', USERS.citizen, `select count(*)::int as n from public.community_votes where post_id = $1`, [p.id]);
  assert.equal(seen.rows?.[0].n, 0);
  const anon = await as(db, 'anon', null, `select * from public.community_votes`);
  assert.equal(anon.error?.code, '42501');
  const forged = await as(db, 'authenticated', USERS.citizen, `insert into public.community_votes (user_id, post_id, value) values ($1, $2, 1)`, [OTHER, p.id]);
  assert.equal(forged.error?.code, '42501');
  const moved = await as(db, 'authenticated', OTHER, `update public.community_votes set post_id = null, comment_id = null where user_id = $1`, [OTHER]);
  assert.ok(moved.error);
  const direct = await as(db, 'authenticated', USERS.citizen, `update public.community_posts set score = 9999 where id = $1`, [p.id]);
  assert.equal(direct.error?.code, '42501', 'scores are not writable by clients');
});

test('delete: your own, or an administrator; not someone else\'s', async () => {
  const p = (await post(USERS.citizen, 'Usapang buburahin mamaya')).rows![0];
  const other = await as(db, 'authenticated', OTHER, `delete from public.community_posts where id = $1 returning id`, [p.id]);
  assert.equal(other.rows?.length ?? 0, 0);
  const admin = await as(db, 'authenticated', USERS.admin, `delete from public.community_posts where id = $1 returning id`, [p.id]);
  assert.equal(admin.rows?.length, 1);
  const q = (await post(USERS.citizen, 'Usapang buburahin ng may-akda')).rows![0];
  const own = await as(db, 'authenticated', USERS.citizen, `delete from public.community_posts where id = $1 returning id`, [q.id]);
  assert.equal(own.rows?.length, 1);
});

test('editing a profile refreshes the name, job and picture on past posts and comments', async () => {
  const p = (await post(USERS.citizen, 'Usapan bago magpalit ng profile')).rows![0];
  const c = (await comment(USERS.citizen, p.id, 'Komento bago magpalit.')).rows![0];
  await db.exec(`update public.profiles set full_name = 'Maria C. Santos', position_title = 'Engineer', avatar_path = null, avatar_preset = 'p7' where id = '${USERS.citizen}'`);
  for (const t of ['community_posts', 'community_comments']) {
    const id = t === 'community_posts' ? p.id : c.id;
    const r = await one<Post>(`select * from public.${t} where id = $1`, [id]);
    assert.equal(r.author_name, 'Maria C. Santos');
    assert.equal(r.author_title, 'Engineer');
    assert.equal(r.author_avatar_path, null);
    assert.equal(r.author_avatar_preset, 'p7');
  }
});

test('writing too fast is refused', async () => {
  let refused: string | undefined;
  for (let i = 0; i < 12 && !refused; i++) refused = (await post(OTHER, `Mabilis na usapan bilang ${i}`)).error?.message;
  assert.match(refused ?? '', /too fast/);
});
