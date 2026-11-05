import React from 'react';
import Link from 'next/link';
import { stampLabel } from '@/lib/notifications/time';
import { recordHref } from '@/lib/reports/workflow';
import { isReportCategory, reportCategoryLabel } from '@/types/report';

interface DetailsReport {
  body: string;
  report_category: unknown;
  record_source: string | null;
  record_id: string | null;
  record_title: string | null;
  observed_on: string | null;
  location_note: string | null;
  created_at: string;
}

/** The facts of a report: what kind, which project, what was said. Plain text only, never HTML. */
export function ReportDetails({ report }: { report: DetailsReport }) {
  const href = recordHref(report.record_source, report.record_id);
  const rows: Array<[string, React.ReactNode]> = [
    ['Kind', isReportCategory(report.report_category) ? reportCategoryLabel(report.report_category) : 'Concern'],
    [
      'Project',
      href ? (
        <Link href={href} className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          {report.record_title ?? report.record_id}
        </Link>
      ) : (
        (report.record_title ?? 'Not linked to a project')
      ),
    ],
    ['Project code', report.record_id ? <span className="font-mono text-[13px]">{report.record_id}</span> : '—'],
    ['Seen on', report.observed_on ?? 'Not given'],
    ['Where', report.location_note ?? 'Not given'],
    ['Sent', stampLabel(report.created_at)],
  ];
  return (
    <div>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 break-words text-ink">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="mb-1.5 mt-6 text-sm text-muted">Details</p>
      <p className="max-w-prose whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{report.body}</p>
    </div>
  );
}
