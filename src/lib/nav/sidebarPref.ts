/**
 * Whether the workspace sidebar is open on a wide screen, remembered in the
 * browser. It starts closed: a missing, unreadable or odd value means closed,
 * and storage that throws (private windows, blocked site data) is ignored.
 */
export const SIDEBAR_PREF_KEY = 'lgu:sidebar-open';

type PrefStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): PrefStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSidebarOpen(storage: PrefStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(SIDEBAR_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarOpen(open: boolean, storage: PrefStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SIDEBAR_PREF_KEY, open ? '1' : '0');
  } catch {
    // Storage is full or blocked; the choice just is not remembered.
  }
}
