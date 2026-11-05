import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LoginPanel } from '@/components/auth/LoginPanel';
import { LguMark } from '@/components/layout/Navbar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const metadata: Metadata = {
  title: 'Sign in | LGU Tracker',
};

/**
 * The full-page sign-in. Moving around the site opens sign-in as a window over
 * the current page instead (src/app/@modal/(.)login); this page is what a
 * direct visit, a refresh or a redirect from a protected page lands on.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-ground civic-subtle-grid text-ink">
      <header className="sticky top-0 z-30 civic-glass-nav border-b border-line px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink hover:text-accent-ink transition-colors whitespace-nowrap rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink"
          >
            <LguMark className="w-6 h-6" />
            LGU Tracker
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:bg-sunken rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Home</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-3 sm:px-6 py-8 sm:py-14">
        <div className="w-full max-w-[50rem] overflow-hidden rounded-3xl border border-line bg-surface shadow-float">
          <LoginPanel />
        </div>
      </main>

      <footer className="py-5 px-4 sm:px-6 border-t border-line bg-surface text-center text-xs text-muted">
        LGU Tracker —{' '}
        <span className="text-ink font-medium">Bantay Proyekto, Gabay sa Progreso.</span> · CCC181 Final
        Project by Team BB (BeyondBoard)
      </footer>
    </div>
  );
}
