'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { ROLE_BLURB, ROLE_LABEL } from '@/lib/auth/roles';
import { readSidebarOpen, writeSidebarOpen } from '@/lib/nav/sidebarPref';
import { isActiveNavItem, workspaceNav, type NavIcon, type WorkspaceNavGroup, type WorkspaceNavItem } from '@/lib/nav/workspaceNav';
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
  profile: UserRound,
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

interface Person {
  role: AppRole;
  name: string;
  /** The job title the person gave themselves. */
  title?: string | null;
  avatarPath?: string | null;
  avatarPreset?: string | null;
}

/** The signed-in person's card, linking to /profile. Sits at the top of the sidebar. */
function ProfileCard({ person, onNavigate }: { person: Person; onNavigate?: () => void }) {
  const { role, name, title, avatarPath, avatarPreset } = person;
  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      aria-label={`${name || 'Your account'}, ${ROLE_LABEL[role]}. Edit your profile`}
      className={`group flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-sunken ${focusRing}`}
    >
      <UserAvatar name={name} avatarPath={avatarPath} avatarPreset={avatarPreset} size={40} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{name || 'Your account'}</p>
        {title && <p className="truncate text-[13px] text-subtle">{title}</p>}
        <p className="text-[13px] font-medium text-accent-ink">{ROLE_LABEL[role]}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{ROLE_BLURB[role]}</p>
        <p className="mt-2 text-xs font-semibold text-ink underline-offset-2 group-hover:underline">Edit profile</p>
      </div>
    </Link>
  );
}

