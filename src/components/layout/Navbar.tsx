'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { BpAssistant } from '@/components/bp/BpAssistant';
import { ThemeSegmented, ThemeToggle } from './ThemeToggle';

/**
 * Primary navigation for every public page: the three app pages first (each
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
  { href: '/#coverage', label: 'Coverage' },
  { href: '/#about', label: 'About' },
];

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** The product mark: a site pin in signal orange, as on DPWH work-zone signs. */
export function LguMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="var(--color-accent)" />
      <path d="M14 6.5a5.5 5.5 0 0 0-5.5 5.5c0 4.1 5.5 9.5 5.5 9.5s5.5-5.4 5.5-9.5A5.5 5.5 0 0 0 14 6.5Z" fill="#050F16" />
      <circle cx="14" cy="12" r="2.1" fill="var(--color-accent)" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname() ?? '/';
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
          <span className="text-[17px] font-bold tracking-[-0.02em] text-ink whitespace-nowrap">LGU Tracker</span>
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
          <Link
            href="/login"
            className={`hidden lg:inline-flex items-center h-9 px-4 rounded-full bg-ink text-on-ink text-[13px] font-semibold whitespace-nowrap hover:bg-ink-soft transition-colors ${focusRing}`}
          >
            LGU Sign In
          </Link>
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
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-center w-full min-h-11 rounded-full bg-ink text-on-ink text-sm font-semibold hover:bg-ink-soft transition-colors ${focusRing}`}
            >
              LGU Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
