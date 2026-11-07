import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignableRoles, canChangeRoleOf, canReviewReports } from '@/lib/auth/roles';
import { isActiveNavItem, workspaceNav } from '@/lib/nav/workspaceNav';
import type { AppRole } from '@/types/auth';

const ids = (role: AppRole) => workspaceNav(role).flatMap((g) => g.items.map((i) => i.id));

test('everyone signed in gets an inbox and their own reports', () => {
  for (const role of ['citizen', 'contractor', 'budget_officer', 'super_admin'] as AppRole[]) {
    assert.ok(ids(role).includes('inbox'), role);
    assert.ok(ids(role).includes('my-reports'), role);
  }
});

test('citizens and contractors see no LGU or admin tabs', () => {
  for (const role of ['citizen', 'contractor'] as AppRole[]) {
    assert.deepEqual(ids(role), ['inbox', 'my-reports', 'profile', 'projects', 'map', 'insights']);
  }
});

test('report handlers see the queue; other staff only the workspace', () => {
  for (const role of ['planning_officer', 'project_engineer', 'lgu_admin', 'super_admin'] as AppRole[]) {
    assert.ok(ids(role).includes('queue'), role);
  }
  for (const role of ['budget_officer', 'bac_member', 'council_member'] as AppRole[]) {
    assert.ok(ids(role).includes('workspace'), role);
    assert.ok(!ids(role).includes('queue'), role);
    assert.equal(canReviewReports(role), false);
  }
});

test('only administrators see users and roles', () => {
  for (const role of ['lgu_admin', 'super_admin'] as AppRole[]) assert.ok(ids(role).includes('users'));
  for (const role of ['planning_officer', 'citizen'] as AppRole[]) assert.ok(!ids(role).includes('users'));
});

test('an LGU administrator cannot hand out administrator roles; a super administrator can', () => {
  assert.ok(!assignableRoles('lgu_admin').includes('lgu_admin'));
  assert.ok(!assignableRoles('lgu_admin').includes('super_admin'));
  assert.ok(assignableRoles('lgu_admin').includes('planning_officer'));
  assert.ok(assignableRoles('super_admin').includes('lgu_admin'));
  assert.deepEqual(assignableRoles('planning_officer'), []);
  assert.equal(canChangeRoleOf('lgu_admin', 'lgu_admin'), false);
  assert.equal(canChangeRoleOf('super_admin', 'lgu_admin'), true);
  assert.equal(canChangeRoleOf('planning_officer', 'citizen'), false);
});

test('the current tab is the one whose path you are on', () => {
  const all = workspaceNav('super_admin').flatMap((g) => g.items);
  const active = (path: string) => all.filter((i) => isActiveNavItem(i, path)).map((i) => i.id);
  assert.deepEqual(active('/inbox'), ['inbox']);
  assert.deepEqual(active('/my-reports/abc'), ['my-reports']);
  assert.deepEqual(active('/reports/abc'), ['queue']);
  assert.deepEqual(active('/projects'), ['projects']);
  assert.deepEqual(active('/projects/23AB0001'), ['projects']);
  assert.deepEqual(active('/projects/map'), ['map']);
  assert.deepEqual(active('/projects/dashboard'), ['insights']);
  assert.deepEqual(active('/dashboard'), ['workspace']);
});

test('everyone signed in gets a Profile tab, and it lights up on its own page', () => {
  for (const role of ['citizen', 'contractor', 'planning_officer', 'lgu_admin', 'super_admin'] as const) {
    assert.ok(ids(role).includes('profile'), role);
  }
  const all = workspaceNav('citizen').flatMap((g) => g.items);
  assert.deepEqual(all.filter((i) => isActiveNavItem(i, '/profile')).map((i) => i.id), ['profile']);
});
