'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Globe, ShieldCheck, LogOut } from 'lucide-react';
import { useCurrentProfile } from '@/lib/auth/CurrentProfileContext';
import { signOutAction } from '@/lib/actions/auth';

interface DashboardTopbarProps {
  isPublicMode: boolean;
  onToggleMode: (publicMode: boolean) => void;
  onOpenMobileSidebar: () => void;
  activeSectionLabel: string;
}

export function DashboardTopbar({
  isPublicMode,
  onToggleMode,
  onOpenMobileSidebar,
  activeSectionLabel,
}: DashboardTopbarProps) {
  const profile = useCurrentProfile();

  return (
    <header className="sticky top-0 z-30 civic-glass-nav border-b border-line px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Mobile trigger + Breadcrumb trail */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation sidebar"
            className="lg:hidden inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2 rounded-lg text-ink hover:bg-sunken border border-line transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm min-w-0"
          >
            <Link
              href="/"
              className="text-muted hover:text-ink transition-colors whitespace-nowrap hidden sm:inline"
            >
              LGU Tracker
            </Link>
            <span
              className="text-muted hidden sm:inline"
              aria-hidden="true"
            >
              /
            </span>
            <span className="font-semibold text-ink truncate">
              {activeSectionLabel}
            </span>
          </nav>
        </div>

        {/* Right: Mode Switcher + LGU Sign In action */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Desktop/Tablet Segmented Mode Switcher */}
          <div
            role="group"
            aria-label="Workspace View Mode"
            className="hidden md:flex items-center bg-sunken p-1 rounded-lg border border-line"
          >
            <button
              type="button"
              onClick={() => onToggleMode(true)}
              aria-pressed={isPublicMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isPublicMode
                  ? 'bg-surface text-ink border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-accent-ink" />
              <span>Public Transparency</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleMode(false)}
              aria-pressed={!isPublicMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                !isPublicMode
                  ? 'bg-surface text-ink border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>LGU Monitoring View</span>
            </button>
          </div>

          {/* Compact Mode Toggle on Narrow Screens */}
          <button
            type="button"
            onClick={() => onToggleMode(!isPublicMode)}
            title={
              isPublicMode
                ? 'Switch to LGU Monitoring View'
                : 'Switch to Public Transparency Mode'
            }
            className="md:hidden inline-flex items-center gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink bg-sunken hover:bg-line border border-line transition-colors whitespace-nowrap"
          >
            {isPublicMode ? (
              <>
                <Globe className="w-3.5 h-3.5 text-accent-ink" />
                <span>Public</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Staff View</span>
              </>
            )}
          </button>

          {profile ? (
            <form action={signOutAction}>
              <button
                type="submit"
                title={`Signed in as ${profile.fullName}`}
                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold text-ink bg-sunken hover:bg-line border border-line rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center min-h-[38px] px-3.5 py-2 text-xs font-semibold text-on-ink bg-ink hover:bg-ink-soft rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
            >
              Staff Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
