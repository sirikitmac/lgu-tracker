import React from 'react';
import Link from 'next/link';
import { LguMark } from './Navbar';

const LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/projects/map', label: 'Project Map' },
  { href: '/projects/dashboard', label: 'Dashboard' },
  { href: '/dashboard', label: 'LGU monitoring workspace' },
  { href: '/login', label: 'LGU Sign In' },
];

/** A quiet close in the theme's sunken tone: the name, where to go next, and the data notice. */
export function Footer() {
  return (
    <footer className="bg-sunken text-ink border-t border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-12">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-5 space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
              <LguMark className="w-6 h-6" />
              <span className="text-base font-bold tracking-[-0.02em]">LGU Tracker</span>
            </Link>
            <p className="text-sm text-subtle">Bantay Proyekto, Gabay sa Progreso.</p>
            <p className="text-sm text-muted leading-relaxed max-w-md">
              A public view of infrastructure projects and an LGU project monitoring system, built for transparent public works tracking.
            </p>
          </div>

          <nav aria-label="Footer" className="md:col-span-3">
            <h2 className="text-[13px] font-semibold text-ink">Explore</h2>
            <ul className="mt-3 space-y-2 text-sm text-subtle">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="rounded-sm hover:text-ink hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-4">
            <h2 className="text-[13px] font-semibold text-ink">Data notice</h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              The public directory, map and dashboard show DPWH contract and FY 2027 NEP records as published by BetterGov.ph, not verified by
              the LGU. The LGU monitoring workspace falls back to labelled sample records when no database is connected.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted">
          <p>© 2026 LGU Tracker · Team BB (BeyondBoard) · CCC181 Final Project</p>
          <p>Data: BetterGov.ph (DPWH Transparency Portal, FY 2027 NEP)</p>
        </div>
      </div>
    </footer>
  );
}
