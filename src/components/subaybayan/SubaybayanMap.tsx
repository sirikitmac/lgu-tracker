'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ChevronDown, Info, List, Loader2, Map as MapIcon, MapPin } from 'lucide-react';
import { errorMessage, fetchJson } from '@/lib/http';
import { useToast } from '@/components/ui/Toast';
import { formatCount } from '@/components/dpwh/format';
import { textLinkClass } from '@/components/dpwh/ui';
import {
  SUBAYBAYAN_CATEGORIES,
  SUBAYBAYAN_CATEGORY_COLORS,
  SUBAYBAYAN_CATEGORY_SHORT,
} from '@/lib/subaybayan/categories';
import {
  CATEGORY_DETAIL_FILTERS,
  DETAIL_LABELS,
  EMPTY_FILTERS,
  filtersToParams,
  type FacetsPayload,
  type PointsPayload,
  type SubaybayanDetail,
  type SubaybayanFilters,
} from '@/lib/subaybayan/query';
import { SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';
import { SubaybayanFilterBar } from './SubaybayanFilters';
import { SubaybayanPanel, type ListMode, type PanelMode } from './SubaybayanPanel';
import type { MapBounds } from './SubaybayanLeafletMap';

const SubaybayanLeafletMap = dynamic(() => import('./SubaybayanLeafletMap'), {
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

/** Which active filters to loosen, as a sentence for the empty state. */
function emptyHint(f: SubaybayanFilters): string | null {
  const active: string[] = [];
  if (f.q.trim()) active.push('the search');
  if (f.category) active.push('the category');
  for (const k of f.category ? CATEGORY_DETAIL_FILTERS[f.category] : []) if (f[k]) active.push(DETAIL_LABELS[k].toLowerCase());
  if (f.source) active.push('the source');
  if (f.city) active.push('the city / municipality');
  else if (f.province) active.push('the province');
  else if (f.region) active.push('the region');
  if (f.year !== null) active.push('the funding year');
  if (f.status) active.push('the status');
  if (!active.length) return null;
  const list = active.length === 1 ? active[0] : `${active.slice(0, -1).join(', ')} or ${active[active.length - 1]}`;
  return `Try loosening ${list}.`;
}

export function SubaybayanMap({ initialFilters, focusId = null }: { initialFilters: SubaybayanFilters; focusId?: string | null }) {
  const [filters, setFilters] = useState<SubaybayanFilters>(initialFilters);
  const [points, setPoints] = useState<PointsPayload | null>(null);
  const [facets, setFacets] = useState<FacetsPayload | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [mode, setMode] = useState<PanelMode>({ kind: 'list' });
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [smallView, setSmallView] = useState<'map' | 'list'>('map');
  const [legendOpen, setLegendOpen] = useState(true);
  const { toast } = useToast();
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setLegendOpen(false);
  }, []);

  const q = useDebounced(filters.q, 350);
  const effective = useMemo(() => ({ ...filters, q }), [filters, q]);
  const query = filtersToParams(effective).toString();

  // Keep the address bar in step (shareable links), without a server round trip.
  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set('layer', 'subaybayan');
    window.history.replaceState(null, '', `/projects/map?${params.toString()}`);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    const suffix = query ? `?${query}` : '';
    Promise.all([
      fetchJson<PointsPayload>(`/api/subaybayan/points${suffix}`, { signal: controller.signal }),
      fetchJson<FacetsPayload>(`/api/subaybayan/facets${suffix}`, { signal: controller.signal }),
    ])
      .then(([p, f]) => {
        setPoints(p);
        setFacets(f);
        setState('ready');
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setError(errorMessage(e, 'Could not load LGU projects. Please try again.'));
        setState('error');
      });
    return () => controller.abort();
  }, [query, reload]);

  // Filters changed: back to the list (a stack or detail may no longer match).
  const firstQuery = useRef(true);
  useEffect(() => {
    if (firstQuery.current) {
      firstQuery.current = false;
      return;
    }
    setMode({ kind: 'list' });
  }, [query]);

  const positions = useMemo(() => {
    const m = new Map<string, number>();
    if (points) points.columns.id.forEach((id, i) => m.set(id, i));
    return m;
  }, [points]);

  // Projects in view, largest cost first (projects without a cost last); unmapped ones listed separately.
  const { inViewIds, unmappedIds } = useMemo(() => {
    if (!points) return { inViewIds: [] as string[], unmappedIds: [] as string[] };
    const c = points.columns;
    const inView: number[] = [];
    const unmapped: string[] = [];
    for (let i = 0; i < points.rows; i++) {
      const lat = c.lat[i];
      const lng = c.lng[i];
      if (lat === null || lng === null) {
        unmapped.push(c.id[i]);
        continue;
      }
      if (!bounds || (lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east)) inView.push(i);
    }
    // Unverified totals (extreme for their kind of project) rank after every verified one.
    inView.sort((a, b) => (c.review[a] ?? 0) - (c.review[b] ?? 0) || (c.cost[b] ?? -1) - (c.cost[a] ?? -1));
    return { inViewIds: inView.map((i) => c.id[i]), unmappedIds: unmapped };
  }, [points, bounds]);

  const selectedId = mode.kind === 'detail' ? mode.id : null;
  const listMode: ListMode = mode.kind === 'detail' ? mode.back : mode;

  const openDetail = useCallback(
    (id: string, pan: boolean) => {
      setMode((m) => ({ kind: 'detail', id, back: m.kind === 'detail' ? m.back : m }));
      const i = positions.get(id);
      if (pan && i !== undefined && points) {
        const lat = points.columns.lat[i];
        const lng = points.columns.lng[i];
        if (lat !== null && lng !== null) setFocus({ lat, lng });
      }
    },
    [positions, points]
  );
  // ?focus=<id> (e.g. the directory's Map link): open that project once the points are in, and fly to it.
  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focusId || focusHandled.current || !points) return;
    focusHandled.current = true;
    const i = positions.get(focusId);
    setMode({ kind: 'detail', id: focusId, back: { kind: 'list' } });
    if (i === undefined) return;
    const lat = points.columns.lat[i];
    const lng = points.columns.lng[i];
    if (lat !== null && lng !== null) setFocus({ lat, lng, zoom: 14 });
  }, [focusId, points, positions]);

  const selectFromMarker = useCallback(
    (id: string) => {
      openDetail(id, false);
      setSmallView('list');
    },
    [openDetail]
  );
  const showStack = useCallback((ids: string[]) => {
    setMode({ kind: 'stack', ids });
    setSmallView('list');
  }, []);
  const locate = useCallback((p: SubaybayanDetail) => {
    if (p.latitude === null || p.longitude === null) return;
    setFocus({ lat: p.latitude, lng: p.longitude, zoom: 14 });
    setSmallView('map');
  }, []);

  const isFiltered = filtersToParams(filters).toString() !== '';
  const changeFilters = useCallback(
    (next: SubaybayanFilters) => {
      setFilters(next);
      if (filtersToParams(next).toString() === '' && isFiltered) {
        toast({ id: 'sb-filters', tone: 'info', title: 'Search and filters cleared', description: 'Showing every LGU project in the snapshot.' });
      }
    },
    [isFiltered, toast]
  );
  const retry = useCallback(() => setReload((n) => n + 1), []);

  const mapped = points ? points.rows - points.counts.unmapped : 0;
  const resultLine =
    state === 'loading' && !points ? (
      <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Loading LGU projects…</span>
    ) : state === 'error' ? (
      <span className="text-danger-ink">{error}</span>
    ) : points ? (
      <>
        {state === 'loading' && <Loader2 className="inline w-3.5 h-3.5 mr-1.5 animate-spin align-[-2px]" aria-hidden="true" />}
        <strong className="font-semibold text-ink">{formatCount(points.total)}</strong> matching project{points.total === 1 ? '' : 's'} ·{' '}
        <strong className="font-semibold text-ink">{formatCount(mapped)}</strong> on the map
        {!filters.approx && points.counts.approximate > 0 && <> · {formatCount(points.counts.approximate)} approximate hidden</>}
        {points.counts.unmapped > 0 && <> · {formatCount(points.counts.unmapped)} unmapped (listed only)</>}
      </>
    ) : (
      'Loading LGU projects…'
    );

  return (
    <div className="space-y-5">
      <SubaybayanFilterBar
        filters={filters}
        facets={facets}
        onChange={changeFilters}
        resultLine={resultLine}
        trailing={
          state === 'error' ? (
            <button type="button" onClick={retry} className={`inline-flex items-center h-8 px-3 rounded-full border border-danger-line text-[13px] font-semibold text-danger-ink hover:bg-danger-soft ${focusRing}`}>
              Try again
            </button>
          ) : undefined
        }
      />

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
          <SubaybayanLeafletMap
            points={points}
            selectedId={selectedId}
            stackIds={listMode.kind === 'stack' ? listMode.ids : null}
            onSelect={selectFromMarker}
            onStack={showStack}
            onBoundsChange={setBounds}
            focus={focus}
          />

          <div aria-hidden="true" className="hidden sm:block pointer-events-none absolute left-1/2 -translate-x-1/2 top-3 z-[440]">
            {state === 'loading' && (
              <span className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium text-subtle ${floatClass}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating markers…
              </span>
            )}
          </div>

          {state === 'error' && !points && (
            <div className="absolute inset-0 z-[445] grid place-items-center p-6 pointer-events-none">
              <div role="alert" className={`pointer-events-auto max-w-xs rounded-card px-5 py-4 text-center ${floatClass}`}>
                <AlertTriangle className="mx-auto w-5 h-5 text-danger-ink" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink">LGU projects could not be loaded</p>
                <p className="mt-1 text-xs text-subtle">The map tiles still work. Check the connection and try again.</p>
                <button type="button" onClick={retry} className={`mt-3 inline-flex items-center h-9 px-4 rounded-full bg-ink text-on-ink text-[13px] font-semibold hover:bg-ink-soft ${focusRing}`}>
                  Try again
                </button>
              </div>
            </div>
          )}
          {state === 'ready' && points && mapped === 0 && (
            <div className="absolute inset-0 z-[445] grid place-items-center p-6 pointer-events-none">
              <p className={`inline-flex items-center gap-2 min-h-10 px-4 py-2 rounded-full text-[13px] font-medium text-subtle text-center ${floatClass}`}>
                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> No mapped LGU projects match{emptyHint(filters) ? ` · ${emptyHint(filters)}` : ''}
              </p>
            </div>
          )}

          <details
            open={legendOpen}
            onToggle={(e) => setLegendOpen(e.currentTarget.open)}
            className={`group absolute left-3 bottom-9 z-[450] w-max max-w-[calc(100%-1.5rem)] sm:max-w-[21rem] rounded-2xl text-xs text-ink ${floatClass}`}
          >
            <summary className={`flex items-center gap-2 h-9 pl-3.5 pr-3 cursor-pointer list-none rounded-2xl [&::-webkit-details-marker]:hidden ${focusRing} focus-visible:outline-offset-1`}>
              <span className="font-semibold">Legend</span>
              <span className="text-muted">Category · location</span>
              <ChevronDown className="ml-auto w-3.5 h-3.5 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3.5 pt-1 pb-3 border-t border-line/70 max-h-64 overflow-y-auto overscroll-contain">
              <ul aria-label="Marker colours: category" className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
                {SUBAYBAYAN_CATEGORIES.map((c) => (
                  <li key={c} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 shrink-0 rounded-full ring-[1.5px] ring-white/90" style={{ backgroundColor: SUBAYBAYAN_CATEGORY_COLORS[c] }} aria-hidden="true" />
                    <span className="truncate">{SUBAYBAYAN_CATEGORY_SHORT[c]}</span>
                  </li>
                ))}
              </ul>
              <ul aria-label="Marker shapes: location" className="mt-3 pt-2.5 border-t border-line/70 space-y-1.5">
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--color-subtle)" stroke="#fff" strokeWidth="1.5" /></svg>
                  Barangay area centre
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--color-subtle)" fillOpacity="0.18" stroke="var(--color-subtle)" strokeWidth="1.6" strokeDasharray="2.5 2.5" /></svg>
                  Municipality / province centre (approximate)
                </li>
                <li className="flex items-center gap-2">
                  <span className="grid place-items-center w-[18px] h-[18px] rounded-full bg-[conic-gradient(#2563EB_0_50%,#16A34A_50%_75%,#D97706_75%)] p-[2.5px]" aria-hidden="true">
                    <span className="w-full h-full rounded-full bg-surface" />
                  </span>
                  Cluster (ring = category mix)
                </li>
              </ul>
              <p className="mt-2.5 text-[11px] leading-snug text-muted">All locations are approximate area centroids, not project sites.</p>
            </div>
          </details>
        </div>

        <SubaybayanPanel
          state={state}
          counts={points?.counts ?? null}
          total={points?.total ?? 0}
          approxShown={filters.approx}
          inViewIds={inViewIds}
          unmappedIds={unmappedIds}
          mode={mode}
          selectedId={selectedId}
          onMode={setMode}
          onSelect={(id) => openDetail(id, true)}
          onLocate={locate}
          onRetry={retry}
          emptyHint={emptyHint(filters)}
          onClearFilters={isFiltered ? () => changeFilters(EMPTY_FILTERS) : undefined}
          className={smallView === 'map' ? 'hidden lg:flex' : 'flex'}
        />
      </div>

      <div className="flex items-start gap-3 rounded-card bg-sunken px-4 py-3.5 text-[13px] leading-relaxed text-subtle">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
        <div className="space-y-1.5">
          <p>
            <span className="font-semibold text-ink">Locations are area centroids, not project sites.</span> SubayBAYAN lists a barangay, city/municipality or
            province but no coordinates, so each project is placed at the centre of that area (PSGC boundaries). Many projects can share one point.
          </p>
          <p>
            Categories are LGU Tracker&apos;s own keyword classification, not an official DILG category. Data is a snapshot retrieved {SUBAYBAYAN_RETRIEVED_LABEL} from{' '}
            <a href={SUBAYBAYAN_DATASET_INFO.lgsf.url} target="_blank" rel="noopener noreferrer" className={textLinkClass}>Locally Funded Projects</a> and{' '}
            <a href={SUBAYBAYAN_DATASET_INFO.rlip.url} target="_blank" rel="noopener noreferrer" className={textLinkClass}>LIME 20% DF</a> on DILG SubayBAYAN; check the
            portal for the latest status. Boundaries: NAMRIA/PSA via OCHA (CC BY-IGO), packaged by faeldon/philippines-json-maps (MIT).
          </p>
        </div>
      </div>
    </div>
  );
}
