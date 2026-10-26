'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, ChevronDown, Info, List, Loader2, Map as MapIcon, MapPin, RotateCcw, Search } from 'lucide-react';
import {
  DPWH_CATEGORIES,
  DPWH_CATEGORY_LABELS,
  DPWH_STATUS_LABELS,
  type DpwhMapPoint,
  type DpwhSummary,
} from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { controlBaseClass, panelClass, textLinkClass } from './ui';
import { MAP_STATUSES, STATUS_COLORS, formatCount, formatPeso, readableTitle } from './format';
import { StatusPill } from './StatusPill';
import { DataScopeNote } from './DataScopeNote';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import type { MapSelection, MarkerColorMode } from './DpwhLeafletMap';

const DpwhLeafletMap = dynamic(() => import('./DpwhLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-sunken flex items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading map…
    </div>
  ),
});

/** One 44px height and pill shape for every control in the toolbar. */
const toolbarSelectClass = `${controlBaseClass} w-full h-11 pl-4 pr-8 rounded-full text-sm`;
const segmentClass = (active: boolean) =>
  `inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink ${
    active ? 'bg-surface text-ink shadow-raise' : 'text-subtle hover:text-ink'
  }`;

/** The list shows the first entries of the loaded markers, which arrive largest contract first. */
const LIST_LIMIT = 100;

interface MapFilters {
  q: string;
  region: string;
  category: string;
  status: string;
}
const EMPTY: MapFilters = { q: '', region: '', category: '', status: '' };

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

