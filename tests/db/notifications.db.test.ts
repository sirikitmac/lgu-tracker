import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/**
 * Migration 20261108000100 (notifications and the report workflow) against a
 * local PGlite database with every migration applied in order. Never touches
 * the hosted project.
 */

const SUPER = '88888888-8888-8888-8888-888888888888';
const NEWCOMER = '99999999-9999-9999-9999-999999999999';
const UNCONFIRMED = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

let db: PGlite;
before(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${SUPER}', 'super@test.local');
    update public.profiles set role = 'super_admin' where id = '${SUPER}';
    delete from public.notifications;
  `);
});

const inbox = async (who: string) =>
  (await as<{ kind: string; title: string; body: string | null; link: string | null; read_at: string | null; id: string }>(
    db, 'authenticated', who, 'select id, kind, title, body, link, read_at from public.notifications order by created_at, id'
  )).rows ?? [];

const report = (extra = '') => `insert into public.reports
  (report_type, report_category, title, body, record_source, record_id, record_title, record_snapshot)
  values ('citizen_concern', 'poor_quality', 'Poor quality: Barangay Road', 'Cracks after one month.',
          'dpwh_contracts', '23AB0001', 'Barangay Road', '{"status":"ongoing"}'::jsonb) ${extra}`;

let reportId = '';

test('a new report gives the submitter a receipt and tells admins and planners', async () => {
  const res = await as<{ id: string }>(db, 'authenticated', USERS.citizen, report('returning id'));
  assert.equal(res.error, undefined, String(res.error));
  reportId = res.rows[0].id;

  const mine = await inbox(USERS.citizen);
  assert.deepEqual(mine.map((n) => n.kind), ['report_received']);
  assert.equal(mine[0].link, `/my-reports/${reportId}`);

  for (const staff of [USERS.admin, USERS.planner, SUPER]) {
    const rows = await inbox(staff);
    assert.deepEqual(rows.map((n) => n.kind), ['report_new'], `staff ${staff}`);
    assert.equal(rows[0].link, `/reports/${reportId}`);
  }
  // Engineers handle reports on assigned projects only; this one has no project.
  assert.equal((await inbox(USERS.engineer)).length, 0);
});

test('the report gets a short number and a first timeline entry', async () => {
  const r = await as<{ ref_no: string }>(db, 'authenticated', USERS.citizen, `select ref_no from public.reports where id = '${reportId}'`);
  assert.ok(Number(r.rows![0].ref_no) >= 1);
  const ev = await as<{ kind: string }>(db, 'authenticated', USERS.citizen, `select kind from public.report_events where report_id = '${reportId}'`);
  assert.deepEqual(ev.rows!.map((e) => e.kind), ['submitted']);
});

test('people only ever see their own notifications', async () => {
  assert.equal((await as(db, 'anon', null, 'select 1 from public.notifications')).error?.code, '42501');
  const other = await as<{ n: string }>(db, 'authenticated', USERS.engineer, 'select count(*) as n from public.notifications');
  assert.equal(Number(other.rows![0].n), 0);
});

test('a browser cannot write notifications or edit their text', async () => {
  const ins = await as(db, 'authenticated', USERS.citizen,
    `insert into public.notifications (recipient_id, kind, title) values ('${USERS.admin}', 'system', 'hi')`);
  assert.equal(ins.error?.code, '42501');

  const edit = await as(db, 'authenticated', USERS.citizen, `update public.notifications set title = 'changed' where recipient_id = '${USERS.citizen}'`);
  assert.equal(edit.error?.code, '42501');

  const theirs = await as(db, 'authenticated', USERS.citizen, `update public.notifications set read_at = now() where recipient_id = '${USERS.admin}' returning id`);
  assert.equal(theirs.rows?.length, 0, 'another person\'s rows are invisible to update');
});

test('a person can mark their own notifications read, and delete them', async () => {
  const mark = await as(db, 'authenticated', USERS.citizen, 'update public.notifications set read_at = now() where read_at is null returning id');
  assert.equal(mark.rows?.length, 1);
  const del = await as(db, 'authenticated', USERS.engineer, 'delete from public.notifications returning id');
  assert.equal(del.rows?.length, 0);
});

test('links must be in-app paths', async () => {
  const bad = await db.query(`insert into public.notifications (recipient_id, kind, title, link) values ('${USERS.citizen}', 'system', 't', '//evil.example')`).catch((e) => e);
  assert.ok(bad instanceof Error, 'protocol-relative links are rejected');
  const bad2 = await db.query(`insert into public.notifications (recipient_id, kind, title, link) values ('${USERS.citizen}', 'system', 't', 'https://evil.example')`).catch((e) => e);
  assert.ok(bad2 instanceof Error, 'absolute links are rejected');
});

test('a status change tells the submitter and records the handler\'s note', async () => {
  const res = await as(db, 'authenticated', USERS.planner,
    `update public.reports set status = 'in_review', resolution_notes = 'Inspection scheduled Friday.' where id = '${reportId}' returning status`);
  assert.equal(res.error, undefined, String(res.error));

  const mine = await inbox(USERS.citizen);
  const update = mine.find((n) => n.kind === 'report_update');
  assert.ok(update, 'submitter notified');
  assert.equal(update.title, 'Your report is being reviewed');
  assert.match(update.body ?? '', /Inspection scheduled Friday/);

  const ev = await as<{ kind: string; to_status: string; note: string | null }>(db, 'authenticated', USERS.citizen,
    `select kind, to_status, note from public.report_events where report_id = '${reportId}' order by created_at, id`);
  assert.deepEqual(ev.rows!.map((e) => e.to_status), ['submitted', 'in_review']);
  assert.equal(ev.rows![1].note, 'Inspection scheduled Friday.');
});

test('the timeline is private to the submitter and handlers', async () => {
  const stranger = await as(db, 'authenticated', USERS.engineer, `select 1 from public.report_events where report_id = '${reportId}'`);
  assert.equal(stranger.rows?.length, 0);
  const anon = await as(db, 'anon', null, 'select 1 from public.report_events');
  assert.equal(anon.error?.code, '42501');
});

test('imports with the service role stay quiet', async () => {
  const before = Number((await db.query<{ n: number }>('select count(*)::int as n from public.notifications')).rows[0].n);
  const res = await as(db, 'service_role', null, `insert into public.reports
    (report_type, report_category, title, body, record_source, record_id, record_title, record_snapshot, submitted_by)
    values ('citizen_concern', 'poor_quality', 'Poor quality: Bridge', 'Imported.', 'dpwh_contracts', '23AB0002', 'Bridge',
            '{"status":"ongoing"}'::jsonb, '${USERS.citizen}')`);
  assert.equal(res.error, undefined, String(res.error));
  const after = Number((await db.query<{ n: number }>('select count(*)::int as n from public.notifications')).rows[0].n);
  assert.equal(after, before);
});

test('a confirmed role request reaches administrators; an unconfirmed one waits', async () => {
  await db.exec(`delete from public.notifications`);
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
    ('${NEWCOMER}', 'new@test.local', '{"full_name":"Ana Reyes","requested_role":"planning_officer","account_type":"organization_employee","claimed_organization":"City Planning Office"}', now())`);
  assert.deepEqual((await inbox(USERS.admin)).map((n) => n.kind), ['role_requested']);
  assert.deepEqual((await inbox(SUPER)).map((n) => n.kind), ['role_requested']);
  assert.match((await inbox(USERS.admin))[0].body ?? '', /Planning Officer at City Planning Office/);

  await db.exec(`delete from public.notifications`);
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
    ('${UNCONFIRMED}', 'later@test.local', '{"full_name":"Later","requested_role":"budget_officer"}')`);
  assert.equal((await inbox(USERS.admin)).length, 0, 'nothing before the e-mail is confirmed');
  await db.exec(`update auth.users set email_confirmed_at = now() where id = '${UNCONFIRMED}'`);
  assert.equal((await inbox(USERS.admin)).length, 1, 'announced once confirmed');
});

test('admin-level requests only go to super administrators', async () => {
  await db.exec(`delete from public.notifications`);
  const id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
    ('${id}', 'wannabe@test.local', '{"full_name":"Wannabe","requested_role":"super_admin"}', now())`);
  assert.equal((await inbox(USERS.admin)).length, 0);
  assert.equal((await inbox(SUPER)).length, 1);
});

