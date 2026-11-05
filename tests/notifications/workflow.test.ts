import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isReportStatus, recordHref, reportRef } from '@/lib/reports/workflow';

test('report numbers are padded and never throw', () => {
  assert.equal(reportRef(42), 'RPT-00042');
  assert.equal(reportRef('7'), 'RPT-00007');
  assert.equal(reportRef(123456), 'RPT-123456');
  assert.equal(reportRef(null), 'RPT-?');
  assert.equal(reportRef('abc'), 'RPT-?');
});

test('a record links to its page in the app', () => {
  assert.equal(recordHref('dpwh_contracts', '23AB 0001'), '/projects/23AB%200001');
  assert.equal(recordHref('subaybayan_lgsf', 'X/1'), '/projects/source/subaybayan_lgsf/X%2F1');
  assert.equal(recordHref(null, 'x'), null);
});

test('only real statuses are accepted', () => {
  assert.ok(isReportStatus('in_review'));
  assert.ok(!isReportStatus('approved'));
  assert.ok(!isReportStatus(undefined));
});

import { dayLabel, dayOf } from '@/lib/notifications/time';

test('days are grouped in Philippine time', () => {
  const now = new Date('2026-11-05T09:00:00Z'); // 5:00 PM Nov 5 in Manila
  assert.equal(dayLabel('2026-11-05T01:00:00Z', now), 'Today');
  assert.equal(dayLabel('2026-11-04T17:00:00Z', now), 'Today'); // 1:00 AM Nov 5 in Manila
  assert.equal(dayLabel('2026-11-04T10:00:00Z', now), 'Yesterday');
  assert.match(dayLabel('2026-10-20T10:00:00Z', now), /Oct 20/);
  assert.match(dayLabel('2025-10-20T10:00:00Z', now), /2025/);
  assert.equal(dayOf('2026-11-04T17:00:00Z'), '2026-11-05');
});
