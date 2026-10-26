'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AlertTriangle, List, Loader2, MapPin, RotateCcw, Search } from 'lucide-react';
import {
  DPWH_CATEGORIES,
  DPWH_CATEGORY_LABELS,
  DPWH_STATUS_LABELS,
  type DpwhMapPoint,
  type DpwhSummary,
} from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { controlBaseClass, controlClass, panelClass } from './ui';
import { MAP_STATUSES, STATUS_COLORS, formatCount, formatPeso, statusColor, statusLabel } from './format';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import type { MarkerColorMode } from './DpwhLeafletMap';

const DpwhLeafletMap = dynamic(() => import('./DpwhLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] bg-sunken flex items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading map…
    </div>
  ),
});

const selectClass = controlClass;

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<DpwhSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [colorMode, setColorMode] = useState<MarkerColorMode>('status');

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
  const listed = points.slice(0, 100);
  // Region legend lists only regions with markers in view, in the summary's order.
  const regionsInView = useMemo(() => {
    const present = new Set(points.map((p) => p.region));
    const ordered = (summary?.stats.by_region ?? []).map((r) => r.value).filter((r) => present.has(r));
    return present.has(null) ? [...ordered, null] : ordered;
  }, [points, summary]);

  return (
    <div className="space-y-4">
      {summaryState === 'empty' && (
        <div role="status" className="flex items-start gap-2 p-3.5 rounded-card border border-warn-line bg-warn-soft text-xs text-warn-ink">
          <AlertTriangle className="w-4 h-4 shrink-0" /> No DPWH data has been imported yet, so the map has no markers. An administrator needs to run the initial sync.
        </div>
      )}

      <section aria-label="Map filters" className={`${panelClass} p-4 sm:p-5 space-y-3`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-5">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search project name, contract ID, contractor, or office"
              aria-label="Search projects on the map"
              maxLength={200}
              className={`${controlBaseClass} w-full h-10 pl-9 pr-3 rounded-full text-sm`}
            />
          </div>
          <select aria-label="Region" className={`${selectClass} lg:col-span-3`} value={filters.region}
            onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}>
            <option value="">All regions</option>
            {regionOptions.map((r) => <option key={r} value={r}>{regionDisplayName(r)}</option>)}
          </select>
          <select aria-label="Category" className={`${selectClass} lg:col-span-2`} value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All categories</option>
            {DPWH_CATEGORIES.map((c) => <option key={c} value={c}>{DPWH_CATEGORY_LABELS[c]}</option>)}
          </select>
          <select aria-label="Status" className={`${selectClass} lg:col-span-2`} value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All statuses</option>
            {MAP_STATUSES.map((s) => <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span aria-live="polite" className="tabular-nums">
            {state === 'loading' && <span className="inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading markers…</span>}
            {state === 'ready' && (capped
              ? <>Showing the <strong className="text-ink">{formatCount(points.length)}</strong> largest of <strong className="text-ink">{formatCount(total)}</strong> mapped contracts in view (limit {formatCount(limit)}). Zoom in to see the rest.</>
              : <><strong className="text-ink">{formatCount(total)}</strong> mapped contract{total === 1 ? '' : 's'} in view.</>)}
            {state === 'error' && <span className="text-danger-ink">Could not load markers ({error}).</span>}
          </span>
          <div className="flex items-center gap-2">
            {state === 'error' && (
              <button type="button" onClick={() => setReload((n) => n + 1)} className="px-3 py-1.5 rounded-full border border-danger-line text-danger-ink font-medium hover:bg-danger-soft">Try again</button>
            )}
            <button type="button" onClick={() => setFilters(EMPTY)} disabled={!isFiltered}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-ink font-medium hover:bg-sunken disabled:opacity-50 disabled:cursor-not-allowed">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-2">
          <div className="relative h-[480px] sm:h-[620px] w-full rounded-card overflow-hidden border border-line">
            <DpwhLeafletMap points={points} focus={focus} selectedId={selectedId} onBoundsChange={setBounds} colorMode={colorMode} />
            <div role="group" aria-label="Colour markers by" className="absolute right-3 top-3 z-[450] inline-flex items-center gap-1 p-1 rounded-full glass-strong border border-line shadow-raise">
              {(['status', 'region'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={colorMode === mode}
                  onClick={() => setColorMode(mode)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink ${
                    colorMode === mode ? 'bg-ink text-on-ink' : 'text-subtle hover:text-ink'
                  }`}
                >
                  {mode === 'status' ? 'By status' : 'By region'}
                </button>
              ))}
            </div>
            {/* Legend floats on the map; above the tiles, below Leaflet's own controls. */}
            <ul
              aria-label={colorMode === 'status' ? 'Marker legend: status' : 'Marker legend: region'}
              className="absolute left-3 bottom-3 z-[450] grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 max-w-[calc(100%-1.5rem)] max-h-[40%] overflow-y-auto px-3 py-2 rounded-card glass-strong border border-line shadow-raise text-xs text-ink"
            >
              {colorMode === 'status'
                ? MAP_STATUSES.map((s) => (
                    <li key={s} className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: STATUS_COLORS[s] }} aria-hidden="true" />
                      {DPWH_STATUS_LABELS[s]}
                    </li>
                  ))
                : regionsInView.length === 0
                  ? <li className="text-muted">No markers in view</li>
                  : regionsInView.map((r) => (
                      <li key={r ?? 'none'} className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[3px] border border-white shadow-sm" style={{ backgroundColor: regionColor(r) }} aria-hidden="true" />
                        {r ? regionDisplayName(r) : 'Region not reported'}
                      </li>
                    ))}
            </ul>
          </div>
          <p className="text-xs text-muted">
            The map shows DPWH contracts with reported coordinates. FY 2027 NEP budget proposals are not mapped: the source
            gives no coordinates for them. They are listed in the <Link href="/projects?source=dpwh_nep_2027" className="underline underline-offset-2 hover:text-ink">directory</Link>.
          </p>
        </div>

        <section aria-label="Contracts in view" className={`lg:col-span-4 ${panelClass} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Largest contracts in view</h2>
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
              <List className="w-3.5 h-3.5" /> Full directory
            </Link>
          </div>
          {state === 'ready' && points.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted">
              No mapped contracts match in this area. Zoom out, move the map, or reset the filters.
            </p>
          ) : (
            <ul className="max-h-[560px] overflow-y-auto divide-y divide-line">
              {listed.map((p) => (
                <li key={p.contract_id}>
                  <button type="button" onClick={() => setSelectedId(p.contract_id)}
                    className={`w-full text-left px-4 py-3 hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink ${selectedId === p.contract_id ? 'bg-sunken' : ''}`}>
                    <span className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="tabular-nums font-semibold text-ink">{p.contract_id}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-subtle">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(p.status) }} aria-hidden="true" />
                        {statusLabel(p.status)}
                      </span>
                    </span>
                    <span className="block text-sm font-medium text-ink line-clamp-2 mt-0.5">{p.contract_name ?? p.title}</span>
                    <span className="flex items-center justify-between gap-2 mt-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{p.province ?? p.region ?? 'Location not reported'}</span>
                      <span className="tabular-nums font-semibold text-ink shrink-0">{formatPeso(p.contract_amount)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {points.length > listed.length && (
                <li className="px-4 py-3 text-xs text-muted">
                  {formatCount(points.length - listed.length)} more on the map. Zoom in or use the directory to browse all.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        Only contracts with DPWH-reported coordinates appear on the map; contracts without coordinates are still listed
        in the <Link href="/projects" className="text-accent-ink hover:underline">project directory</Link>. Coordinates are
        as reported by DPWH and have not been field-verified by the LGU.
      </p>
    </div>
  );
}
