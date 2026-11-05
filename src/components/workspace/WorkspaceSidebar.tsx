'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_BLURB, ROLE_LABEL } from '@/lib/auth/roles';
import { isActiveNavItem, workspaceNav, type NavIcon, type WorkspaceNavItem } from '@/lib/nav/workspaceNav';
import { useUnreadCount } from '@/lib/notifications/unread';
import type { AppRole } from '@/types/auth';

const ICONS: Record<NavIcon, LucideIcon> = {
  inbox: Inbox,
  reports: ClipboardList,
  projects: FolderKanban,
  map: MapIcon,
  insights: BarChart3,
  workspace: LayoutDashboard,
  queue: ClipboardCheck,
  users: UsersRound,
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden="true" className="ml-auto grid min-w-[20px] place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-night">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * The tabs for the signed-in person's role. On a wide screen it is a rail on
 * the left; on a phone the same tabs become one row that scrolls sideways
 * under the top bar.
 */
export function WorkspaceSidebar({ role, name }: { role: AppRole; name: string }) {
  const pathname = usePathname() ?? '/';
  const unread = useUnreadCount();
  const groups = workspaceNav(role);
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  const label = (item: WorkspaceNavItem) =>
    item.id === 'inbox' && unread > 0 ? `${item.label}, ${unread} unread` : item.label;

  return (
    <aside className="lg:sticky lg:top-[4.5rem] lg:self-start">
      {/* Phones and tablets: one scrolling row. */}
      <nav aria-label="Your tabs" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden">
        <ul className="flex w-max gap-1.5">
          {groups.flatMap((group) => group.items).map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActiveNavItem(item, pathname);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label(item)}
                  className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-medium transition-colors ${focusRing} ${
                    active
                      ? 'border-ink bg-ink text-on-ink'
                      : 'border-line-strong bg-surface text-subtle hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  {item.id === 'inbox' && unread > 0 && (
                    <span aria-hidden="true" className="grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-[18px] text-night">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Wide screens: the rail. */}
      <div className="hidden lg:block">
        <nav aria-label="Your tabs" className="space-y-5">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="px-3 pb-1.5 text-xs font-semibold text-muted">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isActiveNavItem(item, pathname);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label(item)}
                        className={`relative flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors ${focusRing} ${
                          active ? 'bg-surface text-ink shadow-raise ring-1 ring-line' : 'text-subtle hover:bg-sunken hover:text-ink'
                        }`}
                      >
                        {active && <span aria-hidden="true" className="absolute left-0 top-2.5 h-5 w-[3px] rounded-full bg-accent" />}
                        <Icon className={`h-[18px] w-[18px] ${active ? 'text-accent-ink' : ''}`} aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                        {item.id === 'inbox' && <Badge count={unread} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-night">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{name || 'Your account'}</p>
            <p className="text-[13px] font-medium text-accent-ink">{ROLE_LABEL[role]}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{ROLE_BLURB[role]}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
