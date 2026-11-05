import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/**
 * Migration 20261109000100 (photos on a concern) against a local PGlite
 * database with a small Storage stand-in. Never touches the hosted project.
 */

const OTHER = '22222222-2222-2222-2222-222222222222';
let db: PGlite;
let reportId = '';
let n = 0;

const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const path = (report: string, by: string, name = 'photo.jpg') => `reports/${report}/${by}/${uuid()}-${name}`;

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'other@test.local')`);
  const res = await as<{ id: string }>(db, 'authenticated', USERS.citizen,
    `insert into public.reports (report_type, title, body, submitted_by)
     values ('citizen_concern', 'Pothole near plaza', 'Big one near the plaza, very deep.', '${USERS.citizen}') returning id`);
  assert.equal(res.error, undefined, String(res.error));
  reportId = res.rows[0].id;
});

const upload = (who: string, name: string) =>
  as(db, 'authenticated', who, `insert into storage.objects (bucket_id, name) values ('report-photos', $1)`, [name]);

const attach = (who: string, storagePath: string, extra: { mime?: string; size?: number } = {}) =>
  as(db, 'authenticated', who, `insert into public.attachments (report_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ($1, 'concern_evidence', $2, 'photo.jpg', $3, $4) returning id`,
    [reportId, storagePath, extra.mime ?? 'image/jpeg', extra.size ?? 200_000]);

test('the bucket is private and only takes small images', async () => {
  const b = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
    `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'report-photos'`);
  assert.equal(b.rows[0].public, false);
  assert.equal(Number(b.rows[0].file_size_limit), 5 * 1024 * 1024);
  assert.deepEqual(b.rows[0].allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
});

test('the reporter can upload into their own folder of their own report', async () => {
  const res = await upload(USERS.citizen, path(reportId, USERS.citizen));
  assert.equal(res.error, undefined, String(res.error));
});

test('nobody can upload into someone else\'s folder or someone else\'s report', async () => {
  assert.equal((await upload(USERS.citizen, path(reportId, OTHER))).error?.code, '42501');
  assert.equal((await upload(OTHER, path(reportId, OTHER))).error?.code, '42501');
  assert.equal((await as(db, 'anon', null, `insert into storage.objects (bucket_id, name) values ('report-photos', '${path(reportId, USERS.citizen)}')`)).error?.code, '42501');
});

test('a badly shaped path is refused, not an error', async () => {
  for (const name of ['photo.jpg', `reports/not-a-uuid/${USERS.citizen}/x.jpg`, `reports/${reportId}/${USERS.citizen}/../../x.jpg`, `other/${reportId}/${USERS.citizen}/${uuid()}-x.jpg`]) {
    assert.equal((await upload(USERS.citizen, name)).error?.code, '42501', name);
  }
});

test('the photo is saved against the report and visible to the reporter and staff only', async () => {
  const p = path(reportId, USERS.citizen);
  assert.equal((await upload(USERS.citizen, p)).error, undefined);
  const a = await attach(USERS.citizen, p);
  assert.equal(a.error, undefined, String(a.error));

  const read = (who: string) => as<{ name: string }>(db, 'authenticated', who, `select name from storage.objects where name = $1`, [p]);
  assert.equal((await read(USERS.citizen)).rows?.length, 1);
  assert.equal((await read(USERS.admin)).rows?.length, 1, 'LGU staff can read it');
  assert.equal((await read(OTHER)).rows?.length, 0, 'another citizen cannot');
  assert.equal((await as(db, 'anon', null, `select name from storage.objects where name = $1`, [p])).rows?.length, 0);
});

test('a file with no attachment row cannot be read by anyone else', async () => {
  const p = path(reportId, USERS.citizen);
  await upload(USERS.citizen, p);
  const res = await as<{ name: string }>(db, 'authenticated', USERS.admin, `select name from storage.objects where name = $1`, [p]);
  assert.equal(res.rows?.length, 0);
});

test('only images up to 5 MB, and at most 4 per report', async () => {
  assert.ok((await attach(USERS.citizen, path(reportId, USERS.citizen), { mime: 'application/pdf' })).error, 'pdf refused');
  assert.ok((await attach(USERS.citizen, path(reportId, USERS.citizen), { size: 6 * 1024 * 1024 })).error, 'too big refused');
  for (let i = 0; i < 3; i += 1) {
    const res = await attach(USERS.citizen, path(reportId, USERS.citizen));
    assert.equal(res.error, undefined, `photo ${i + 2}: ${res.error}`);
  }
  const fifth = await attach(USERS.citizen, path(reportId, USERS.citizen));
  assert.equal(fifth.error?.code, '53400');
});

test('once staff open the report, no more photos can be added', async () => {
  await as(db, 'authenticated', USERS.planner, `update public.reports set status = 'in_review' where id = '${reportId}'`);
  assert.equal((await upload(USERS.citizen, path(reportId, USERS.citizen))).error?.code, '42501');
});

test('a reporter can remove their own upload but not someone else\'s', async () => {
  const mine = path(reportId, USERS.citizen);
  await db.exec(`insert into storage.objects (bucket_id, name, owner) values ('report-photos', '${mine}', '${USERS.citizen}')`);
  const left = async () => (await db.query(`select 1 from storage.objects where name = '${mine}'`)).rows.length;
  await as(db, 'authenticated', OTHER, `delete from storage.objects where name = '${mine}'`);
  assert.equal(await left(), 1, 'another account cannot remove it');
  await as(db, 'authenticated', USERS.citizen, `delete from storage.objects where name = '${mine}'`);
  assert.equal(await left(), 0);
});
