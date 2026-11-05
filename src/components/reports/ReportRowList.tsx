import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ReportStatusPill } from '@/components/reports/ReportStatusPill';
import { stampLabel } from '@/lib/notifications/time';
import type { ReportRow } from '@/lib/reports/queries';
import { reportRef } from '@/lib/reports/workflow';
import { reportCategoryLabel } from '@/types/report';

/** A list of reports, one link per row. `base` is where each row goes (/my-reports or /reports). */
export function ReportRowList({ rows, base, names }: { rows: ReportRow[]; base: string; names?: Map<string, string> }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-raise">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`${base}/${row.id}`}
            className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-sunken/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                <span className="font-semibold tabular-nums text-subtle">{reportRef(row.refNo)}</span>
                <span>{row.category ? reportCategoryLabel(row.category) : 'Concern'}</span>
                <time dateTime={row.createdAt}>{stampLabel(row.createdAt)}</time>
                {names && <span>{names.get(row.submittedBy) ?? 'Citizen'}</span>}
              </p>
              <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{row.recordTitle ?? row.title}</p>
            </div>
            <ReportStatusPill status={row.status} />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
