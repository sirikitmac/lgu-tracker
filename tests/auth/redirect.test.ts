import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeNextPath } from '@/lib/auth/redirect';

test('keeps same-site paths, including query and hash', () => {
  assert.equal(safeNextPath('/projects/23AB0001'), '/projects/23AB0001');
  assert.equal(safeNextPath('/projects?agency=DILG&q=road'), '/projects?agency=DILG&q=road');
  assert.equal(safeNextPath('/projects/source/subaybayan_rlip/abc-123#details'), '/projects/source/subaybayan_rlip/abc-123#details');
});

test('falls back when there is nothing usable', () => {
  assert.equal(safeNextPath(null), '/dashboard');
  assert.equal(safeNextPath(undefined), '/dashboard');
  assert.equal(safeNextPath(''), '/dashboard');
  assert.equal(safeNextPath('', '/projects'), '/projects');
});

test('rejects anything that could leave the site', () => {
  for (const bad of [
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'projects',
    '/projects\n/../x',
    'data:text/html,hi',
    `/${'a'.repeat(3000)}`,
  ]) {
    assert.equal(safeNextPath(bad), '/dashboard', bad);
  }
});

test('does not send people back to the sign-in or sign-up pages', () => {
  assert.equal(safeNextPath('/login'), '/dashboard');
  assert.equal(safeNextPath('/login?next=/projects'), '/dashboard');
  assert.equal(safeNextPath('/register'), '/dashboard');
});
