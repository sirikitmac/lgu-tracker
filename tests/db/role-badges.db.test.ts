import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/** Migration 20261118000100 (role pills) against local PGlite. Never touches the hosted project. */

const SUPER = '88888888-8888-8888-8888-888888888888';
const CONTRACTOR = '55555555-5555-5555-5555-555555555555';
let db: PGlite;

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${SUPER}', 'super@test.local'), ('${CONTRACTOR}', 'contractor@test.local')`);
  await db.exec(`update public.profiles set role = 'super_admin' where id = '${SUPER}'`);
  await db.exec(`update public.profiles set role = 'contractor' where id = '${CONTRACTOR}'`);
});

type Badge = { author_badge_tier: string | null; author_badge_label: string | null; author_badge_color: string | null; is_anonymous: boolean };
const post = (who: string, anonymous = false) =>
  as<Badge & { id: string }>(db, 'authenticated', who,
    `insert into public.community_posts (author_id, title, body, is_anonymous) values ($1, 'Isang magandang tanong', 'Ito ang katawan ng post.', $2) returning *`,
    [anonymous ? null : who, anonymous]);
const comment = (who: string, postId: string) =>
  as<Badge>(db, 'authenticated', who,
    `insert into public.community_comments (post_id, author_id, body) values ($1, $2, 'Isang sagot.') returning *`, [postId, who]);
const styles = async () =>
  Object.fromEntries((await db.query<{ tier: string; label: string; color: string }>(`select * from public.role_badge_styles`)).rows.map((r) => [r.tier, [r.label, r.color]]));

test('the three default pills are purple, red and green', async () => {
  assert.deepEqual(await styles(), {
    super_admin: ['Super Admin', '#7C3AED'],
    admin: ['Admin', '#DC2626'],
    employee: ['LGU', '#16A34A'],
  });
});

test('everyone, even a visitor, can read the pill styles', async () => {
  for (const [role, who] of [['anon', null], ['authenticated', USERS.citizen]] as const) {
    const res = await as(db, role, who, `select tier from public.role_badge_styles`);
    assert.equal(res.rows?.length, 3, role);
  }
});

test('posts and comments carry the author\'s kind of pill; citizens and contractors have none', async () => {
  const expected: [string, string | null][] = [
    [SUPER, 'super_admin'], [USERS.admin, 'admin'], [USERS.planner, 'employee'], [USERS.engineer, 'employee'],
    [USERS.citizen, null], [CONTRACTOR, null],
  ];
  for (const [who, tier] of expected) {
    const p = await post(who);
    assert.equal(p.error, undefined, String(p.error));
    assert.equal(p.rows![0].author_badge_tier, tier, who);
    assert.equal(p.rows![0].author_badge_label, null, who);
    const c = await comment(who, p.rows![0].id);
    assert.equal(c.rows![0].author_badge_tier, tier, who);
  }
});

test('an anonymous post or comment carries no pill, even from an administrator', async () => {
  const p = await post(USERS.admin, true);
  assert.equal(p.error, undefined, String(p.error));
  assert.deepEqual([p.rows![0].author_badge_tier, p.rows![0].author_badge_label, p.rows![0].author_badge_color], [null, null, null]);
  const c = await as<Badge>(db, 'authenticated', USERS.admin,
    `insert into public.community_comments (post_id, author_id, body, is_anonymous) values ($1, null, 'Walang pangalan.', true) returning *`, [p.rows![0].id]);
  assert.equal(c.rows![0].author_badge_tier, null);
});

test('only an administrator can restyle the default pills, and only label and colour', async () => {
  const bad = await as(db, 'authenticated', USERS.citizen, `update public.role_badge_styles set color = '#000000' where tier = 'admin' returning tier`);
  assert.equal(bad.rows?.length ?? 0, 0, 'RLS hides the row from a citizen');
  const planner = await as(db, 'authenticated', USERS.planner, `update public.role_badge_styles set color = '#000000' where tier = 'admin' returning tier`);
  assert.equal(planner.rows?.length ?? 0, 0, 'RLS hides the row from a government employee');
  const anon = await as(db, 'anon', null, `update public.role_badge_styles set color = '#000000' where tier = 'admin' returning tier`);
  assert.ok(anon.error, 'a visitor cannot update');
  assert.deepEqual((await styles()).admin, ['Admin', '#DC2626']);

  const ok = await as(db, 'authenticated', USERS.admin, `update public.role_badge_styles set label = '  Mayor''s Office ', color = '#0EA5E9' where tier = 'employee' returning tier`);
  assert.equal(ok.error, undefined, String(ok.error));
  assert.deepEqual((await styles()).employee, ["Mayor's Office", '#0EA5E9']);

  const tierEdit = await as(db, 'authenticated', USERS.admin, `update public.role_badge_styles set tier = 'admin' where tier = 'employee'`);
  assert.ok(tierEdit.error, 'the tier itself cannot be changed');
  await db.exec(`update public.role_badge_styles set label = 'LGU', color = '#16A34A' where tier = 'employee'`);
});

