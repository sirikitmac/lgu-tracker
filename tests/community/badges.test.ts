import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_BADGE_STYLES,
  badgeTierOf,
  readableTextColor,
  resolveBadge,
  stylesFromRows,
  validateBadge,
} from '@/lib/badges/badges';

test('roles map to a pill kind; citizens and contractors get none', () => {
  assert.equal(badgeTierOf('super_admin'), 'super_admin');
  assert.equal(badgeTierOf('lgu_admin'), 'admin');
  for (const r of ['planning_officer', 'budget_officer', 'bac_member', 'project_engineer', 'council_member'] as const) {
    assert.equal(badgeTierOf(r), 'employee', r);
  }
  assert.equal(badgeTierOf('citizen'), null);
  assert.equal(badgeTierOf('contractor'), null);
});

test('defaults are purple, red and green', () => {
  assert.equal(DEFAULT_BADGE_STYLES.super_admin.color, '#7C3AED');
  assert.equal(DEFAULT_BADGE_STYLES.admin.color, '#DC2626');
  assert.equal(DEFAULT_BADGE_STYLES.employee.color, '#16A34A');
});

test('styles come from database rows, with defaults for anything missing or malformed', () => {
  const s = stylesFromRows([
    { tier: 'admin', label: ' Boss ', color: '#0ea5e9' },
    { tier: 'employee', label: '', color: '#000000' },
    { tier: 'super_admin', label: 'X', color: 'purple' },
    { tier: 'nope', label: 'Y', color: '#111111' },
    null,
  ]);
  assert.deepEqual(s.admin, { label: 'Boss', color: '#0EA5E9' });
  assert.deepEqual(s.employee, DEFAULT_BADGE_STYLES.employee);
  assert.deepEqual(s.super_admin, DEFAULT_BADGE_STYLES.super_admin);
  assert.deepEqual(stylesFromRows(undefined), DEFAULT_BADGE_STYLES);
});

test('a custom pill replaces the default; half a custom pill does not count; no kind means no pill', () => {
  const styles = DEFAULT_BADGE_STYLES;
  assert.deepEqual(resolveBadge({ tier: 'admin', customLabel: 'Founder', customColor: '#F59E0B' }, styles), { label: 'Founder', color: '#F59E0B' });
  assert.deepEqual(resolveBadge({ tier: 'admin', customLabel: 'Founder', customColor: null }, styles), styles.admin);
  assert.deepEqual(resolveBadge({ tier: 'admin', customLabel: '  ', customColor: '#F59E0B' }, styles), styles.admin);
  assert.deepEqual(resolveBadge({ tier: 'employee' }, styles), styles.employee);
  assert.equal(resolveBadge({ tier: null, customLabel: 'Founder', customColor: '#F59E0B' }, styles), null);
});

test('text colour keeps the pill readable', () => {
  assert.equal(readableTextColor('#7C3AED'), '#FFFFFF');
  assert.equal(readableTextColor('#DC2626'), '#FFFFFF');
  assert.equal(readableTextColor('#111827'), '#FFFFFF');
  assert.equal(readableTextColor('#FDE047'), '#111827');
  assert.equal(readableTextColor('#FFFFFF'), '#111827');
  assert.equal(readableTextColor('not a colour'), '#FFFFFF');
});

test('validateBadge cleans the label and rejects a bad colour or length', () => {
  assert.deepEqual(validateBadge('  Co   Founder ', '#f59e0b'), { ok: true, label: 'Co Founder', color: '#F59E0B' });
  assert.deepEqual(validateBadge('', '#F59E0B'), { ok: false, problem: { field: 'label', message: 'Give the pill a name.' } });
  assert.equal(validateBadge('x'.repeat(25), '#F59E0B').ok, false);
  assert.equal(validateBadge('Ok', 'red').ok, false);
  assert.equal(validateBadge('Ok', '#FFF').ok, false);
  assert.equal(validateBadge(42, '#F59E0B').ok, false);
});
