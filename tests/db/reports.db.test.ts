import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { USERS, as, createTestDb } from './pglite';

/**
 * Migrations ..._account_type and ..._directory_record_reports, against a local
 * PGlite database with every migration applied in order. Never touches the
 * hosted project.
 */

const OTHER_CITIZEN = '22222222-2222-2222-2222-222222222222';
const SPAMMER = '33333333-3333-3333-3333-333333333333';

let db: PGlite;
before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values
    ('${OTHER_CITIZEN}', 'other@test.local'), ('${SPAMMER}', 'spammer@test.local')`);
});

/** `by` names the submitter explicitly, for inserts that run without a signed-in user (service_role). */
function insertReport(overrides: Record<string, string> = {}, by?: string) {
  const v = {
    category: `'delayed_or_stalled'`,
    source: `'dpwh_contracts'`,
    id: `'23AB0001'`,
    title: `'Road'`,
    snapshot: `'{"status":"ongoing"}'::jsonb`,
    observed: 'null',
    ...overrides,
  };
  return `insert into public.reports
      (report_type, report_category, title, body, record_source, record_id, record_title, record_snapshot, observed_on${by ? ', submitted_by' : ''})
    values ('citizen_concern', ${v.category}, 'Delayed: Road', 'Work has stopped for two months.',
            ${v.source}, ${v.id}, ${v.title}, ${v.snapshot}, ${v.observed}${by ? `, '${by}'` : ''})
    returning id, status, is_public, submitted_by`;
}

test('a signed-in citizen can report a directory record, and it starts private', async () => {
  const res = await as<{ status: string; is_public: boolean; submitted_by: string }>(db, 'authenticated', USERS.citizen, insertReport());
  assert.equal(res.error, undefined, String(res.error));
  assert.equal(res.rows[0].status, 'submitted');
  assert.equal(res.rows[0].is_public, false);
  assert.equal(res.rows[0].submitted_by, USERS.citizen);
});

test('visitors who are not signed in cannot report', async () => {
  const res = await as(db, 'anon', null, insertReport());
  assert.ok(res.error, 'anon insert must fail');
  assert.equal(res.error.code, '42501');
});

test('a deactivated account cannot report', async () => {
  await db.exec(`update public.profiles set is_active = false where id = '${OTHER_CITIZEN}'`);
  const res = await as(db, 'authenticated', OTHER_CITIZEN, insertReport());
  await db.exec(`update public.profiles set is_active = true where id = '${OTHER_CITIZEN}'`);
  assert.ok(res.error, 'deactivated insert must fail');
  assert.equal(res.error.code, '42501');
});

test('the record reference must be complete and only on citizen concerns', async () => {
  // Source without an id, title or snapshot.
  const partial = await as(db, 'service_role', null,
    `insert into public.reports (report_type, report_category, title, body, record_source, submitted_by)
     values ('citizen_concern', 'other', 'Partial', 'body', 'dpwh_contracts', '${USERS.citizen}')`);
  assert.equal(partial.error?.code, '23514');

  // No category.
  const noCategory = await as(db, 'service_role', null, insertReport({ category: 'null' }, USERS.citizen));
  assert.equal(noCategory.error?.code, '23514');

  // Malformed source id.
  const badSource = await as(db, 'service_role', null, insertReport({ source: `'Bad Source'` }, USERS.citizen));
  assert.equal(badSource.error?.code, '23514');

  // Snapshot must be an object.
  const badSnapshot = await as(db, 'service_role', null, insertReport({ snapshot: `'[1,2]'::jsonb` }, USERS.citizen));
  assert.equal(badSnapshot.error?.code, '23514');
});

test('the submitter and LGU admins can read a private report; other citizens cannot', async () => {
  const made = await as<{ id: string }>(db, 'authenticated', USERS.citizen, insertReport({ id: `'23AB0002'` }));
  assert.equal(made.error, undefined, String(made.error));
  const id = made.rows[0].id;
  const read = (role: 'authenticated' | 'anon', sub: string | null) =>
    as<{ id: string }>(db, role, sub, `select id from public.reports where id = '${id}'`);

  assert.equal((await read('authenticated', USERS.citizen)).rows?.length, 1, 'submitter');
  assert.equal((await read('authenticated', USERS.admin)).rows?.length, 1, 'lgu_admin');
  assert.equal((await read('authenticated', OTHER_CITIZEN)).rows?.length, 0, 'other citizen');
  assert.equal((await read('anon', null)).rows?.length, 0, 'visitor');
});

test('the submitter cannot rewrite which record a report is about', async () => {
  const made = await as<{ id: string }>(db, 'authenticated', USERS.citizen, insertReport({ id: `'23AB0003'` }));
  const res = await as(db, 'authenticated', USERS.citizen,
    `update public.reports set record_id = '23AB9999', record_title = 'Other' where id = '${made.rows![0].id}'`);
  assert.ok(res.error, 'record fields are not editable');
});

test('an observation date in the future is rejected', async () => {
  const res = await as(db, 'authenticated', USERS.citizen, insertReport({ observed: `(current_date + 10)` }));
  assert.equal(res.error?.code, '22023');
  const today = await as(db, 'authenticated', USERS.citizen, insertReport({ id: `'23AB0004'`, observed: `current_date` }));
  assert.equal(today.error, undefined, String(today.error));
});

test('an account is limited to 10 directory reports per 24 hours', async () => {
  for (let i = 0; i < 10; i++) {
    const ok = await as(db, 'authenticated', SPAMMER, insertReport({ id: `'23AB10${String(i).padStart(2, '0')}'` }));
    assert.equal(ok.error, undefined, `report ${i + 1}: ${String(ok.error)}`);
  }
  const eleventh = await as(db, 'authenticated', SPAMMER, insertReport({ id: `'23AB1099'` }));
  assert.equal(eleventh.error?.code, '53400');
  // Another account is unaffected.
  const other = await as(db, 'authenticated', OTHER_CITIZEN, insertReport({ id: `'23AB1099'` }));
  assert.equal(other.error, undefined, String(other.error));
});

test('reports not about a directory record still work as before', async () => {
  const res = await as(db, 'authenticated', USERS.citizen,
    `insert into public.reports (report_type, title, body) values ('citizen_concern', 'Pothole', 'Big one near the plaza') returning id`);
  assert.equal(res.error, undefined, String(res.error));
});

// ---------------------------------------------------------------------------
// Account type
// ---------------------------------------------------------------------------

async function signUp(id: string, meta: Record<string, unknown>) {
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
    values ('${id}', '${id}@test.local', '${JSON.stringify(meta).replace(/'/g, "''")}'::jsonb)`);
  const res = await as<{ role: string; account_type: string; claimed_organization: string | null; requested_role: string | null }>(
    db, 'service_role', null,
    `select role, account_type, claimed_organization, requested_role from public.profiles where id = '${id}'`);
  return res.rows![0];
}

