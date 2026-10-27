'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, List, Loader2, Map as MapIcon, MapPin, ZoomIn } from 'lucide-react';
import { errorMessage, fetchJson } from '@/lib/http';
import { useToast } from '@/components/ui/Toast';
import { Tooltip } from '@/components/ui/Tooltip';
import { Notice } from '@/components/ui/StateViews';
import { DPWH_STATUS_LABELS, type DpwhMapPoint, type DpwhSummary } from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { textLinkClass } from './ui';
import { MAP_STATUSES, STATUS_COLORS, formatCount } from './format';
import { DataScopeNote } from './DataScopeNote';
import { DataFreshness } from './DataFreshness';
import { DpwhMapFilters, EMPTY_MAP_FILTERS, type MapFilters } from './DpwhMapFilters';
import { DpwhMapProjectPanel, LIST_PAGE } from './DpwhMapProjectPanel';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import type { MapSelection, MarkerColorMode } from './DpwhLeafletMap';
import { StreetViewCat } from './StreetViewCat';
import type { Map as LeafletMap } from 'leaflet';
import type { LatLng } from '@/lib/streetview';

const DpwhLeafletMap = dynamic(() => import('./DpwhLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-sunken flex items-center justify-center">
      <span className="inline-flex items-center gap-2 h-9 px-4 rounded-full glass-strong border border-line shadow-raise text-[13px] font-medium text-subtle">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading map…
      </span>
    </div>
  ),
});

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
/** Floating controls over the map: the app's glass, a hairline and the raised shadow. */
const floatClass = 'glass-strong border border-line/80 shadow-raise';

const COLOR_MODE_HINTS: Record<MarkerColorMode, string> = {
  status: 'Colour markers by the status DPWH reports (completed, on-going, and so on).',
  region: 'Colour markers by the region each contract is located in.',
};

const segmentClass = (active: boolean) =>
  `inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 ${focusRing} focus-visible:outline-offset-1 ${
    active ? 'bg-ink text-on-ink shadow-raise' : 'text-subtle hover:text-ink'
  }`;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export interface MapFocus {
  id: string | null;
  lat: number;
  lng: number;
}

/**
 * The public project map: filters over a map and a project panel that work
 * as one view. Filters and the viewport drive one request; the markers and
 * the list are the same rows, so they never disagree. Selecting a card
 * centers its marker; clicking a marker selects (and if needed pins) its
 * card; hovering a card rings its marker.
 */
