'use client';

import React from 'react';
import { History, Info } from 'lucide-react';
import type { DpwhSummary } from '@/types/dpwh';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatDate } from './format';

/**
 * How current the figures on a public data screen are, from the cached
 * summary row only (never the clock): the date of the BetterGov.ph snapshot
 * the data comes from, or, while an import is unfinished, the date the
 * totals were last computed. The hint spells out what each date means.
 * DataScopeNote keeps the full disclosure.
 */
export function DataFreshness({ summary, className = '' }: { summary: DpwhSummary | null; className?: string }) {
  if (!summary) return null;
  const snapshot = summary.source_snapshot_at;
  const synced = summary.last_successful_sync_at;

  const hint = (
    <>
      {snapshot
        ? `Source snapshot: the date BetterGov.ph published the DPWH data shown here (${formatDate(snapshot)}). `
        : 'The latest DPWH snapshot has not finished importing, so figures cover only the records imported so far. '}
      Last completed sync: {synced ? formatDate(synced) : 'none yet'}. Totals computed: {formatDate(summary.computed_at)}.
    </>
  );

  return (
    <p className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <History className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {snapshot ? (
        <span>
          Source snapshot <time dateTime={snapshot} className="font-medium text-subtle">{formatDate(snapshot)}</time>
        </span>
      ) : (
        <span>
          Import incomplete · totals as of <time dateTime={summary.computed_at} className="font-medium text-subtle">{formatDate(summary.computed_at)}</time>
        </span>
      )}
      <Tooltip content={hint}>
        <button
          type="button"
          aria-label="What these dates mean"
          className="grid place-items-center w-6 h-6 -my-1 rounded-full text-muted hover:text-ink hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </Tooltip>
    </p>
  );
}
