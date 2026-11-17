import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SIDEBAR_PREF_KEY, readSidebarOpen, writeSidebarOpen } from '@/lib/nav/sidebarPref';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

test('the sidebar starts closed when nothing is saved', () => {
  assert.equal(readSidebarOpen(memoryStorage()), false);
  assert.equal(readSidebarOpen(null), false);
});

test('the choice round-trips through storage', () => {
  const s = memoryStorage();
  writeSidebarOpen(true, s);
  assert.equal(s.data.get(SIDEBAR_PREF_KEY), '1');
  assert.equal(readSidebarOpen(s), true);
  writeSidebarOpen(false, s);
  assert.equal(readSidebarOpen(s), false);
});

test('odd values read as closed', () => {
  const s = memoryStorage();
  s.data.set(SIDEBAR_PREF_KEY, 'true');
  assert.equal(readSidebarOpen(s), false);
});

test('storage that throws is ignored', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.equal(readSidebarOpen(broken), false);
  assert.doesNotThrow(() => writeSidebarOpen(true, broken));
});
