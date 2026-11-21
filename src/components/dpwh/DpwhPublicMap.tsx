'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, List, Loader2, Map as MapIcon, MapPin, ZoomIn } from 'lucide-react';
import { errorMessage, fetchJson } from '@/lib/http';
import { ResponseCache } from '@/lib/dpwh/responseCache';
import { useToast } from '@/components/ui/Toast';
import { Notice } from '@/components/ui/StateViews';
import type { DpwhBubble, DpwhMapPoint, DpwhSummary } from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { textLinkClass } from './ui';
import { formatCount } from './format';
import { DataScopeNote } from './DataScopeNote';
import { DataFreshness } from './DataFreshness';
import { DpwhMapFilters, EMPTY_MAP_FILTERS, type MapFilters } from './DpwhMapFilters';
import { useDpwhView } from './DpwhViewContext';
import { PH_BBOX } from '@/lib/dpwh/viewFilters';
import { DpwhMapProjectPanel, LIST_PAGE } from './DpwhMapProjectPanel';
import { DpwhMapAreaPanel } from './DpwhMapAreaPanel';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import type { MapSelection } from './DpwhLeafletMap';
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
// Answers for the markers and totals already asked for in this tab, reused for ten minutes.
type MapBody = { points: DpwhMapPoint[]; total: number; limit: number; approximate?: boolean };
type BubbleBody = { bubbles: DpwhBubble[]; total: number; approximate?: boolean };
const mapCache = new ResponseCache<MapBody>();
const bubbleCache = new ResponseCache<BubbleBody>();

/** Zoom levels: bubbles (counted per area) up to here, individual markers from the next zoom in. */
const BUBBLE_MAX_ZOOM = 10;
/** Grid level of the bubbles at a zoom: 0 = 1 degree cells, 1 = 0.25, 2 = 0.05. */
const bubbleLevel = (zoom: number) => (zoom <= 6 ? 0 : zoom <= 8 ? 1 : 2);

/**
 * Rounds a viewport outward to a grid, so panning a little asks for the same URL again (browser and CDN
 * cache hits instead of a new database query on every drag). The grid is finer when zoomed in.
 */
function snapBounds(b: MapBounds): MapBounds {
  const span = Math.max(b.east - b.west, b.north - b.south);
  const step = span > 8 ? 1 : span > 2 ? 0.25 : span > 0.5 ? 0.05 : 0.01;
  const down = (n: number) => Math.floor(n / step) * step;
  const up = (n: number) => Math.ceil(n / step) * step;
  return {
    west: Math.max(-180, down(b.west)),
    south: Math.max(-90, down(b.south)),
    east: Math.min(180, up(b.east)),
    north: Math.min(90, up(b.north)),
  };
}

async function fetchCached<T extends { approximate?: boolean }>(cache: ResponseCache<T>, url: string, signal: AbortSignal): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit;
  let body: T;
  try {
    body = await fetchJson<T>(url, { signal });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    // One quiet retry: a slow first answer from the database is usually fine the second time.
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (signal.aborted) throw error;
    body = await fetchJson<T>(url, { signal });
  }
  // An answer without its exact total is not kept, so the next look can get the real one.
  if (!body.approximate) cache.set(url, body);
  return body;
}
const fetchMapCached = (url: string, signal: AbortSignal) => fetchCached(mapCache, url, signal);
const fetchBubblesCached = (url: string, signal: AbortSignal) => fetchCached(bubbleCache, url, signal);