/** Every tab, grouped, with labels. Used by the open rail and the phone drawer. */
function NavGroups({
  groups,
  pathname,
  unread,
  label,
  onNavigate,
}: {
  groups: WorkspaceNavGroup[];
  pathname: string;
  unread: number;
  label: (item: WorkspaceNavItem) => string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-5">
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
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    aria-label={label(item)}
                    className={`relative flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors ${focusRing} ${
                      active ? 'bg-surface text-ink shadow-raise ring-1 ring-line' : 'text-subtle hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    {active && <span aria-hidden="true" className="absolute left-0 top-2.5 h-5 w-[3px] rounded-full bg-accent" />}
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-accent-ink' : ''}`} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    {item.id === 'inbox' && <Badge count={unread} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * The tabs for the signed-in person's role, with their profile card on top.
 *
 * Wide screens: a rail on the left that starts closed (icons only, so no tab is
 * ever out of reach) and opens to the full list. The choice is remembered in
 * the browser. The parent grid sizes its first column to this rail, so the page
 * gets the extra width when it is closed.
 *
 * Phones and tablets: a "Menu" button that opens the same card and tabs in a
 * drawer over the page. Esc, the close button, the backdrop or picking a tab
 * closes it.
 */
export function WorkspaceSidebar(person: Person) {
  const { role, name, avatarPath, avatarPreset } = person;
  const pathname = usePathname() ?? '/';
  const unread = useUnreadCount();
  const groups = workspaceNav(role);
  const railId = useId();
  const drawerId = useId();

  // Closed on the server and on the first paint; the saved choice is applied
  // after mount, so the rail can never flash open for someone who closed it.
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (readSidebarOpen()) setOpen(true);
  }, []);

  const toggleRail = () => {
    setOpen((was) => {
      writeSidebarOpen(!was);
      return !was;
    });
  };

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false);
    if (restoreFocus) menuButton.current?.focus();
  }, []);

  // A new page closes the drawer.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // While the drawer is open: focus its close button, Esc closes it, and the
  // page behind it does not scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen, closeDrawer]);

  // A phone-sized drawer left open is closed if the window grows to the rail.
  useEffect(() => {
    if (!drawerOpen) return;
    const wide = window.matchMedia('(min-width: 1024px)');
    const onChange = () => wide.matches && setDrawerOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, [drawerOpen]);

  const label = (item: WorkspaceNavItem) =>
    item.id === 'inbox' && unread > 0 ? `${item.label}, ${unread} unread` : item.label;

  const current = groups.flatMap((g) => g.items).find((item) => isActiveNavItem(item, pathname));

  return (
    <aside className={`lg:sticky lg:top-[4.5rem] lg:self-start ${open ? 'lg:w-[15.5rem]' : 'lg:w-12'}`}>
      {/* Phones and tablets: a menu button that opens the drawer. */}
      <div className="lg:hidden">
        <button
          ref={menuButton}
          type="button"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          onClick={() => setDrawerOpen(true)}
          className={`inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface pl-1 pr-3.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-sunken ${focusRing}`}
        >
          <UserAvatar name={name} avatarPath={avatarPath} avatarPreset={avatarPreset} size={32} />
          <Menu className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <span className="truncate">
            Menu{current ? <span className="text-subtle"> · {current.label}</span> : null}
          </span>
          {unread > 0 && (
            <span className="grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-[18px] text-night">
              <span className="sr-only">, </span>
              {unread > 99 ? '99+' : unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </button>

        <div id={drawerId} hidden={!drawerOpen} className="fixed inset-0 z-50">
          <div aria-hidden="true" onClick={() => closeDrawer()} className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your tabs"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto border-r border-line bg-ground p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Your tabs</p>
              <button
                ref={closeButton}
                type="button"
                onClick={() => closeDrawer()}
                aria-label="Close menu"
                className={`grid h-10 w-10 place-items-center rounded-full text-subtle hover:bg-sunken hover:text-ink ${focusRing}`}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <ProfileCard person={person} onNavigate={() => closeDrawer(false)} />
            <nav aria-label="Your tabs" className="mt-5">
              <NavGroups groups={groups} pathname={pathname} unread={unread} label={label} onNavigate={() => closeDrawer(false)} />
            </nav>
          </div>
        </div>
      </div>

      {/* Wide screens: the rail. */}
      <div className="hidden lg:block">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={railId}
          onClick={toggleRail}
          title={open ? 'Hide sidebar' : 'Show sidebar'}
          className={`mb-3 inline-flex h-10 items-center gap-2 rounded-xl text-sm font-medium text-subtle transition-colors hover:bg-sunken hover:text-ink ${
            open ? 'px-3' : 'w-12 justify-center'
          } ${focusRing}`}
        >
          {open ? (
            <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
          <span className={open ? '' : 'sr-only'}>{open ? 'Hide sidebar' : 'Show sidebar'}</span>
        </button>

        <div id={railId}>
          {open ? (
            <>
              <ProfileCard person={person} />
              <nav aria-label="Your tabs" className="mt-5">
                <NavGroups groups={groups} pathname={pathname} unread={unread} label={label} />
              </nav>
            </>
          ) : (
            <>
              <Link
                href="/profile"
                title={`${name || 'Your account'}: edit profile`}
                aria-label={`${name || 'Your account'}, ${ROLE_LABEL[role]}. Edit your profile`}
                className={`grid h-12 w-12 place-items-center rounded-xl hover:bg-sunken ${focusRing}`}
              >
                <UserAvatar name={name} avatarPath={avatarPath} avatarPreset={avatarPreset} size={36} />
              </Link>
              <nav aria-label="Your tabs" className="mt-3">
                <ul className="space-y-1">
                  {groups.flatMap((group, gi) =>
                    group.items.map((item, ii) => {
                      const Icon = ICONS[item.icon];
                      const active = isActiveNavItem(item, pathname);
                      return (
                        <li key={item.id} className={gi > 0 && ii === 0 ? 'mt-2 border-t border-line pt-2' : ''}>
                          <Link
                            href={item.href}
                            title={item.label}
                            aria-current={active ? 'page' : undefined}
                            aria-label={label(item)}
                            className={`relative grid h-10 w-12 place-items-center rounded-xl transition-colors ${focusRing} ${
                              active ? 'bg-surface text-accent-ink shadow-raise ring-1 ring-line' : 'text-subtle hover:bg-sunken hover:text-ink'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                            {item.id === 'inbox' && unread > 0 && (
                              <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
                            )}
                          </Link>
                        </li>
                      );
                    }),
                  )}
                </ul>
              </nav>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
