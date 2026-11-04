import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRecordReport } from '@/lib/reports/validate';

const NOW = new Date('2026-11-04T12:00:00Z');
const good = {
  source: 'dpwh_contracts',
  recordId: '23AB0001',
  category: 'delayed_or_stalled',
  details: 'The site has been empty for two months and no workers come.',
};

test('accepts a complete report and trims it', () => {
  const r = validateRecordReport({ ...good, details: `  ${good.details}  `, locationNote: '  Near the chapel ' }, NOW);
  assert.ok(r.ok);
  assert.equal(r.value.details, good.details);
  assert.equal(r.value.locationNote, 'Near the chapel');
  assert.equal(r.value.observedOn, null);
});

test('accepts every directory source and rejects unknown ones', () => {
  for (const source of ['dpwh_contracts', 'dpwh_nep_2027', 'subaybayan_lgsf', 'subaybayan_rlip']) {
    const recordId = source === 'dpwh_contracts' ? '23AB0001' : 'rlip-b01.r9';
    assert.ok(validateRecordReport({ ...good, source, recordId }, NOW).ok, source);
  }
  assert.equal(validateRecordReport({ ...good, source: 'projects' }, NOW).ok, false);
  assert.equal(validateRecordReport({ ...good, source: undefined }, NOW).ok, false);
});

test('rejects record ids that are not valid for their source', () => {
  for (const recordId of ['', 'a', "x'; drop table reports;--", '../etc/passwd', 'a'.repeat(200), 123 as unknown as string]) {
    assert.equal(validateRecordReport({ ...good, recordId }, NOW).ok, false, String(recordId));
  }
  // DPWH contract ids do not allow dots or underscores; other sources do.
  assert.equal(validateRecordReport({ ...good, recordId: 'ab.cd_ef' }, NOW).ok, false);
  assert.ok(validateRecordReport({ ...good, source: 'subaybayan_lgsf', recordId: 'ab.cd_ef' }, NOW).ok);
});

test('requires a known category', () => {
  for (const category of [undefined, '', 'spam', 5]) {
    const r = validateRecordReport({ ...good, category }, NOW);
    assert.ok(!r.ok);
    assert.equal(r.field, 'category');
  }
});

test('details must be 20 to 5000 characters after trimming', () => {
  assert.equal(validateRecordReport({ ...good, details: 'too short' }, NOW).ok, false);
  assert.equal(validateRecordReport({ ...good, details: ' '.repeat(40) }, NOW).ok, false);
  assert.ok(validateRecordReport({ ...good, details: 'x'.repeat(20) }, NOW).ok);
  assert.ok(validateRecordReport({ ...good, details: 'x'.repeat(5000) }, NOW).ok);
  const r = validateRecordReport({ ...good, details: 'x'.repeat(5001) }, NOW);
  assert.ok(!r.ok);
  assert.equal(r.field, 'details');
});

test('removes NUL characters, which Postgres cannot store', () => {
  const r = validateRecordReport({ ...good, details: `${good.details}\u0000\u0000` }, NOW);
  assert.ok(r.ok);
  assert.equal(r.value.details.includes('\u0000'), false);
});

test('observation date: optional, real, not in the future', () => {
  assert.ok(validateRecordReport({ ...good, observedOn: '' }, NOW).ok);
  const ok = validateRecordReport({ ...good, observedOn: '2026-10-30' }, NOW);
  assert.ok(ok.ok);
  assert.equal(ok.value.observedOn, '2026-10-30');
  assert.ok(validateRecordReport({ ...good, observedOn: '2026-11-05' }, NOW).ok, 'one day of timezone slack');
  for (const observedOn of ['2026-11-07', '2026-02-30', '11/03/2026', 'yesterday', '1980-01-01']) {
    const r = validateRecordReport({ ...good, observedOn }, NOW);
    assert.ok(!r.ok, observedOn);
    assert.equal(r.field, 'observedOn');
  }
});

test('location note is capped at 300 characters', () => {
  assert.ok(validateRecordReport({ ...good, locationNote: 'x'.repeat(300) }, NOW).ok);
  const r = validateRecordReport({ ...good, locationNote: 'x'.repeat(301) }, NOW);
  assert.ok(!r.ok);
  assert.equal(r.field, 'locationNote');
});
