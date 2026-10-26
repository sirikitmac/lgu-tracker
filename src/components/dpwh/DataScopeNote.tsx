import React from 'react';
import { ChevronDown, Info } from 'lucide-react';
import type { DpwhSummary } from '@/types/dpwh';
import { PROJECT_SOURCES } from '@/lib/integrations/bettergov/sources';
import { formatCount, formatDate } from './format';

/**
 * The data disclosures every public data screen must keep (sources,
 * coverage, import completeness, freshness, not verified by the LGU), as one
 * line that opens into the detail. Native <details>, so it works without
 * script and from the keyboard.
 */
export function DataScopeNote({ summary, className = '' }: { summary: DpwhSummary | null; className?: string }) {
  const imported = summary?.stats.total_contracts;
  const complete = !!summary?.source_snapshot_at;
  return (
    <details className={`group rounded-card bg-sunken text-[13px] leading-relaxed text-ink ${className}`}>
      <summary className="flex items-center gap-2.5 min-h-11 px-4 py-2.5 cursor-pointer list-none rounded-card [&::-webkit-details-marker]:hidden hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
        <Info className="w-4 h-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">About this data.</span>{' '}
          <span className="text-subtle">
            Published by BetterGov.ph; values are as reported and not verified by the LGU.
            {summary && !complete && ' The contract import is incomplete.'}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-4 pt-1 sm:pl-[2.625rem] grid gap-x-8 gap-y-3 sm:grid-cols-2 text-subtle">
        <div>
          <p className="font-semibold text-ink">{PROJECT_SOURCES.dpwh_contracts.label}</p>
          <p>
            DPWH Transparency Portal contracts with Visayas and Mindanao project locations, from BetterGov.ph&apos;s snapshot (CC0).{' '}
            {summary
              ? complete
                ? `Snapshot of ${formatDate(summary.source_snapshot_at)}.`
                : `The import has not completed: ${formatCount(imported ?? 0)} contracts imported so far, not the full snapshot.`
              : 'Import status unavailable.'}{' '}
            Location comes from the contract components DPWH reports, not the implementing office.
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">FY 2027 NEP proposals</p>
          <p>
            DPWH projects proposed in the FY 2027 National Expenditure Program (nationwide). These are budget items, not contracts: they
            are never added to contract totals, and the source gives them no coordinates, so they do not appear on the map.
          </p>
        </div>
        {summary && (
          <p className="sm:col-span-2 text-xs text-muted">
            Figures computed {formatDate(summary.computed_at)}. Last completed sync:{' '}
            {summary.last_successful_sync_at ? formatDate(summary.last_successful_sync_at) : 'none yet'}.
          </p>
        )}
      </div>
    </details>
  );
}
