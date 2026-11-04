import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findReportTargets, targetFromRecord } from '@/lib/reports/lookup';
import { reportHref } from '@/lib/reports/href';

/** A stand-in for the one query chain findReportTargets runs; records the filter it was given. */
function fakeClient(rows: unknown[], seen: { filter?: string } = {}, failWith?: Error) {
  const chain = {
    select: () => chain,
    or: (filter: string) => {
      seen.filter = filter;
      return chain;
    },
    limit: async () => (failWith ? { data: null, error: failWith } : { data: rows, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

test('asks for a code when nothing was typed', async () => {
  const r = await findReportTargets(fakeClient([]), '   ');
  assert.equal(r.ok, false);
});

test('rejects text that cannot be a code, before any query runs', async () => {
  const seen: { filter?: string } = {};
  for (const bad of ['a b c', 'x,y', 'abc)', '%%%', 'ab']) {
    const r = await findReportTargets(fakeClient([], seen), bad);
    assert.equal(r.ok, false, bad);
  }
  assert.equal(seen.filter, undefined);
});

test('normalizes a pasted code and matches on id or project code', async () => {
  const seen: { filter?: string } = {};
  const rows = [
    { source: 'subaybayan_rlip', record_id: 'LIME-25-13-02-00-000-41', title: 'Barangay road', project_code: 'LIME-25-13-02-00-000-41' },
  ];
  const r = await findReportTargets(fakeClient(rows, seen), ' lime – 25 – 13-02-00-000-41 ');
  assert.ok(r.ok);
  assert.equal(seen.filter, 'record_id.in.(LIME-25-13-02-00-000-41),project_code.in.(LIME-25-13-02-00-000-41)');
  assert.deepEqual(r.matches, [
    { source: 'subaybayan_rlip', recordId: 'LIME-25-13-02-00-000-41', title: 'Barangay road', code: 'LIME-25-13-02-00-000-41' },
  ]);
});

test('a source with no separate code shows its record id, and unknown sources are dropped', async () => {
  const rows = [
    { source: 'dpwh_contracts', record_id: '23AB0001', title: 'Road', project_code: null },
    { source: 'something_else', record_id: '23AB0001', title: 'Ignored', project_code: null },
  ];
  const r = await findReportTargets(fakeClient(rows), '23ab0001');
  assert.ok(r.ok);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].code, '23AB0001');
});

test('no match is an empty list, and a database error is thrown', async () => {
  const none = await findReportTargets(fakeClient([]), 'LIME-25-13');
  assert.ok(none.ok && none.matches.length === 0);
  await assert.rejects(findReportTargets(fakeClient([], {}, new Error('boom')), 'LIME-25-13'));
});

test('the code shown for a record comes from its snapshot', () => {
  const t = targetFromRecord('subaybayan_lgsf', 'lgsf-b01-r9', {
    title: 'Hall',
    snapshot: { source: 'subaybayan_lgsf', id: 'lgsf-b01-r9', project_code: 'SBDP-24-01', captured_at: 'x' },
  });
  assert.equal(t.code, 'SBDP-24-01');
  const dpwh = targetFromRecord('dpwh_contracts', '23AB0001', { title: 'Road', snapshot: { contract_id: '23AB0001' } });
  assert.equal(dpwh.code, '23AB0001');
  const noCode = targetFromRecord('subaybayan_rlip', 'rlip-b01-r1', { title: 'X', snapshot: { project_code: null } });
  assert.equal(noCode.code, 'rlip-b01-r1');
});

test('the report link carries the project and nothing else', () => {
  assert.equal(reportHref(null), '/report');
  assert.equal(
    reportHref({ source: 'dpwh_contracts', recordId: '23AB0001', title: 'a&b', code: '23AB0001' }),
    '/report?source=dpwh_contracts&id=23AB0001'
  );
});
