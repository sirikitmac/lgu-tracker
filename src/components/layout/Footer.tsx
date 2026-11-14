import React from 'react';
import Link from 'next/link';
import { LguMark } from './Navbar';

const LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/projects/map', label: 'Dashboard and map' },
  { href: '/dashboard', label: 'LGU monitoring workspace' },
  { href: '/#about', label: 'About the data' },
  { href: '/login', label: 'LGU Sign In' },
];

const linkClass =
  'rounded-sm hover:text-ink hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** A quiet close in the theme's sunken tone: the name, where to go next, and the credits. */
export function Footer() {
  return (
    <footer className="bg-sunken text-ink border-t border-line">
      <div className="site-frame max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-12">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-7 space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
              <LguMark className="w-6 h-6" />
              <span className="text-base font-bold tracking-[-0.02em]">LGU Tracker</span>
            </Link>
            <p className="text-sm text-subtle">Bantay Proyekto, Gabay sa Progreso.</p>
            <p className="text-sm text-muted leading-relaxed max-w-md">Public works records anyone can check, and a monitoring workspace for LGUs.</p>
          </div>

          <nav aria-label="Footer" className="md:col-span-5">
            <h2 className="text-[13px] font-semibold text-ink">Explore</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-subtle">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted">
          <p>© 2026 LGU Tracker · Team BB (BeyondBoard) · CCC181 Final Project</p>
          <Link href="/credits" className={linkClass}>
            Photo &amp; data credits
          </Link>
        </div>
      </div>
    </footer>
  );
}