export function DpwhPublicMap({ focus }: { focus: MapFocus | null }) {
  const [filters, setFilters] = useState<MapFilters>(EMPTY);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [points, setPoints] = useState<DpwhMapPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  // A ?focus= link opens on its contract already selected; the map centers on it itself, so no pan.
  const [selection, setSelection] = useState<MapSelection | null>(() => (focus?.id ? { id: focus.id, pan: false } : null));
  const [summary, setSummary] = useState<DpwhSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [colorMode, setColorMode] = useState<MarkerColorMode>('status');
  // Below the lg breakpoint the map and the list share one slot; on wide screens both show.
  const [smallView, setSmallView] = useState<'map' | 'list'>('map');
  // The legend starts folded on phones, where open it would cover much of the map.
  const [legendOpen, setLegendOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setLegendOpen(false);
  }, []);
  const listRef = useRef<HTMLUListElement | null>(null);

  const q = useDebounced(filters.q, 350);
  const debouncedBounds = useDebounced(bounds, 250);

  useEffect(() => {
    let active = true;
    fetch('/api/dpwh/summary')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
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
    fetch(`/api/dpwh/map?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setPoints(body.points);
        setTotal(body.total);
        setLimit(body.limit);
        setState('ready');
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setState('error');
      });
    return () => controller.abort();
  }, [debouncedBounds, q, filters.region, filters.category, filters.status, reload]);

  const regionOptions = useMemo(
    () => (summary?.stats.by_region ?? []).filter((r) => r.value !== null).map((r) => r.value as string).sort(),
    [summary]
  );
  const isFiltered = filters.q !== '' || filters.region !== '' || filters.category !== '' || filters.status !== '';
  const capped = state === 'ready' && total > points.length;
  const listed = points.slice(0, LIST_LIMIT);
  const selectedId = selection?.id ?? null;
  // Region legend lists only regions with markers in view, in the summary's order.
  const regionsInView = useMemo(() => {
    const present = new Set(points.map((p) => p.region));
    const ordered = (summary?.stats.by_region ?? []).map((r) => r.value).filter((r) => present.has(r));
    return present.has(null) ? [...ordered, null] : ordered;
  }, [points, summary]);

  const selectFromList = (id: string) => {
    setSelection({ id, pan: true });
    setSmallView('map');
  };
  const selectFromMarker = useCallback((id: string) => setSelection({ id, pan: false }), []);

  // A marker click highlights its entry; scroll the list (not the page) so the entry is in view.
  useEffect(() => {
    const list = listRef.current;
    if (!selection || selection.pan || !list) return;
    const item = list.querySelector<HTMLElement>(`[data-contract="${CSS.escape(selection.id)}"]`);
    if (!item) return;
    const top = item.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    }
  }, [selection]);

  const statusLine = (
    <>
      {state === 'loading' && (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Loading markers…
        </span>
      )}
      {state === 'ready' &&
        (capped ? (
          <>
            Showing the <strong className="font-semibold text-ink">{formatCount(points.length)}</strong> largest of{' '}
            <strong className="font-semibold text-ink">{formatCount(total)}</strong> mapped contracts in view (limit {formatCount(limit)}).
            Zoom in to see the rest.
          </>
        ) : (
          <>
            <strong className="font-semibold text-ink">{formatCount(total)}</strong> mapped contract{total === 1 ? '' : 's'} in view.
          </>
        ))}
      {state === 'error' && <span className="text-danger-ink">Could not load markers ({error}).</span>}
    </>
  );

  return (
    <div className="space-y-5">
      {summaryState === 'empty' && (
        <div role="status" className="flex items-start gap-2 p-3.5 rounded-card border border-warn-line bg-warn-soft text-[13px] text-warn-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> No DPWH data has been imported yet, so the map has no markers. An administrator needs to run the initial sync.
        </div>
      )}
      {summaryState === 'error' && (
        <div role="alert" className="flex items-start gap-2 p-3.5 rounded-card border border-danger-line bg-danger-soft text-[13px] text-danger-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> Could not load the data summary, so the region filter has no options. Search and the other filters still work.
        </div>
      )}

      <section aria-label="Search and filter the map" className="space-y-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 lg:flex-1">
            <span className="sr-only">Search projects on the map</span>
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search by project name, contract ID, contractor or office"
              maxLength={200}
              className={`${controlBaseClass} w-full h-11 pl-10 pr-4 rounded-full text-[15px]`}
            />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:flex lg:shrink-0">
            <select aria-label="Region" className={`${toolbarSelectClass} col-span-2 sm:col-span-1 lg:w-52`} value={filters.region}
              onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}>
              <option value="">All regions</option>
              {regionOptions.map((r) => <option key={r} value={r}>{regionDisplayName(r)}</option>)}
            </select>
            <select aria-label="Category" className={`${toolbarSelectClass} lg:w-44`} value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {DPWH_CATEGORIES.map((c) => <option key={c} value={c}>{DPWH_CATEGORY_LABELS[c]}</option>)}
            </select>
            <select aria-label="Status" className={`${toolbarSelectClass} lg:w-44`} value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {MAP_STATUSES.map((s) => <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 min-h-8 px-1">
          <p aria-live="polite" className="text-[13px] leading-snug text-muted tabular-nums">{statusLine}</p>
          <div className="flex items-center gap-1">
            {state === 'error' && (
              <button type="button" onClick={() => setReload((n) => n + 1)}
                className="inline-flex items-center h-8 px-3 rounded-full border border-danger-line text-[13px] font-medium text-danger-ink hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
                Try again
              </button>
            )}
            {isFiltered && (
              <button type="button" onClick={() => setFilters(EMPTY)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-subtle hover:text-ink hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Small screens: one slot, switched here. Both panes stay mounted so the map keeps its view. */}
      <div role="group" aria-label="Show" className="lg:hidden grid grid-cols-2 p-1 rounded-full bg-sunken">
        <button type="button" aria-pressed={smallView === 'map'} onClick={() => setSmallView('map')} className={segmentClass(smallView === 'map')}>
          <MapIcon className="w-4 h-4" aria-hidden="true" /> Map
        </button>
        <button type="button" aria-pressed={smallView === 'list'} onClick={() => setSmallView('list')} className={segmentClass(smallView === 'list')}>
          <List className="w-4 h-4" aria-hidden="true" /> List
          {state === 'ready' && <span className="tabular-nums text-muted">{formatCount(listed.length)}</span>}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(21rem,3fr)] lg:h-[clamp(34rem,calc(100dvh-12rem),46rem)]">
        <div
          className={`map-frame relative h-[min(68dvh,32rem)] min-h-[22rem] lg:h-full lg:min-h-0 rounded-card overflow-hidden border border-line bg-sunken ${
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
          />
          <div role="group" aria-label="Colour markers by" className="absolute right-3 top-3 z-[450] inline-flex items-center gap-0.5 p-1 rounded-full glass-strong border border-line shadow-raise">
            {(['status', 'region'] as const).map((mode) => (
              <button key={mode} type="button" aria-pressed={colorMode === mode} onClick={() => setColorMode(mode)}
                className={`h-8 px-3 rounded-full text-[13px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink ${
                  colorMode === mode ? 'bg-ink text-on-ink' : 'text-subtle hover:text-ink'
                }`}>
                {mode === 'status' ? 'By status' : 'By region'}
              </button>
            ))}
          </div>
          {/* Above the tiles, below Leaflet's own controls; clears the attribution line. */}
          <details
            open={legendOpen}
            onToggle={(e) => setLegendOpen(e.currentTarget.open)}
            className="group absolute left-3 bottom-10 sm:bottom-8 z-[450] max-w-[calc(100%-1.5rem)] sm:max-w-[min(36rem,calc(100%-1.5rem))] rounded-control glass-strong border border-line shadow-raise text-xs text-ink">
            <summary className="flex items-center gap-1.5 h-8 px-3 cursor-pointer list-none rounded-control font-semibold [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink">
              Legend <span className="font-normal text-muted">· {colorMode === 'status' ? 'reported status' : 'region'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul
              aria-label={colorMode === 'status' ? 'Marker colours: status' : 'Marker colours: region'}
              className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 max-h-36 overflow-y-auto overscroll-contain px-3 pb-2.5"
            >
              {colorMode === 'status'
                ? MAP_STATUSES.map((s) => (
                    <li key={s} className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 shrink-0 rounded-full border border-white shadow-sm" style={{ backgroundColor: STATUS_COLORS[s] }} aria-hidden="true" />
                      {DPWH_STATUS_LABELS[s]}
                    </li>
                  ))
                : regionsInView.length === 0
                  ? <li className="text-muted">No markers in view</li>
                  : regionsInView.map((r) => (
                      <li key={r ?? 'none'} className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 shrink-0 rounded-[3px] border border-white shadow-sm" style={{ backgroundColor: regionColor(r) }} aria-hidden="true" />
                        {r ? regionDisplayName(r) : 'Region not reported'}
                      </li>
                    ))}
            </ul>
          </details>
        </div>

        <section
          aria-labelledby="map-list-title"
          className={`${panelClass} min-w-0 flex-col overflow-hidden lg:min-h-0 ${smallView === 'map' ? 'hidden lg:flex' : 'flex'}`}
        >
          <header className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-line">
            <div className="flex items-start justify-between gap-3">
              <h2 id="map-list-title" className="text-[15px] font-semibold tracking-tight text-ink">Largest contracts in view</h2>
              <Link href="/projects" className={`${textLinkClass} inline-flex items-center gap-1 shrink-0 text-[13px] font-medium`}>
                Full directory <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-0.5 text-xs text-muted tabular-nums">
              {state === 'ready' && points.length > 0
                ? `By contract amount · ${points.length > listed.length ? `top ${formatCount(listed.length)} of ${formatCount(points.length)} on the map` : `${formatCount(listed.length)} on the map`}`
                : 'By contract amount, for the area the map shows'}
            </p>
          </header>

          {state === 'ready' && points.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
              <MapPin className="w-5 h-5 text-muted" aria-hidden="true" />
              <p className="text-sm text-subtle max-w-[18rem]">No mapped contracts match in this area. Zoom out, move the map, or reset the filters.</p>
            </div>
          ) : state === 'error' && points.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-danger-ink">Could not load contracts for this area.</p>
              <button type="button" onClick={() => setReload((n) => n + 1)}
                className="inline-flex items-center h-8 px-3 rounded-full border border-line-strong text-[13px] font-medium text-ink hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
                Try again
              </button>
            </div>
          ) : points.length === 0 ? (
            <ul aria-label="Loading contracts" className="flex-1 divide-y divide-line">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="px-4 sm:px-5 py-4 space-y-2 animate-pulse">
                  <div className="h-3 w-24 rounded bg-sunken" />
                  <div className="h-3.5 w-full rounded bg-sunken" />
                  <div className="h-3.5 w-2/3 rounded bg-sunken" />
                </li>
              ))}
            </ul>
          ) : (
            <ul
              ref={listRef}
              aria-busy={state === 'loading'}
              className={`flex-1 min-h-0 lg:overflow-y-auto overscroll-contain divide-y divide-line transition-opacity ${state === 'loading' ? 'opacity-60' : ''}`}
            >
              {listed.map((p) => {
                const name = p.contract_name ?? p.title;
                const selected = selectedId === p.contract_id;
                return (
                  <li key={p.contract_id} data-contract={p.contract_id}>
                    <button
                      type="button"
                      onClick={() => selectFromList(p.contract_id)}
                      aria-current={selected ? 'true' : undefined}
                      className={`group/item relative w-full text-left px-4 sm:px-5 py-3.5 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink ${
                        selected ? 'bg-sunken before:absolute before:left-0 before:inset-y-2 before:w-[3px] before:rounded-r-full before:bg-ink' : ''
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[11.5px] tabular-nums text-muted">{p.contract_id}</span>
                        <StatusPill status={p.status} size="sm" />
                      </span>
                      <span className="mt-1.5 block text-[14px] font-medium leading-[1.4] text-ink break-words line-clamp-3" title={name}>
                        {readableTitle(name)}
                      </span>
                      <span className="mt-2 flex items-baseline justify-between gap-3">
                        <span className="inline-flex items-center gap-1 min-w-0 text-xs text-muted">
                          <MapPin className="w-3 h-3 shrink-0 translate-y-px" aria-hidden="true" />
                          <span className="truncate">{p.province ?? (p.region ? regionDisplayName(p.region) : 'Location not reported')}</span>
                        </span>
                        <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{formatPeso(p.contract_amount)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {points.length > listed.length && (
                <li className="px-4 sm:px-5 py-3.5 text-xs leading-relaxed text-muted">
                  {formatCount(points.length - listed.length)} more on the map. Zoom in, or{' '}
                  <Link href="/projects" className={textLinkClass}>browse the full directory</Link>.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-3">
        <p className="flex items-start gap-2.5 px-4 text-[13px] leading-relaxed text-subtle">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted" aria-hidden="true" />
          <span>
            Only contracts with DPWH-reported coordinates appear on the map; contracts without coordinates are listed in
            the <Link href="/projects" className={textLinkClass}>project directory</Link>, as are FY 2027 NEP budget
            proposals, which the source publishes <Link href="/projects?source=dpwh_nep_2027" className={textLinkClass}>without coordinates</Link>.
            Locations are as reported by DPWH and have not been field-verified by the LGU.
          </span>
        </p>
        {summaryState !== 'loading' && <DataScopeNote summary={summary} />}
      </div>
    </div>
  );
}