test('approving a request tells the person; declining clears it', async () => {
  await db.exec(`delete from public.notifications`);
  const ok = await as(db, 'authenticated', USERS.admin,
    `update public.profiles set role = 'planning_officer', requested_role = null where id = '${NEWCOMER}' returning role`);
  assert.equal(ok.error, undefined, String(ok.error));
  const approved = await inbox(NEWCOMER);
  assert.equal(approved[0].title, 'You are now a Planning Officer');

  const no = await as(db, 'authenticated', USERS.admin, `update public.profiles set requested_role = null where id = '${UNCONFIRMED}' returning id`);
  assert.equal(no.error, undefined, String(no.error));
  const declined = await inbox(UNCONFIRMED);
  assert.equal(declined[0].title, 'Role request not approved');
});

test('only an administrator can clear a role request', async () => {
  await db.exec(`update public.profiles set requested_role = 'budget_officer' where id = '${USERS.citizen}'`);
  const citizenClears = await as(db, 'authenticated', USERS.citizen, `update public.profiles set requested_role = null where id = '${USERS.citizen}'`);
  assert.equal(citizenClears.error?.code, '42501');
});

test('an LGU administrator cannot make anyone an administrator', async () => {
  const res = await as(db, 'authenticated', USERS.admin, `update public.profiles set role = 'lgu_admin' where id = '${USERS.citizen}'`);
  assert.equal(res.error?.code, '42501');
});

test('system alerts: service role only, administrators receive them', async () => {
  await db.exec(`delete from public.notifications`);
  const denied = await as(db, 'authenticated', USERS.citizen, `select public.create_system_alert('x')`);
  assert.equal(denied.error?.code, '42501');
  const anon = await as(db, 'anon', null, `select public.create_system_alert('x')`);
  assert.equal(anon.error?.code, '42501');

  const ok = await as<{ n: number }>(db, 'service_role', null, `select public.create_system_alert('DPWH sync failed', 'Run 42 stopped at row 1,200.', '/dashboard') as n`);
  assert.equal(ok.error, undefined, String(ok.error));
  assert.equal(ok.rows![0].n, 2);
  assert.deepEqual((await inbox(USERS.admin)).map((n) => n.kind), ['system']);
  assert.equal((await inbox(USERS.citizen)).length, 0);
});
