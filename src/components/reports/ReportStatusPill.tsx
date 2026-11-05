import React from 'react';
import { REPORT_STATUS_LABEL, type ReportStatus } from '@/lib/reports/workflow';

const STYLE: Record<ReportStatus, { pill: string; dot: string }> = {
  submitted: { pill: 'bg-sunken text-subtle', dot: 'bg-muted' },
  acknowledged: { pill: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200', dot: 'bg-sky-600 dark:bg-sky-400' },
  in_review: { pill: 'bg-accent-soft text-accent-ink', dot: 'bg-accent' },
  resolved: { pill: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200', dot: 'bg-emerald-600 dark:bg-emerald-400' },
  dismissed: { pill: 'border border-line-strong bg-surface text-muted', dot: 'bg-line-strong' },
};

/** Where a report stands, as one small label. Colour is never the only signal: the word is always there. */
export function ReportStatusPill({ status, className = '' }: { status: ReportStatus; className?: string }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${s.pill} ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}
