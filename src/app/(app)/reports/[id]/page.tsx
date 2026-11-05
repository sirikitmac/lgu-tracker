import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ReportDetails } from '@/components/reports/ReportDetails';
import { ReportPhotos } from '@/components/reports/ReportPhotos';
import { ReportStatusPill } from '@/components/reports/ReportStatusPill';
import { ReportTimeline } from '@/components/reports/ReportTimeline';
import { ReviewPanel } from '@/components/reports/ReviewPanel';
import { NoAccess, NotAvailable } from '@/components/workspace/PageStates';
import { UUID_PATTERN } from '@/lib/actions/shared';
import { pageAccess } from '@/lib/auth/page';
import { REPORT_HANDLER_ROLES } from '@/lib/auth/roles';
import { loadNames, loadReportPhotos, loadTimeline } from '@/lib/reports/queries';
import { isReportStatus, reportRef } from '@/lib/reports/workflow';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Report | LGU Tracker', robots: { index: false } };

export default async function ReportReviewPage({ params }: PageProps<'/reports/[id]'>) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const access = await pageAccess(`/reports/${id}`, REPORT_HANDLER_ROLES);
  if (access.state === 'unavailable') return <NotAvailable />;
  if (access.state === 'forbidden') return <NoAccess what="The report queue" />;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <NotAvailable />;
  const { data: report } = await supabase
    .from('reports')
    .select('id, ref_no, title, body, status, report_category, record_source, record_id, record_title, record_snapshot, observed_on, location_note, created_at, submitted_by')
    .eq('id', id)
    .maybeSingle();
  if (!report || !isReportStatus(report.status)) notFound();

  const [events, names, photos] = await Promise.all([
    loadTimeline(supabase, id, { id: access.profile.id, showNames: true }),
    loadNames(supabase, [report.submitted_by as string]),
    loadReportPhotos(supabase, id),
  ]);
  const sender = names.get(report.submitted_by as string) ?? 'A citizen';
  const snapshot = Object.entries((report.record_snapshot ?? {}) as Record<string, unknown>).filter(
    ([key, value]) => key !== 'captured_at' && key !== 'source' && value !== null && value !== ''
  );

  return (
    <>
      <Link href="/reports" className="mb-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Report queue
      </Link>
      <header className="mb-6">
        <p className="flex items-center gap-3 text-sm text-muted">
          <span className="font-semibold tabular-nums text-subtle">{reportRef(report.ref_no)}</span>
          <ReportStatusPill status={report.status} />
          <span>from {sender}</span>
        </p>
        <h1 className="mt-2 max-w-3xl text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">{report.record_title ?? report.title}</h1>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section aria-labelledby="sent-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="sent-heading" className="mb-4 text-base font-bold tracking-tight text-ink">What was reported</h2>
            <ReportDetails report={report} />
            <ReportPhotos photos={photos} />
          </section>

          {snapshot.length > 0 && (
            <section aria-labelledby="snap-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <h2 id="snap-heading" className="text-base font-bold tracking-tight text-ink">The project when it was reported</h2>
              <p className="mb-4 mt-1 text-[13px] text-muted">
                Copied at the moment of the report, because the directory is updated over time.
              </p>
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                {snapshot.map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt className="text-muted">{key.replace(/_/g, ' ')}</dt>
                    <dd className="min-w-0 break-words text-ink">{String(value)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="trail-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="trail-heading" className="mb-5 text-base font-bold tracking-tight text-ink">Timeline</h2>
            <ReportTimeline events={events} status={report.status} />
          </section>
        </div>

        <div className="xl:sticky xl:top-[4.5rem] xl:self-start">
          <ReviewPanel reportId={report.id as string} status={report.status} />
        </div>
      </div>
    </>
  );
}
