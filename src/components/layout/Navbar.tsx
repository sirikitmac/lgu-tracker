'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { BpAssistant } from '@/components/bp/BpAssistant';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { signOutAction } from '@/lib/actions/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { STAFF_ROLES, type AppRole } from '@/types/auth';
import { ThemeSegmented, ThemeToggle } from './ThemeToggle';

/**
 * Primary navigation for every public page: the app pages and Community first (each
 * shows when it is open), then two anchors on the home page. Below `lg` the
 * links move into a menu panel; BP and the menu button stay in the bar.
 */

interface NavItem {
  href: string;
  label: string;
  /** Pathname test for the active state; anchors on the home page have none. */
  match?: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/projects',
    label: 'Projects',
    match: (p) => p === '/projects' || (p.startsWith('/projects/') && !p.startsWith('/projects/map') && !p.startsWith('/projects/dashboard')),
  },
  { href: '/projects/map', label: 'Map', match: (p) => p.startsWith('/projects/map') },
  { href: '/projects/dashboard', label: 'Dashboard', match: (p) => p.startsWith('/projects/dashboard') },
  { href: '/community', label: 'Community', match: (p) => p === '/community' || p.startsWith('/community/') },
  { href: '/#coverage', label: 'Coverage' },
  { href: '/#about', label: 'About' },
];

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

type Account = { state: 'out' } | { state: 'in'; staff: boolean };

/**
 * Whether someone is signed in, and whether they are LGU staff, so the bar can
 * offer the workspace to staff and a sign-out to everyone signed in. Only a
 * convenience for what to show: the workspace and every action check the role
 * again on the server. Until it is known, the bar shows "LGU Sign In".
 */
function useAccount(): Account {
  const [userId, setUserId] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => active && setUserId(data.session?.user.id ?? null));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // A separate step, because the auth listener must not wait on a database call.
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      setStaff(false);
      return;
    }
    let active = true;
    client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => active && setStaff(Boolean(data) && STAFF_ROLES.includes(data!.role as AppRole)));
    return () => {
      active = false;
    };
  }, [userId]);

  return userId ? { state: 'in', staff } : { state: 'out' };
}

/** "LGU Sign In" for visitors; the workspace (staff) and Sign out for someone signed in. */
function AccountActions({ account, layout, onNavigate }: { account: Account; layout: 'bar' | 'menu'; onNavigate?: () => void }) {
  const bar = layout === 'bar';
  const pill = bar
    ? `inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${focusRing}`
    : `flex items-center justify-center gap-2 w-full min-h-11 rounded-full text-sm font-semibold transition-colors ${focusRing}`;
  const dark = `${pill} bg-ink text-on-ink hover:bg-ink-soft`;
  const quiet = `${pill} cursor-pointer border border-line-strong bg-surface text-ink hover:bg-sunken`;

  if (account.state === 'out') {
    return (
      <Link href="/login" onClick={onNavigate} className={dark}>
        LGU Sign In
      </Link>
    );
  }
  return (
    <>
      <NotificationBell label={!bar} />
      {account.staff && (
        <Link href="/dashboard" onClick={onNavigate} className={dark}>
          <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Workspace
        </Link>
      )}
      <form action={signOutAction} className={bar ? undefined : 'w-full'}>
        <button type="submit" className={quiet}>
          <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
        </button>
      </form>
    </>
  );
}

/**
 * The product mark: the official Bantay Proyekto app icon (public/brand). It is
 * decorative here because the product name is always written beside it.
 */
export function LguMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <Image
      src="/brand/icon-96.png"
      alt=""
      width={96}
      height={96}
      sizes="36px"
      className={`${className} shrink-0`}
    />
  );
}

export function Navbar() {
  const pathname = usePathname() ?? '/';
  const account = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // A route change closes the menu.
  useEffect(() => setMobileMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const isActive = (item: NavItem) => item.match?.(pathname) ?? false;

  return (
    <header className="sticky top-0 z-40 civic-glass-nav border-b border-line">
      <div className="site-frame max-w-7xl mx-auto flex items-center justify-between gap-4 h-14 px-4 sm:px-6">
        <Link href="/" className={`flex items-center gap-2.5 shrink-0 rounded-lg ${focusRing}`} aria-label="LGU Tracker home">
          <LguMark />
          <BrandWordmark sizes="140px" className="h-auto w-[132px] sm:w-[148px]" />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-center h-8 px-3 rounded-full text-[13.5px] font-medium whitespace-nowrap transition-colors ${focusRing} ${
                      active ? 'bg-sunken text-ink' : 'text-subtle hover:text-ink hover:bg-sunken/70'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <BpAssistant variant="nav" />
          <span className="hidden lg:block">
            <ThemeToggle />
          </span>
          <span className="hidden lg:flex items-center gap-1.5">
            <AccountActions account={account} layout="bar" />
          </span>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-primary-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className={`lg:hidden inline-flex items-center justify-center w-11 h-11 -mr-1.5 rounded-full text-ink hover:bg-sunken transition-colors ${focusRing}`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          ref={panelRef}
          id="mobile-primary-menu"
          className="lg:hidden border-t border-line bg-surface px-4 sm:px-6 pt-3 pb-5 max-h-[calc(100dvh-3.5rem)] overflow-y-auto motion-safe:animate-[bp-in_180ms_var(--ease-out)]"
        >
          <nav aria-label="Primary">
            <ul className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center min-h-11 px-3 rounded-xl text-[15px] font-medium transition-colors ${focusRing} ${
                        active ? 'bg-sunken text-ink' : 'text-subtle hover:bg-sunken hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-4 pt-4 border-t border-line space-y-3">
            <ThemeSegmented />
            <AccountActions account={account} layout="menu" onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
