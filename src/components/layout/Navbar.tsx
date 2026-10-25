'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 civic-glass-nav shadow-2xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-[#172B4D] hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
        >
          LGU Tracker
        </Link>

        {/* Zone 2: concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-5 lg:gap-8 text-sm font-medium text-[#64748B]"
        >
          <a
            href="/#coverage"
            className="py-1 hover:text-[#0F172A] hover:underline underline-offset-8 decoration-[#2563EB] decoration-2 transition-colors whitespace-nowrap shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
          >
            Coverage
          </a>
          <a
            href="/#how-it-works"
            className="py-1 hover:text-[#0F172A] hover:underline underline-offset-8 decoration-[#2563EB] decoration-2 transition-colors whitespace-nowrap shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
          >
            How it works
          </a>
          <Link
            href="/projects"
            className="py-1 hover:text-[#0F172A] hover:underline underline-offset-8 decoration-[#2563EB] decoration-2 transition-colors whitespace-nowrap shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
          >
            Projects
          </Link>
          <Link
            href="/projects/map"
            className="py-1 hover:text-[#0F172A] hover:underline underline-offset-8 decoration-[#2563EB] decoration-2 transition-colors whitespace-nowrap shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
          >
            Project Map
          </Link>
          <Link
            href="/dashboard"
            className="py-1 hover:text-[#0F172A] hover:underline underline-offset-8 decoration-[#2563EB] decoration-2 transition-colors whitespace-nowrap shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
          >
            Dashboard
          </Link>
        </nav>

        {/* Zone 3: 1 primary action (+ mobile menu trigger on small screens) */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg shadow-2xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
          >
            LGU Sign In
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-primary-menu"
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-[#172B4D] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-primary-menu"
          className="md:hidden bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-6 py-4 space-y-3 shadow-lg"
        >
          <nav
            aria-label="Mobile Navigation"
            className="flex flex-col space-y-1 text-sm font-medium text-[#0F172A]"
          >
            <a
              href="/#coverage"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors"
            >
              Coverage
            </a>
            <a
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors"
            >
              How it works
            </a>
            <Link
              href="/projects"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors"
            >
              DPWH Project Directory
            </Link>
            <Link
              href="/projects/map"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors"
            >
              DPWH Project Map
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors"
            >
              Monitoring Dashboard
            </Link>
          </nav>
          <div className="pt-3 border-t border-[#E2E8F0] flex flex-col">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg transition-colors"
            >
              LGU Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
