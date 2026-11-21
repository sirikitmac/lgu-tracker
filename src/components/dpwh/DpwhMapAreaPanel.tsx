'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Crosshair, MapPin, RotateCcw, SearchX } from 'lucide-react';
import type { DpwhBubble } from '@/types/dpwh';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { DPWH_STATUS_LABELS, type DpwhStatus } from '@/types/dpwh';
import { formatCount, statusColor, statusLabel } from './format';
import { secondaryButtonSmClass } from './ui';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
const AREAS_SHOWN = 60;

/** Share of each status in a bubble as one thin stacked bar (colour is never the only cue: the legend line below names them). */
function StatusBar({ statuses, total }: { statuses: Record<string, number>; total: number }) {
  const entries = Object.entries(statuses).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden="true">
      {entries.map(([status, n]) => (
        <span key={status} style={{ width: `${(n / total) * 100}%`, backgroundColor: statusColor(status) }} />
      ))}
    </div>
  );
}

function statusLine(statuses: Record<string, number>): string {
  return Object.entries(statuses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([status, n]) => `${formatCount(n)} ${(DPWH_STATUS_LABELS[status as DpwhStatus] ?? statusLabel(status)).toLowerCase()}`)
    .join(' · ');
}

/**
 * The map's side panel while it shows bubbles: the same areas as a list, the
 * busiest first. It is also the keyboard and screen-reader way into the map,
 * since a bubble itself cannot take focus: choosing an area zooms the map to it.
 */
export function DpwhMapAreaPanel({
  bubbles,
  total,
  state,
  onZoomTo,
  onRetry,
  onClearFilters,
  className = '',
}: {
  bubbles: DpwhBubble[];
  total: number;
  state: 'idle' | 'loading' | 'ready' | 'error';
  onZoomTo: (bubble: DpwhBubble) => void;
  onRetry: () => void;
  onClearFilters?: () => void;
  className?: string;
}) {
  const listed = bubbles.slice(0, AREAS_SHOWN);
  return (
    <section aria-labelledby="map-areas-title" className={`bg-surface border border-line rounded-card min-w-0 flex-col lg:overflow-hidden ${className}`}>
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="map-areas-title" className="text-[17px] font-semibold tracking-[-0.015em] text-ink">Areas on map</h2>
            <p className="mt-1 text-[13px] text-muted tabular-nums">
              {state === 'error' ? (
                'The map could not be loaded'
              ) : bubbles.length === 0 && state !== 'ready' ? (
                'Loading areas…'
              ) : (
                <>
                  <span className="font-semibold text-ink">{formatCount(total)}</span> mapped contracts in{' '}
                  <span className="font-semibold text-ink">{formatCount(bubbles.length)}</span> area{bubbles.length === 1 ? '' : 's'}
                </>
              )}
            </p>
          </div>
          <Link
            href="/projects"
            className={`inline-flex items-center gap-1 shrink-0 h-8 px-3 -mr-1 rounded-full border border-line-strong text-[13px] font-semibold text-ink hover:bg-sunken transition-colors ${focusRing}`}
          >
            Directory <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Most projects first · zoom in to see individual projects
        </p>
      </header>

      {state === 'error' && bubbles.length === 0 ? (
        <ErrorState className="flex-1 px-8 py-14" title="The map could not be loaded" description="Check the connection and try again." onRetry={onRetry} />
      ) : state === 'ready' && bubbles.length === 0 ? (
        <EmptyState
          className="flex-1 px-8 py-14"
          icon={SearchX}
          title={onClearFilters ? 'No matching contracts here' : 'Nothing mapped here'}
          description="Zoom out or move the map."
          action={
            onClearFilters && (
              <button type="button" onClick={onClearFilters} className={secondaryButtonSmClass}>
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Clear search and filters
              </button>
            )
          }
        />
      ) : (
        <div
          aria-busy={state === 'loading'}
          className={`flex-1 min-h-0 lg:overflow-y-auto overscroll-contain p-3 sm:p-4 bg-ground/60 transition-opacity duration-200 [scrollbar-gutter:stable] ${state === 'loading' ? 'opacity-60' : ''}`}
        >
          <ol className="space-y-2.5" aria-label="Areas in view">
            {listed.map((b) => (
              <li key={`${b.lat}:${b.lng}`}>
                <button
                  type="button"
                  onClick={() => onZoomTo(b)}
                  className={`block w-full text-left rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong hover:bg-sunken ${focusRing}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: regionColor(b.region) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                      {b.region ? regionDisplayName(b.region) : 'Region not reported'}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">
                      {formatCount(b.n)} <span className="font-normal text-muted">project{b.n === 1 ? '' : 's'}</span>
                    </span>
                  </span>
                  <StatusBar statuses={b.statuses} total={b.n} />
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{statusLine(b.statuses)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {bubbles.length > listed.length && (
            <p className="mt-4 px-2 text-center text-xs leading-relaxed text-muted">
              {formatCount(bubbles.length - listed.length)} smaller areas are only on the map. Zoom in to see them.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
