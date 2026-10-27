'use client';

import React, { memo, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Crosshair, MapPin, RotateCcw, SearchX } from 'lucide-react';
import type { DpwhMapPoint } from '@/types/dpwh';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { formatCount, formatPeso, formatProgress, readableTitle } from './format';
import { StatusPill } from './StatusPill';
import { secondaryButtonSmClass, textLinkClass } from './ui';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import type { MapSelection, MarkerColorMode } from './DpwhLeafletMap';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** Entries shown at first, and added per "Show more". The markers arrive largest contract first. */
export const LIST_PAGE = 50;

interface CardProps {
  point: DpwhMapPoint;
  selected: boolean;
  colorMode: MarkerColorMode;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * One contract: ID and status on top, the title as the main line, then
 * place and amount as labelled metadata, so no two items compete on one
 * line. The selected card opens in place with the popup's details and a
 * link to the full record.
 */
const ProjectCard = memo(function ProjectCard({ point: p, selected, colorMode, onSelect, onHover }: CardProps) {
  const name = p.contract_name ?? p.title;
  const place = p.province ?? (p.region ? regionDisplayName(p.region) : 'Location not reported');
  const region = p.province && p.region ? regionDisplayName(p.region) : null;
  return (
    <li data-contract={p.contract_id}>
      <article
        className={`relative rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200 ${
          selected
            ? 'bg-surface border-accent-ink/45 shadow-raise ring-1 ring-accent-ink/15'
            : 'bg-surface border-line hover:border-line-strong hover:shadow-raise'
        }`}
      >
        {selected && <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-accent" aria-hidden="true" />}
        <button
          type="button"
          onClick={() => onSelect(p.contract_id)}
          onPointerEnter={() => onHover(p.contract_id)}
          onPointerLeave={() => onHover(null)}
          onFocus={() => onHover(p.contract_id)}
          onBlur={() => onHover(null)}
          aria-current={selected ? 'true' : undefined}
          className={`block w-full text-left px-4 pt-3.5 pb-4 sm:px-5 rounded-2xl ${focusRing} focus-visible:outline-offset-0`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium tracking-[0.01em] text-muted tabular-nums">{p.contract_id}</span>
            <StatusPill status={p.status} />
          </span>
          <span
            className={`mt-2 block text-[15px] font-semibold leading-[1.45] tracking-[-0.005em] text-ink text-pretty break-words ${selected ? '' : 'line-clamp-4'}`}
            title={name}
          >
            {readableTitle(name)}
          </span>
          <span className="mt-3.5 pt-3 border-t border-line grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
            <span className="flex items-start gap-1.5 min-w-0 text-[13px] leading-snug">
              {colorMode === 'region' ? (
                <span className="w-2.5 h-2.5 mt-[3px] shrink-0 rounded-[3px]" style={{ backgroundColor: regionColor(p.region) }} aria-hidden="true" />
              ) : (
                <MapPin className="w-3.5 h-3.5 mt-px shrink-0 text-muted" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block text-subtle font-medium break-words">{place}</span>
                {region && <span className="block mt-0.5 text-xs text-muted break-words">{region}</span>}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-[11.5px] leading-none text-muted">Contract amount</span>
              <span className="block mt-1.5 text-[15px] font-semibold leading-none tracking-[-0.01em] text-ink tabular-nums">{formatPeso(p.contract_amount)}</span>
            </span>
          </span>
        </button>

        {selected && (
          <div className="px-4 sm:px-5 pb-4 motion-safe:animate-[bp-in_220ms_var(--ease-out)]">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-sunken px-3.5 py-3 text-[13px] leading-snug">
              <dt className="text-muted">Contractor</dt>
              <dd className="text-ink break-words">{p.contractor ?? 'Not reported'}</dd>
              <dt className="text-muted">Office</dt>
              <dd className="text-ink break-words">{p.implementing_office ?? 'Not reported'}</dd>
              <dt className="text-muted">Progress</dt>
              <dd className="text-ink tabular-nums">{formatProgress(p.progress)} <span className="text-muted">reported</span></dd>
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">Location as reported by DPWH; not verified.</span>
              <Link
                href={`/projects/${encodeURIComponent(p.contract_id)}`}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink text-on-ink text-[13px] font-semibold hover:bg-ink-soft transition-colors ${focusRing}`}
              >
                View contract <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </article>
    </li>
  );
});

function SkeletonCard() {
  return (
    <li className="rounded-2xl border border-line bg-surface px-5 pt-4 pb-4 animate-pulse" aria-hidden="true">
      <div className="flex justify-between">
        <div className="h-3 w-20 rounded-full bg-sunken" />
        <div className="h-5 w-20 rounded-full bg-sunken" />
      </div>
      <div className="mt-3 h-3.5 w-full rounded-full bg-sunken" />
      <div className="mt-2 h-3.5 w-4/5 rounded-full bg-sunken" />
      <div className="mt-5 pt-3 border-t border-line flex justify-between">
        <div className="h-3 w-28 rounded-full bg-sunken" />
        <div className="h-4 w-24 rounded-full bg-sunken" />
      </div>
    </li>
  );
}

/**
 * The project side of the map: a header that stays put (title, honest
 * counts, a link to the directory) over a list that scrolls on its own.
 * Entries are the loaded markers in the order the API returns them (largest
 * contract amount first). A contract selected on the map but further down
 * than the list shows is pinned to the top, so a marker click always finds
 * its entry.
 */
export function DpwhMapProjectPanel({
  points,
  total,
  state,
  selection,
  colorMode,
  visibleCount,
  onShowMore,
  onSelect,
  onHover,
  onRetry,
  onClearFilters,
  className = '',
}: {
  points: DpwhMapPoint[];
  /** Matching mapped contracts in the viewport (may exceed the loaded markers). */
  total: number;
  state: 'idle' | 'loading' | 'ready' | 'error';
  selection: MapSelection | null;
  colorMode: MarkerColorMode;
  visibleCount: number;
  onShowMore: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onRetry: () => void;
  /** Present only while a search or filter is active. */
  onClearFilters?: () => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedId = selection?.id ?? null;
  const listed = points.slice(0, visibleCount);
  const pinned = useMemo(() => {
    if (!selectedId) return null;
    const index = points.findIndex((p) => p.contract_id === selectedId);
    return index >= visibleCount ? points[index] : null;
  }, [points, selectedId, visibleCount]);
  const remainingLoaded = points.length - listed.length;
  const notLoaded = Math.max(0, total - points.length);

  // A marker click selects without panning; bring its card into view inside the list, never by scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    if (!selection || selection.pan || !list) return;
    const item = list.querySelector<HTMLElement>(`[data-contract="${CSS.escape(selection.id)}"]`);
    if (!item) return;
    const top = item.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
    }
  }, [selection, pinned]);

  const countLine =
    state === 'ready' || (state === 'loading' && points.length > 0) ? (
      points.length === 0 ? (
        'No mapped contracts in this area'
      ) : (
        <>
          <span className="font-semibold text-ink">{formatCount(listed.length + (pinned ? 1 : 0))}</span> shown of{' '}
          <span className="font-semibold text-ink">{formatCount(total)}</span> mapped in this area
        </>
      )
    ) : state === 'error' ? (
      'Contracts could not be loaded'
    ) : (
      'Loading contracts in this area…'
    );

  return (
    <section aria-labelledby="map-list-title" className={`bg-surface border border-line rounded-card min-w-0 flex-col lg:overflow-hidden ${className}`}>
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="map-list-title" className="text-[17px] font-semibold tracking-[-0.015em] text-ink">Projects on map</h2>
            <p className="mt-1 text-[13px] text-muted tabular-nums">{countLine}</p>
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
          Largest contract amount first · follows the area on the map
        </p>
      </header>

      {state === 'error' && points.length === 0 ? (
        <ErrorState
          className="flex-1 px-8 py-14"
          title="Contracts could not be loaded"
          description="The list for this area did not load. The map itself still works."
          onRetry={onRetry}
        />
      ) : state === 'ready' && points.length === 0 ? (
        <EmptyState
          className="flex-1 px-8 py-14"
          icon={SearchX}
          title={onClearFilters ? 'No matching contracts here' : 'Nothing mapped here'}
          description={
            onClearFilters
              ? 'No mapped contracts in this area match your search or filters. Zoom out, move the map, or clear them.'
              : 'No contracts with reported coordinates in this area. Zoom out or move the map.'
          }
          action={
            onClearFilters && (
              <button type="button" onClick={onClearFilters} className={secondaryButtonSmClass}>
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Clear search and filters
              </button>
            )
          }
        />
      ) : points.length === 0 ? (
        <ul aria-busy="true" aria-label="Loading contracts" className="flex-1 min-h-0 lg:overflow-hidden p-3 sm:p-4 space-y-3 bg-ground/60">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      ) : (
        <div
          ref={listRef}
          aria-busy={state === 'loading'}
          className={`flex-1 min-h-0 lg:overflow-y-auto overscroll-contain p-3 sm:p-4 bg-ground/60 transition-opacity duration-200 [scrollbar-gutter:stable] ${
            state === 'loading' ? 'opacity-60' : ''
          }`}
        >
          {pinned && (
            <div className="mb-4">
              <p className="px-1 pb-2 text-xs font-semibold text-muted">Selected on the map</p>
              <ul className="space-y-3">
                <ProjectCard point={pinned} selected colorMode={colorMode} onSelect={onSelect} onHover={onHover} />
              </ul>
              <p className="px-1 pt-4 text-xs font-semibold text-muted">Largest in this area</p>
            </div>
          )}
          <ol className="space-y-3" aria-label="Contracts in this area">
            {listed.map((p) => (
              <ProjectCard
                key={p.contract_id}
                point={p}
                selected={selectedId === p.contract_id}
                colorMode={colorMode}
                onSelect={onSelect}
                onHover={onHover}
              />
            ))}
          </ol>

          <div className="mt-4 mb-1 space-y-3 text-center">
            {remainingLoaded > 0 && (
              <button
                type="button"
                onClick={onShowMore}
                className={`inline-flex items-center justify-center h-10 px-5 rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink hover:bg-sunken transition-colors ${focusRing}`}
              >
                Show {formatCount(Math.min(LIST_PAGE, remainingLoaded))} more
                <span className="ml-1.5 font-normal text-muted tabular-nums">· {formatCount(remainingLoaded)} left on the map</span>
              </button>
            )}
            {notLoaded > 0 && remainingLoaded === 0 && (
              <p className="px-4 text-xs leading-relaxed text-muted">
                {formatCount(notLoaded)} smaller contracts in this area are not on the map at this zoom. Zoom in, or{' '}
                <Link href="/projects" className={textLinkClass}>search the full directory</Link>.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
