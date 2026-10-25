'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  FileSpreadsheet,
  Globe,
  Landmark,
  MapPin,
  LogIn,
  LogOut,
  Home,
  X,
} from 'lucide-react';
import { DashboardSectionId, ProjectCategory } from '@/types/project';
import { PROJECT_CATEGORIES } from '@/data/sampleProjects';
import { useCurrentProfile } from '@/lib/auth/CurrentProfileContext';
import { STAFF_ROLES } from '@/types/auth';
import { signOutAction } from '@/lib/actions/auth';

/** "planning_officer" -> "Planning Officer" */
function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface DashboardSidebarProps {
  activeSection: DashboardSectionId;
  onSelectSection?: (
    section: 'overview' | 'projects' | 'budget' | 'transparency'
  ) => void;
  selectedCategory: ProjectCategory | 'All';
  onSelectCategory: (category: ProjectCategory | 'All') => void;
  isPublicMode: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function DashboardSidebar({
  activeSection,
  onSelectSection,
  selectedCategory,
  onSelectCategory,
  isPublicMode,
  mobileOpen,
  onCloseMobile,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isMapRoute = pathname?.startsWith('/dashboard/map');

  // Role comes only from the server-verified profile (src/lib/auth/authorize.ts
  // via the dashboard layout's context) — never from isPublicMode or any
  // other client-side/UI state, which are display preferences, not auth.
  const profile = useCurrentProfile();
  const isStaff = profile !== null && STAFF_ROLES.includes(profile.role);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const navItems: Array<{
    id: DashboardSectionId;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Signed-in LGU personnel only (STAFF_ROLES); hidden from the public/citizen/contractor view. */
    staffOnly: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Project Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      staffOnly: true,
    },
    {
      id: 'projects',
      label: 'Project Directory',
      href: '/dashboard?section=projects',
      icon: FolderKanban,
      staffOnly: true,
    },
    {
      id: 'map',
      label: 'Map View',
      href: isPublicMode ? '/dashboard/map?mode=public' : '/dashboard/map',
      icon: MapPin,
      staffOnly: false,
    },
    {
      id: 'dpwh',
      label: 'DPWH Nationwide',
      href: '/dashboard/dpwh',
      icon: Landmark,
      staffOnly: false,
    },
    {
      id: 'budget',
      label: 'Budget & Utilization',
      href: '/dashboard?section=budget',
      icon: FileSpreadsheet,
      staffOnly: true,
    },
    {
      id: 'transparency',
      label: 'Public Transparency',
      href: '/dashboard?mode=public',
      icon: Globe,
      staffOnly: false,
    },
  ];

  const visibleNavItems = navItems.filter((item) => !item.staffOnly || isStaff);

  const handleNavClick = (item: (typeof navItems)[number]) => {
    onCloseMobile();

    if (item.id === 'map' || item.id === 'dpwh') {
      router.push(item.href);
      return;
    }

    if (isMapRoute || !onSelectSection) {
      router.push(item.href);
      return;
    }

    onSelectSection(item.id);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#172B4D] text-white w-64 shrink-0 select-none border-r border-[#1e3a66]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div>
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-white hover:text-slate-200 transition-colors block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F59E0B]"
          >
            LGU Tracker
          </Link>
          <p className="text-xs italic text-[#F59E0B] font-medium mt-0.5">
            Bantay Proyekto, Gabay sa Progreso.
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar navigation"
          className="lg:hidden inline-flex items-center justify-center min-w-[40px] min-h-[40px] p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold text-slate-400 tracking-wide mb-2">
            Monitoring Views
          </p>
          <nav aria-label="Dashboard Views" className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                (item.id === 'map' && isMapRoute) ||
                (!isMapRoute && activeSection === item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sector Quick Filters */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-semibold text-slate-400 tracking-wide">
              LGU Sectors
            </p>
            {selectedCategory !== 'All' && (
              <button
                type="button"
                onClick={() => onSelectCategory('All')}
                className="text-xs text-[#F59E0B] hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onSelectCategory('All');
                onCloseMobile();
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors truncate cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
                selectedCategory === 'All'
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              All LGU Sectors
            </button>
            {PROJECT_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    onSelectCategory(category);
                    onCloseMobile();
                  }}
                  title={category}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors truncate cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F59E0B] ${
                    isSelected
                      ? 'bg-white/15 text-[#F59E0B] font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Access Context */}
      <div className="p-4 border-t border-white/10 space-y-2.5 bg-[#12223d]">
        <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs font-semibold text-white truncate">
            {profile ? profile.fullName : isPublicMode ? 'Citizen Transparency Mode' : 'Public Visitor'}
          </p>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug truncate">
            {profile
              ? `Signed in · ${formatRoleLabel(profile.role)}`
              : isPublicMode
              ? 'Read-only public inspection of Iligan City projects.'
              : 'Sign in with an LGU account for staff monitoring views.'}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Landing</span>
          </Link>
          {profile ? (
            <form action={signOutAction} className="flex-1">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-64 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Sidebar"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