test('colours must be six-digit hex and labels short', async () => {
  for (const color of ['red', '#FFF', '#GGGGGG', "#16A34A'; --"]) {
    const res = await as(db, 'authenticated', USERS.admin, `update public.role_badge_styles set color = $1 where tier = 'admin'`, [color]);
    assert.equal(res.error?.code, '23514', color);
  }
  for (const label of ['', '   ', 'x'.repeat(25)]) {
    const res = await as(db, 'authenticated', USERS.admin, `update public.role_badge_styles set label = $1 where tier = 'admin'`, [label]);
    assert.equal(res.error?.code, '23514', JSON.stringify(label));
  }
});

test('an administrator can give themselves a custom pill; it shows on their next posts and old ones', async () => {
  const before = (await post(USERS.admin)).rows![0];
  assert.equal(before.author_badge_label, null);
  const set = await as(db, 'authenticated', USERS.admin, `update public.profiles set badge_label = 'Founder', badge_color = '#F59E0B' where id = $1 returning id`, [USERS.admin]);
  assert.equal(set.error, undefined, String(set.error));
  const old = await db.query<Badge>(`select * from public.community_posts where id = '${before.id}'`);
  assert.deepEqual([old.rows[0].author_badge_tier, old.rows[0].author_badge_label, old.rows[0].author_badge_color], ['admin', 'Founder', '#F59E0B']);
  const fresh = (await post(USERS.admin)).rows![0];
  assert.deepEqual([fresh.author_badge_tier, fresh.author_badge_label, fresh.author_badge_color], ['admin', 'Founder', '#F59E0B']);
  const cleared = await as(db, 'authenticated', USERS.admin, `update public.profiles set badge_label = null, badge_color = null where id = $1`, [USERS.admin]);
  assert.equal(cleared.error, undefined, String(cleared.error));
  const after = await db.query<Badge>(`select * from public.community_posts where id = '${before.id}'`);
  assert.equal(after.rows[0].author_badge_label, null);
});

test('the label and colour come as a pair', async () => {
  const half = await as(db, 'authenticated', USERS.admin, `update public.profiles set badge_label = 'Solo' where id = $1`, [USERS.admin]);
  assert.equal(half.error?.code, '23514');
});

test('nobody but an administrator can set a custom pill, and nobody can set someone else\'s', async () => {
  for (const who of [USERS.citizen, USERS.planner, USERS.engineer]) {
    const res = await as(db, 'authenticated', who, `update public.profiles set badge_label = 'VIP', badge_color = '#000000' where id = $1`, [who]);
    assert.equal(res.error?.code, '42501', who);
  }
  const other = await as(db, 'authenticated', USERS.admin, `update public.profiles set badge_label = 'Hacked', badge_color = '#000000' where id = $1`, [USERS.planner]);
  assert.equal(other.error?.code, '42501');
  const asSuper = await as(db, 'authenticated', SUPER, `update public.profiles set badge_label = 'Hacked', badge_color = '#000000' where id = $1`, [USERS.admin]);
  assert.equal(asSuper.error?.code, '42501', 'not even a super admin can badge another account');
});

test('an administrator can still edit someone else\'s profile without touching the pill', async () => {
  const res = await as(db, 'authenticated', USERS.admin, `update public.profiles set position_title = 'Planner II' where id = $1 returning id`, [USERS.planner]);
  assert.equal(res.error, undefined, String(res.error));
});

test('a role change updates the pill on existing items; a demoted administrator loses the custom pill', async () => {
  const p = (await post(USERS.planner)).rows![0];
  assert.equal(p.author_badge_tier, 'employee');
  await db.exec(`update public.profiles set role = 'citizen' where id = '${USERS.planner}'`);
  assert.equal((await db.query<Badge>(`select * from public.community_posts where id = '${p.id}'`)).rows[0].author_badge_tier, null);
  await db.exec(`update public.profiles set role = 'planning_officer' where id = '${USERS.planner}'`);
  assert.equal((await db.query<Badge>(`select * from public.community_posts where id = '${p.id}'`)).rows[0].author_badge_tier, 'employee');

  await as(db, 'authenticated', SUPER, `update public.profiles set badge_label = 'Boss', badge_color = '#111111' where id = $1`, [SUPER]);
  const sp = (await post(SUPER)).rows![0];
  assert.equal(sp.author_badge_label, 'Boss');
  const demote = await as(db, 'authenticated', USERS.admin, `update public.profiles set role = 'planning_officer' where id = $1`, [SUPER]);
  assert.equal(demote.error?.code, '42501', 'an admin cannot demote a super admin');
  await db.exec(`update public.profiles set role = 'planning_officer' where id = '${SUPER}'`);
  const row = (await db.query<Badge>(`select * from public.community_posts where id = '${sp.id}'`)).rows[0];
  assert.deepEqual([row.author_badge_tier, row.author_badge_label, row.author_badge_color], ['employee', null, null], 'service-side demotion still hides the stale custom pill');
});
