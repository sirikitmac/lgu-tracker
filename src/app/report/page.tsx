import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LguMark } from '@/components/layout/Navbar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ReportPanel } from '@/components/reports/ReportPanel';
import { isProjectSource } from '@/lib/integrations/bettergov/sources';
import { targetFromRecord } from '@/lib/reports/lookup';
import { loadReportableRecord } from '@/lib/reports/record';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ReportTarget } from '@/types/report';

export const metadata: Metadata = {
  title: 'Report a concern | LGU Tracker',
  robots: { index: false },
};

const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const first = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/**
 * The report form as a page, for people who start from the sign-in window
 * (they type a project code first, sign in, and land here with the project
 * chosen) and for a link such as /report?code=LIME-25-13-02-00-000-41.
 * Reporting from a project's own page uses the dialog there instead.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const source = first(params.source);
  const id = first(params.id);
  const code = first(params.code)?.slice(0, 80);

  let target: ReportTarget | null = null;
  if (source && id && isProjectSource(source) && RECORD_ID.test(id)) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      try {
        const record = await loadReportableRecord(supabase, source, id);
        if (record) target = targetFromRecord(source, id, record);
      } catch (error) {
        console.error('[LGU Tracker] Report page lookup failed:', error);
      }
    }
  }

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
              href="/projects"
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink hover:bg-sunken rounded-lg transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to projects</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 grid place-items-start sm:place-items-center px-3 sm:px-6 py-8 sm:py-14">
        <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-raised shadow-float">
          {/* Remount when the link changes, so a new project or code starts clean. */}
          <ReportPanel key={`${target?.source}|${target?.recordId}|${code}`} target={target} initialCode={target ? undefined : code} />
        </div>
      </main>
    </div>
  );
}