export function DpwhPublicMap({ focus }: { focus: MapFocus | null }) {
  const [filters, setFilters] = useState<MapFilters>(EMPTY_MAP_FILTERS);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [points, setPoints] = useState<DpwhMapPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  // A ?focus= link opens on its contract already selected; the map centers on it itself, so no pan.
  const [selection, setSelection] = useState<MapSelection | null>(() => (focus?.id ? { id: focus.id, pan: false } : null));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DpwhSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [colorMode, setColorMode] = useState<MarkerColorMode>('status');
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE);
  // Below the lg breakpoint the map and the list share one slot; on wide screens both show.
  const [smallView, setSmallView] = useState<'map' | 'list'>('map');
  // The legend starts folded on phones, where open it would cover much of the map.
  const [legendOpen, setLegendOpen] = useState(true);
  // The Street View cat works on the same Leaflet map; while it is being placed, markers ignore clicks.
  const [leafletMap, setLeafletMap] = useState<LeafletMap | null>(null);
  const [catPlacing, setCatPlacing] = useState(false);
  const [catSpot, setCatSpot] = useState<LatLng | null>(null);
  const { toast } = useToast();
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setLegendOpen(false);
  }, []);

  const q = useDebounced(filters.q, 350);
  const debouncedBounds = useDebounced(bounds, 250);

  useEffect(() => {
    let active = true;
    fetchJson<{ summary: DpwhSummary | null }>('/api/dpwh/summary')
      .then((body) => {
        if (!active) return;
        setSummary(body.summary);
        setSummaryState(body.summary ? 'ready' : 'empty');
      })
      .catch(() => active && setSummaryState('error'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!debouncedBounds) return;
    const b = debouncedBounds;
    const params = new URLSearchParams({ bbox: [b.west, b.south, b.east, b.north].map((n) => n.toFixed(5)).join(',') });
    if (q.trim()) params.set('q', q.trim());
    if (filters.region) params.set('region', filters.region);
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);

    const controller = new AbortController();
    setState('loading');
    fetchJson<{ points: DpwhMapPoint[]; total: number; limit: number }>(`/api/dpwh/map?${params}`, { signal: controller.signal })
      .then((body) => {
        setPoints(body.points);
        setTotal(body.total);
        setLimit(body.limit);
        setVisibleCount(LIST_PAGE);
        setState('ready');
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setError(errorMessage(e, 'Could not load map markers. Please try again.'));
        setState('error');
      });
    return () => controller.abort();
  }, [debouncedBounds, q, filters.region, filters.category, filters.status, reload]);

  const regionOptions = useMemo(
    () => (summary?.stats.by_region ?? []).filter((r) => r.value !== null).map((r) => r.value as string).sort(),
    [summary]
  );
  const capped = state === 'ready' && total > points.length;
  // Region legend lists only regions with markers in view, in the summary's order.
  const regionsInView = useMemo(() => {
    const present = new Set(points.map((p) => p.region));
    const ordered = (summary?.stats.by_region ?? []).map((r) => r.value).filter((r) => present.has(r));
    return present.has(null) ? [...ordered, null] : ordered;
  }, [points, summary]);

  const selectFromList = useCallback((id: string) => {
    setSelection({ id, pan: true });
    setSmallView('map');
  }, []);
  const selectFromMarker = useCallback((id: string) => setSelection({ id, pan: false }), []);
  const retry = useCallback(() => setReload((n) => n + 1), []);
  const isFiltered = filters.q.trim() !== '' || !!(filters.region || filters.category || filters.status);
  const changeFilters = useCallback(
    (next: MapFilters) => {
      setFilters(next);
      const cleared = !next.q && !next.region && !next.category && !next.status;
      if (cleared && isFiltered) toast({ id: 'map-filters', tone: 'info', title: 'Search and filters cleared', description: 'Showing all mapped contracts in this area.' });
    },
    [isFiltered, toast]
  );
  const clearFilters = useCallback(() => changeFilters(EMPTY_MAP_FILTERS), [changeFilters]);

  const resultLine =
    state === 'loading' ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Updating results…
      </span>
    ) : state === 'ready' ? (
      capped ? (
        <>
          <strong className="font-semibold text-ink">{formatCount(total)}</strong> mapped contracts in this area · the map shows the{' '}
          <strong className="font-semibold text-ink">{formatCount(points.length)}</strong> largest (limit {formatCount(limit)})
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">{formatCount(total)}</strong> mapped contract{total === 1 ? '' : 's'} in this area
        </>
      )
    ) : state === 'error' ? (
      <span className="text-danger-ink">{error}</span>
    ) : (
      'Finding contracts in this area…'
    );

  return (
    <div className="space-y-5">
      {summaryState === 'empty' && (
        <Notice tone="warn">No DPWH data has been imported yet, so the map has no markers. An administrator needs to run the initial sync.</Notice>
      )}
      {summaryState === 'error' && (
        <Notice tone="danger">Could not load the data summary, so the region filter has no options. Search and the other filters still work.</Notice>
      )}

      <DpwhMapFilters
        filters={filters}
        onChange={changeFilters}
        regionOptions={regionOptions}
        resultLine={resultLine}
        trailing={
          state === 'error' ? (
            <button type="button" onClick={retry}
              className={`inline-flex items-center h-8 px-3 rounded-full border border-danger-line text-[13px] font-semibold text-danger-ink hover:bg-danger-soft ${focusRing}`}>
              Try again
            </button>
          ) : undefined
        }
      />

      {/* Small screens: one slot, switched here; the switch stays reachable under the navigation bar.
          Both panes stay mounted so the map keeps its view. */}
      <div className="lg:hidden sticky top-[3.75rem] z-30 flex justify-center">
        <div role="group" aria-label="Show" className={`grid grid-cols-2 gap-0.5 p-1 rounded-full ${floatClass}`}>
          <button type="button" aria-pressed={smallView === 'map'} onClick={() => setSmallView('map')} className={`${segmentClass(smallView === 'map')} min-w-28`}>
            <MapIcon className="w-4 h-4" aria-hidden="true" /> Map
          </button>
          <button type="button" aria-pressed={smallView === 'list'} onClick={() => setSmallView('list')} className={`${segmentClass(smallView === 'list')} min-w-28`}>
            <List className="w-4 h-4" aria-hidden="true" /> List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,34%)] lg:h-[clamp(36rem,calc(100dvh-6.5rem),60rem)]">
        <div
          className={`map-frame relative h-[min(72dvh,38rem)] min-h-[24rem] lg:h-full lg:min-h-0 rounded-card overflow-hidden border border-line bg-sunken shadow-raise ${
            smallView === 'list' ? 'hidden lg:block' : ''
          }`}
        >
          <DpwhLeafletMap
            points={points}
            focus={focus}
            selection={selection}
            onBoundsChange={setBounds}
            onMarkerSelect={selectFromMarker}
            colorMode={colorMode}
            hoveredId={hoveredId}
            markersInteractive={!catPlacing}
            streetViewSpot={catSpot}
            onMapReady={setLeafletMap}
          />

          <StreetViewCat map={leafletMap} onPlacingChange={setCatPlacing} onSpotChange={setCatSpot} />

          <div role="group" aria-label="Colour markers by" className={`absolute right-3 top-3 z-[450] inline-flex items-center gap-0.5 p-1 rounded-full ${floatClass}`}>
            {(['status', 'region'] as const).map((mode) => (
              <Tooltip key={mode} content={COLOR_MODE_HINTS[mode]} side="bottom">
                <button type="button" aria-pressed={colorMode === mode} onClick={() => setColorMode(mode)} className={`${segmentClass(colorMode === mode)} h-8 px-3`}>
                  {mode === 'status' ? 'Status' : 'Region'}
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Where the eye is: a quiet chip while markers load, or when the map holds only the largest contracts. */}
          <div aria-hidden="true" className="hidden sm:block pointer-events-none absolute left-1/2 -translate-x-1/2 top-[4.25rem] lg:top-3 z-[440] max-w-[calc(100%-1.5rem)] lg:max-w-[min(26rem,calc(100%-22rem))]">
            {state === 'loading' ? (
              <span className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium text-subtle ${floatClass}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating markers…
              </span>
            ) : capped ? (
              <span className={`inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-full text-[12.5px] leading-tight font-medium text-subtle ${floatClass}`}>
                <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                <span>Largest {formatCount(points.length)} of {formatCount(total)} shown · zoom in for more</span>
              </span>
            ) : null}
          </div>

          {state === 'error' && points.length === 0 && (
            <div className="absolute inset-0 z-[445] grid place-items-center p-6 pointer-events-none">
              <div role="alert" className={`pointer-events-auto max-w-xs rounded-card px-5 py-4 text-center ${floatClass}`}>
                <AlertTriangle className="mx-auto w-5 h-5 text-danger-ink" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink">Markers could not be loaded</p>
                <p className="mt-1 text-xs text-subtle">The map tiles still work. Check the connection and try again.</p>
                <button type="button" onClick={retry}
                  className={`mt-3 inline-flex items-center h-9 px-4 rounded-full bg-ink text-on-ink text-[13px] font-semibold hover:bg-ink-soft ${focusRing}`}>
                  Try again
                </button>
              </div>
            </div>
          )}
          {state === 'ready' && points.length === 0 && (
            <div className="absolute inset-0 z-[445] grid place-items-center p-6 pointer-events-none">
              <p className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium text-subtle ${floatClass}`}>
                <MapPin className="w-4 h-4" aria-hidden="true" /> No mapped contracts match here
              </p>
            </div>
          )}

          {/* Above the tiles, below Leaflet's own controls; clears the attribution line. */}
          <details
            open={legendOpen}
            onToggle={(e) => setLegendOpen(e.currentTarget.open)}
            className={`group absolute left-3 bottom-9 z-[450] w-max max-w-[calc(100%-1.5rem)] sm:max-w-[22rem] rounded-2xl text-xs text-ink ${floatClass}`}
          >
            <summary className={`flex items-center gap-2 h-9 pl-3.5 pr-3 cursor-pointer list-none rounded-2xl [&::-webkit-details-marker]:hidden ${focusRing} focus-visible:outline-offset-1`}>
              <span className="font-semibold">Legend</span>
              <span className="text-muted">{colorMode === 'status' ? 'Reported status' : 'Region'}</span>
              <ChevronDown className="ml-auto w-3.5 h-3.5 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul
              aria-label={colorMode === 'status' ? 'Marker colours: status' : 'Marker colours: region'}
              className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto overscroll-contain px-3.5 pt-1 pb-3 border-t border-line/70 mx-0"
            >
              {colorMode === 'status'
                ? MAP_STATUSES.map((s) => (
                    <li key={s} className="flex items-center gap-2 pt-2 first:pt-2 min-w-0">
                      <span className="w-2.5 h-2.5 shrink-0 rounded-full ring-[1.5px] ring-white/90" style={{ backgroundColor: STATUS_COLORS[s] }} aria-hidden="true" />
                      <span className="truncate">{DPWH_STATUS_LABELS[s]}</span>
                    </li>
                  ))
                : regionsInView.length === 0
                  ? <li className="col-span-2 pt-2 text-muted">No markers in view</li>
                  : regionsInView.map((r) => (
                      <li key={r ?? 'none'} className="flex items-center gap-2 pt-2 min-w-0" title={r ? regionDisplayName(r) : undefined}>
                        <span className="w-2.5 h-2.5 shrink-0 rounded-[3px] ring-[1.5px] ring-white/90" style={{ backgroundColor: regionColor(r) }} aria-hidden="true" />
                        <span className="truncate">{r ? regionDisplayName(r).split(' · ').pop() : 'Not reported'}</span>
                      </li>
                    ))}
            </ul>
          </details>
        </div>

        <DpwhMapProjectPanel
          points={points}
          total={total}
          state={state}
          selection={selection}
          colorMode={colorMode}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((n) => n + LIST_PAGE)}
          onSelect={selectFromList}
          onHover={setHoveredId}
          onRetry={retry}
          onClearFilters={isFiltered ? clearFilters : undefined}
          className={smallView === 'map' ? 'hidden lg:flex' : 'flex'}
        />
      </div>

      <div className="grid gap-3">
        <div className="flex items-start gap-3 rounded-card bg-sunken px-4 py-3.5 text-[13px] leading-relaxed text-subtle">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
          <p>
            <span className="font-semibold text-ink">Only contracts with reported coordinates appear on the map.</span>{' '}
            Contracts without coordinates remain in the <Link href="/projects" className={textLinkClass}>project directory</Link>, as do FY 2027 NEP budget
            proposals, which the source publishes <Link href="/projects?source=dpwh_nep_2027" className={textLinkClass}>without coordinates</Link>.
            Locations are as reported by DPWH and have not been field-verified by the LGU.
          </p>
        </div>
        <DataFreshness summary={summary} className="px-1" />
        {summaryState !== 'loading' && <DataScopeNote summary={summary} />}
      </div>
    </div>
  );
}
