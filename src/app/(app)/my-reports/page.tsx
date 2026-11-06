import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { ReportRowList } from '@/components/reports/ReportRowList';
import { EmptyState } from '@/components/ui/StateViews';
import { PageHeader } from '@/components/workspace/PageHeader';
import { NotAvailable } from '@/components/workspace/PageStates';
import { pageAccess } from '@/lib/auth/page';
import { REPORT_LIST_COLUMNS, toReportRow, type ReportRow } from '@/lib/reports/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My reports | LGU Tracker', robots: { index: false } };

export default async function MyReportsPage() {
  const access = await pageAccess('/my-reports');
  if (access.state !== 'ok') return <NotAvailable />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase
        .from('reports')
        .select(REPORT_LIST_COLUMNS)
        .eq('submitted_by', access.profile.id)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: null, error: new Error('not configured') };

  const rows = (data ?? []).map(toReportRow).filter((row): row is ReportRow => row !== null);

  return (
    <>
      <PageHeader
        title="My reports"
        description="Concerns you sent about projects. Only you and LGU staff can see them."
        actions={
          <Link
            href="/projects"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-ink transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
          >
            Find a project to report
          </Link>
        }
      />
      {error ? (
        <NotAvailable title="Your reports did not load" description="Refresh the page. If it keeps happening, try again in a few minutes." />
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface">
          <EmptyState
            icon={ClipboardList}
            suri="checker"
            title="You have not sent a report yet"
            description="Open any project and choose Report a concern. You can follow what happens to it here."
          />
        </div>
      ) : (
        <ReportRowList rows={rows} base="/my-reports" />
      )}
    </>
  );
}
