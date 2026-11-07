import { canManageUsers, canReviewReports, isStaffRole } from '@/lib/auth/roles';
import type { AppRole } from '@/types/auth';

export type NavIcon = 'inbox' | 'reports' | 'projects' | 'map' | 'insights' | 'workspace' | 'queue' | 'users' | 'profile';

export interface WorkspaceNavItem {
  id: string;
  label: string;
  href: string;
  icon: NavIcon;
}

export interface WorkspaceNavGroup {
  id: string;
  label: string;
  items: WorkspaceNavItem[];
}

const INBOX: WorkspaceNavItem = { id: 'inbox', label: 'Inbox', href: '/inbox', icon: 'inbox' };
const MY_REPORTS: WorkspaceNavItem = { id: 'my-reports', label: 'My reports', href: '/my-reports', icon: 'reports' };
const WORKSPACE: WorkspaceNavItem = { id: 'workspace', label: 'Monitoring workspace', href: '/dashboard', icon: 'workspace' };
const QUEUE: WorkspaceNavItem = { id: 'queue', label: 'Report queue', href: '/reports', icon: 'queue' };
const PROFILE: WorkspaceNavItem = { id: 'profile', label: 'Profile', href: '/profile', icon: 'profile' };
const USERS: WorkspaceNavItem = { id: 'users', label: 'Users and roles', href: '/users', icon: 'users' };

/**
 * The tabs a signed-in person sees, from their role. This only decides what to
 * show: every page and action checks the role again on the server, and the
 * database enforces it with row-level security.
 */
export function workspaceNav(role: AppRole): WorkspaceNavGroup[] {
  const groups: WorkspaceNavGroup[] = [{ id: 'you', label: 'Your space', items: [INBOX, MY_REPORTS, PROFILE] }];

  const lguWork: WorkspaceNavItem[] = [];
  if (isStaffRole(role)) lguWork.push(WORKSPACE);
  if (canReviewReports(role)) lguWork.push(QUEUE);
  if (lguWork.length > 0) groups.push({ id: 'lgu', label: 'LGU work', items: lguWork });

  if (canManageUsers(role)) groups.push({ id: 'admin', label: 'Administration', items: [USERS] });

  groups.push({
    id: 'explore',
    label: 'Explore',
    items: [
      { id: 'projects', label: 'Projects', href: '/projects', icon: 'projects' },
      { id: 'map', label: 'Map', href: '/projects/map', icon: 'map' },
      { id: 'insights', label: 'Public dashboard', href: '/projects/dashboard', icon: 'insights' },
    ],
  });

  return groups;
}

/** Whether a tab is the current page. Projects does not light up on its map or dashboard. */
export function isActiveNavItem(item: WorkspaceNavItem, pathname: string): boolean {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (item.id === 'projects') {
    return under('/projects') && !under('/projects/map') && !under('/projects/dashboard');
  }
  return under(item.href);
}