export function DpwhPublicMap({ focus }: { focus: MapFocus | null }) {
  // Region, status and category are shared with the dashboard (a click on either reaches the other); the text search stays here.
  const view = useDpwhView();
  const [search, setSearch] = useState('');
  const filters: MapFilters = useMemo(
    () => ({ q: search, region: view.filters.region, category: view.filters.category, status: view.filters.status }),
    [search, view.filters.region, view.filters.category, view.filters.status]
  );
  const [viewport, setViewport] = useState<{ bounds: MapBounds; zoom: number } | null>(null);
  const [points, setPoints] = useState<DpwhMapPoint[]>([]);
  const [bubbles, setBubbles] = useState<DpwhBubble[]>([]);
  // What the answer on screen is made of: bubbles (zoomed out) or individual markers (zoomed in, or while searching).
  const [shown, setShown] = useState<'bubbles' | 'markers'>('bubbles');
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(0);
  const [approximate, setApproximate] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  // A ?focus= link opens on its contract already selected; the map centers on it itself, so no pan.
  const [selection, setSelection] = useState<MapSelection | null>(() => (focus?.id ? { id: focus.id, pan: false } : null));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DpwhSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const { colorMode } = view;
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
  const debouncedView = useDebounced(viewport, 250);
  const searching = q.trim() !== '';

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
    if (!debouncedView) return;
    const b = snapBounds(debouncedView.bounds);
    const bbox = [b.west, b.south, b.east, b.north].map((n) => n.toFixed(5)).join(',');
    // Zoomed out the map shows bubbles counted per area; zoomed in, or with a text search (which only the
    // contract rows can answer), it shows the individual markers.
    const asBubbles = debouncedView.zoom <= BUBBLE_MAX_ZOOM && !searching;
    const params = new URLSearchParams({ bbox });
    if (asBubbles) params.set('level', String(bubbleLevel(debouncedView.zoom)));
    if (!asBubbles && q.trim()) params.set('q', q.trim());
    if (filters.region) params.set('region', filters.region);
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);

    const controller = new AbortController();
    setState('loading');
    if (asBubbles) {
      fetchBubblesCached(`/api/dpwh/bubbles?${params}`, controller.signal)
        .then((body) => {
          setBubbles(body.bubbles);
          setPoints([]);
          setTotal(body.total);
          setApproximate(false);
          setShown('bubbles');
          setState('ready');
        })
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError') return;
          setError(errorMessage(e, 'Could not load the map. Please try again.'));
          setState('error');
        });
    } else {
      fetchMapCached(`/api/dpwh/map?${params}`, controller.signal)
        .then((body) => {
          setPoints(body.points);
          setBubbles([]);
          setTotal(body.total);
          setLimit(body.limit);
          setApproximate(body.approximate === true);
          setVisibleCount(LIST_PAGE);
          setShown('markers');
          setState('ready');
        })
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError') return;
          setError(errorMessage(e, 'Could not load map markers. Please try again.'));
          setState('error');
        });
    }
    return () => controller.abort();
  }, [debouncedView, q, searching, filters.region, filters.category, filters.status, reload]);

  const regionOptions = useMemo(
    () => (summary?.stats.by_region ?? []).filter((r) => r.value !== null).map((r) => r.value as string).sort(),
    [summary]
  );
  const capped = state === 'ready' && shown === 'markers' && total > points.length;
  const nothingHere = state === 'ready' && (shown === 'bubbles' ? bubbles.length === 0 : points.length === 0);
  // Region legend lists only regions with markers in view, in the summary's order.
  const regionsInView = useMemo(() => {
    const present = new Set<string | null>([...points.map((p) => p.region), ...bubbles.map((b) => b.region)]);
    const ordered = (summary?.stats.by_region ?? []).map((r) => r.value).filter((r) => present.has(r));
    return present.has(null) ? [...ordered, null] : ordered;
  }, [points, bubbles, summary]);

  const { setSelected, setMatching, fitRequest } = view;
  // The selected contract is shown on the dashboard too.
  useEffect(() => {
    if (!selection) return setSelected(null);
    const point = points.find((p) => p.contract_id === selection.id);
    if (point) setSelected(point);
  }, [selection, points, setSelected]);
  const selectFromList = useCallback((id: string) => {
    setSelection({ id, pan: true });
    setSmallView('map');
  }, []);
  const selectFromMarker = useCallback((id: string) => setSelection({ id, pan: false }), []);

  // How many contracts match the filters across the whole map (not just this view), for the dashboard; and,
  // after a click on the dashboard, frame the map on them.
  const lastFit = useRef(fitRequest);
  useEffect(() => {
    const wantsFit = fitRequest !== lastFit.current;
    lastFit.current = fitRequest;
    const params = new URLSearchParams({ bbox: PH_BBOX });
    if (filters.region) params.set('region', filters.region);
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    const fitTo = (lats: number[], lngs: number[]) => {
      if (!wantsFit || !leafletMap || lats.length === 0) return;
      leafletMap.fitBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { padding: [24, 24], maxZoom: 12 }
      );
    };
    const controller = new AbortController();
    setMatching({ total: null, state: 'loading' });
    const failed = (e: unknown) => {
      if ((e as Error)?.name !== 'AbortError') setMatching({ total: null, state: 'error' });
    };
    if (!q.trim()) {
      // No text search: the country-wide total and the frame both come from the small pre-counted bubble table.
      params.set('level', '0');
      fetchBubblesCached(`/api/dpwh/bubbles?${params}`, controller.signal)
        .then((body) => {
          setMatching({ total: body.total, state: 'ready' });
          fitTo(body.bubbles.map((x) => x.lat), body.bubbles.map((x) => x.lng));
        })
        .catch(failed);
    } else {
      params.set('q', q.trim());
      // Only the total is needed unless the map has to frame the result: skip the heavy marker query.
      if (!wantsFit) params.set('count', 'only');
      fetchMapCached(`/api/dpwh/map?${params}`, controller.signal)
        .then((body) => {
          setMatching({ total: body.total, state: 'ready' });
          fitTo(body.points.map((x) => x.latitude), body.points.map((x) => x.longitude));
        })
        .catch(failed);
    }
    return () => controller.abort();
    // The frame only follows a click on the dashboard (fitRequest), never the map's own filters or panning.
  }, [q, filters.region, filters.category, filters.status, fitRequest, leafletMap, setMatching]);
  const retry = useCallback(() => setReload((n) => n + 1), []);
  const isFiltered = filters.q.trim() !== '' || !!(filters.region || filters.category || filters.status);
  const changeFilters = useCallback(
    (next: MapFilters) => {
      setSearch(next.q);
      view.setFilters({ region: next.region, status: next.status, category: next.category }, 'map');
      const cleared = !next.q && !next.region && !next.category && !next.status;
      if (cleared && isFiltered) toast({ id: 'map-filters', tone: 'info', title: 'Search and filters cleared', description: 'Showing all mapped contracts in this area.' });
    },
    [isFiltered, toast, view]
  );
  const clearFilters = useCallback(() => changeFilters(EMPTY_MAP_FILTERS), [changeFilters]);
  // Choosing an area in the list zooms the map to it (and back to the map on a small screen).
  const zoomToBubble = useCallback(
    (b: DpwhBubble) => {
      setSmallView('map');
      leafletMap?.invalidateSize();
      leafletMap?.setView([b.lat, b.lng], Math.min((leafletMap?.getZoom() ?? 6) + 2, 19));
    },
    [leafletMap]
  );

  const resultLine =
    state === 'loading' ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Updating results…
      </span>
    ) : state === 'ready' && shown === 'bubbles' ? (
      <>
        <strong className="font-semibold text-ink">{formatCount(total)}</strong> mapped contract{total === 1 ? '' : 's'} in this area · zoom in for individual projects
      </>
    ) : state === 'ready' ? (
      approximate ? (
        <>
          Showing the <strong className="font-semibold text-ink">{formatCount(points.length)}</strong> largest mapped contracts in this area (the exact total is still counting)
        </>
      ) : capped ? (
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
        <Notice tone="danger">The data summary did not load, so the region filter is empty. Search and other filters still work.</Notice>
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
            bubbles={bubbles}
            focus={focus}
            selection={selection}
            onBoundsChange={(bounds, zoom) => setViewport({ bounds, zoom })}
            onMarkerSelect={selectFromMarker}
            colorMode={colorMode}
            hoveredId={hoveredId}
            markersInteractive={!catPlacing}
            streetViewSpot={catSpot}
            onMapReady={setLeafletMap}
          />

          <StreetViewCat map={leafletMap} onPlacingChange={setCatPlacing} onSpotChange={setCatSpot} />

          {/* Where the eye is: a quiet chip while markers load, or when the map holds only the largest contracts. */}
          <div aria-hidden="true" className="hidden sm:block pointer-events-none absolute left-1/2 -translate-x-1/2 top-[4.25rem] lg:top-3 z-[440] max-w-[calc(100%-1.5rem)] lg:max-w-[min(26rem,calc(100%-22rem))]">
            {state === 'loading' ? (
              <span className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium text-subtle ${floatClass}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating map…
              </span>
            ) : shown === 'bubbles' && state === 'ready' && bubbles.length > 0 ? (
              <span className={`inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-full text-[12.5px] leading-tight font-medium text-subtle ${floatClass}`}>
                <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                <span>Bubble size = number of projects · click one to zoom in</span>
              </span>
            ) : capped ? (
              <span className={`inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-full text-[12.5px] leading-tight font-medium text-subtle ${floatClass}`}>
                <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                <span>Largest {formatCount(points.length)} of {formatCount(total)} shown · zoom in for more</span>
              </span>
            ) : null}
          </div>

          {state === 'error' && points.length === 0 && bubbles.length === 0 && (
            <div className="absolute inset-0 z-[445] grid place-items-center p-6 pointer-events-none">
              <div role="alert" className={`pointer-events-auto max-w-xs rounded-card px-5 py-4 text-center ${floatClass}`}>
                <AlertTriangle className="mx-auto w-5 h-5 text-danger-ink" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink">The map data could not be loaded</p>
                <p className="mt-1 text-xs text-subtle">The map tiles still work. Check the connection and try again.</p>
                <button type="button" onClick={retry}
                  className={`mt-3 inline-flex items-center h-9 px-4 rounded-full bg-ink text-on-ink text-[13px] font-semibold hover:bg-ink-soft ${focusRing}`}>
                  Try again
                </button>
              </div>
            </div>
          )}
          {nothingHere && (
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
              <span className="text-muted">Region</span>
              <ChevronDown className="ml-auto w-3.5 h-3.5 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul
              aria-label="Colours: region"
              className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto overscroll-contain px-3.5 pt-1 pb-3 border-t border-line/70 mx-0"
            >
              {regionsInView.length === 0
                ? <li className="col-span-2 pt-2 text-muted">Nothing in view</li>
                : regionsInView.map((r) => (
                    <li key={r ?? 'none'} className="flex items-center gap-2 pt-2 min-w-0" title={r ? regionDisplayName(r) : undefined}>
                      <span className="w-2.5 h-2.5 shrink-0 rounded-[3px] ring-[1.5px] ring-white/90" style={{ backgroundColor: regionColor(r) }} aria-hidden="true" />
                      <span className="truncate">{r ? regionDisplayName(r).split(' · ').pop() : 'Not reported'}</span>
                    </li>
                  ))}
            </ul>
            <p className="px-3.5 pb-3 text-[11.5px] leading-snug text-muted">Hover or tap a bubble for its statuses.</p>
          </details>
        </div>

        {shown === 'bubbles' ? (
          <DpwhMapAreaPanel
            bubbles={bubbles}
            total={total}
            state={state}
            onZoomTo={zoomToBubble}
            onRetry={retry}
            onClearFilters={isFiltered ? clearFilters : undefined}
            className={smallView === 'map' ? 'hidden lg:flex' : 'flex'}
          />
        ) : (
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
        )}
      </div>

      <div className="grid gap-3">
        <div className="flex items-start gap-3 rounded-card bg-sunken px-4 py-3.5 text-[13px] leading-relaxed text-subtle">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
          <p>
            <span className="font-semibold text-ink">Only contracts with coordinates are mapped.</span> The rest, and the{' '}
            <Link href="/projects?source=dpwh_nep_2027" className={textLinkClass}>FY 2027 NEP proposals</Link>, are in the{' '}
            <Link href="/projects" className={textLinkClass}>directory</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
