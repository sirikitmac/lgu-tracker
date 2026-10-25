'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Globe, ShieldCheck } from 'lucide-react';

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
  return (
    <header className="sticky top-0 z-30 civic-glass-nav border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Mobile trigger + Breadcrumb trail */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation sidebar"
            className="lg:hidden inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2 rounded-lg text-[#172B4D] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm min-w-0"
          >
            <Link
              href="/"
              className="text-[#64748B] hover:text-[#172B4D] transition-colors whitespace-nowrap hidden sm:inline"
            >
              LGU Tracker
            </Link>
            <span
              className="text-[#64748B] hidden sm:inline"
              aria-hidden="true"
            >
              /
            </span>
            <span className="font-semibold text-[#0F172A] truncate">
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
            className="hidden md:flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]"
          >
            <button
              type="button"
              onClick={() => onToggleMode(true)}
              aria-pressed={isPublicMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isPublicMode
                  ? 'bg-white text-[#172B4D] shadow-2xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Public Transparency</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleMode(false)}
              aria-pressed={!isPublicMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                !isPublicMode
                  ? 'bg-white text-[#172B4D] shadow-2xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
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
            className="md:hidden inline-flex items-center gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#172B4D] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors whitespace-nowrap"
          >
            {isPublicMode ? (
              <>
                <Globe className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Public</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Staff View</span>
              </>
            )}
          </button>

          <Link
            href="/login"
            className="inline-flex items-center justify-center min-h-[38px] px-3.5 py-2 text-xs font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg shadow-2xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            Staff Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}