test('sign-up records the declared account type, but the role is always citizen', async () => {
  const dev = await signUp('aaaaaaaa-0000-0000-0000-000000000001', { account_type: 'technical_developer', full_name: 'Dev' });
  assert.equal(dev.account_type, 'technical_developer');
  assert.equal(dev.role, 'citizen');

  const emp = await signUp('aaaaaaaa-0000-0000-0000-000000000002', {
    account_type: 'organization_employee', claimed_organization: "  City Engineer's Office  ",
  });
  assert.equal(emp.account_type, 'organization_employee');
  assert.equal(emp.claimed_organization, "City Engineer's Office");
  assert.equal(emp.role, 'citizen');
});

test('sign-up ignores anything it does not recognise', async () => {
  const nothing = await signUp('aaaaaaaa-0000-0000-0000-000000000003', {});
  assert.equal(nothing.account_type, 'citizen');

  const invalid = await signUp('aaaaaaaa-0000-0000-0000-000000000004', { account_type: 'super_admin', requested_role: 'super_admin' });
  assert.equal(invalid.account_type, 'citizen');
  assert.equal(invalid.role, 'citizen');

  // Only organization employees have an organization to name.
  const stray = await signUp('aaaaaaaa-0000-0000-0000-000000000005', { account_type: 'citizen', claimed_organization: 'Sneaky Office' });
  assert.equal(stray.claimed_organization, null);
});

test('a user cannot change their own account type or claimed organization', async () => {
  for (const set of [`account_type = 'organization_employee'`, `claimed_organization = 'Anywhere'`, `role = 'lgu_admin'`]) {
    const res = await as(db, 'authenticated', USERS.citizen, `update public.profiles set ${set} where id = '${USERS.citizen}'`);
    assert.ok(res.error, `must not allow: ${set}`);
  }
});

test('an administrator can correct another account', async () => {
  const res = await as(db, 'authenticated', USERS.admin,
    `update public.profiles set account_type = 'technical_developer', claimed_organization = null where id = '${OTHER_CITIZEN}' returning account_type`);
  assert.equal(res.error, undefined, String(res.error));
  assert.equal(res.rows[0].account_type, 'technical_developer');
});
