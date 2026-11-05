import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ReportDetails } from '@/components/reports/ReportDetails';
import { ReportStatusPill } from '@/components/reports/ReportStatusPill';
import { ReportTimeline } from '@/components/reports/ReportTimeline';
import { NotAvailable } from '@/components/workspace/PageStates';
import { pageAccess } from '@/lib/auth/page';
import { loadTimeline } from '@/lib/reports/queries';
import { isReportStatus, reportRef } from '@/lib/reports/workflow';
import { UUID_PATTERN } from '@/lib/actions/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Report | LGU Tracker', robots: { index: false } };

export default async function MyReportPage({ params }: PageProps<'/my-reports/[id]'>) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const access = await pageAccess(`/my-reports/${id}`);
  if (access.state !== 'ok') return <NotAvailable />;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <NotAvailable />;
  const { data: report } = await supabase
    .from('reports')
    .select('id, ref_no, title, body, status, report_category, record_source, record_id, record_title, observed_on, location_note, created_at, submitted_by')
    .eq('id', id)
    .eq('submitted_by', access.profile.id)
    .maybeSingle();
  if (!report || !isReportStatus(report.status)) notFound();

  const events = await loadTimeline(supabase, id, { id: access.profile.id, showNames: false });

  return (
    <>
      <Link href="/my-reports" className="mb-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> My reports
      </Link>
      <header className="mb-6">
        <p className="flex items-center gap-3 text-sm text-muted">
          <span className="font-semibold tabular-nums text-subtle">{reportRef(report.ref_no)}</span>
          <ReportStatusPill status={report.status} />
        </p>
        <h1 className="mt-2 max-w-3xl text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">{report.record_title ?? report.title}</h1>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="sent-heading" className="order-2 rounded-3xl border border-line bg-surface p-5 sm:p-6 xl:order-1">
          <h2 id="sent-heading" className="mb-4 text-base font-bold tracking-tight text-ink">What you sent</h2>
          <ReportDetails report={report} />
        </section>
        <section aria-labelledby="trail-heading" className="order-1 rounded-3xl border border-line bg-surface p-5 shadow-raise sm:p-6 xl:order-2 xl:self-start">
          <h2 id="trail-heading" className="mb-5 text-base font-bold tracking-tight text-ink">What happened</h2>
          <ReportTimeline events={events} status={report.status} />
        </section>
      </div>
    </>
  );
}
