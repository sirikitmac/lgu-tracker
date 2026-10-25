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
import { MAP_STATUSES, STATUS_COLORS, formatCount, formatPeso, statusColor, statusLabel, statusTextColor } from './format';

const DpwhLeafletMap = dynamic(() => import('./DpwhLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] flex items-center justify-center gap-2 text-sm text-[#64748B]">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading map…
    </div>
  ),
});

const selectClass =
  'w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] focus:outline-2 focus:outline-[#2563EB]';

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

  return (
    <div className="space-y-4">
      {summaryState === 'empty' && (
        <div role="status" className="flex items-start gap-2 p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-[#92400E]">
          <AlertTriangle className="w-4 h-4 shrink-0" /> No DPWH data has been imported yet, so the map has no markers. An administrator needs to run the initial sync.
        </div>
      )}

      <section aria-label="Map filters" className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-5">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search project name, contract ID, contractor, or office"
              aria-label="Search projects on the map"
              maxLength={200}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] text-sm focus:outline-2 focus:outline-[#2563EB]"
            />
          </div>
          <select aria-label="Region" className={`${selectClass} lg:col-span-3`} value={filters.region}
            onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}>
            <option value="">All regions</option>
            {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
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
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
          <span aria-live="polite" className="tabular-nums">
            {state === 'loading' && <span className="inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading markers…</span>}
            {state === 'ready' && (capped
              ? <>Showing the <strong className="text-[#0F172A]">{formatCount(points.length)}</strong> largest of <strong className="text-[#0F172A]">{formatCount(total)}</strong> mapped contracts in view (limit {formatCount(limit)}). Zoom in to see the rest.</>
              : <><strong className="text-[#0F172A]">{formatCount(total)}</strong> mapped contract{total === 1 ? '' : 's'} in view.</>)}
            {state === 'error' && <span className="text-red-700">Could not load markers ({error}).</span>}
          </span>
          <div className="flex items-center gap-2">
            {state === 'error' && (
              <button type="button" onClick={() => setReload((n) => n + 1)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-800 font-medium hover:bg-red-50">Try again</button>
            )}
            <button type="button" onClick={() => setFilters(EMPTY)} disabled={!isFiltered}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#172B4D] font-medium hover:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-2">
          <div className="h-[480px] sm:h-[620px] w-full">
            <DpwhLeafletMap points={points} focus={focus} selectedId={selectedId} onBoundsChange={setBounds} />
          </div>
          <ul aria-label="Marker legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
            {MAP_STATUSES.map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-white shadow" style={{ backgroundColor: STATUS_COLORS[s] }} />
                {DPWH_STATUS_LABELS[s]}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#94A3B8]">
            The map shows DPWH contracts with reported coordinates. FY 2027 NEP budget proposals are not mapped: the source
            gives no coordinates for them. They are listed in the <Link href="/projects?source=dpwh_nep_2027" className="underline hover:text-[#2563EB]">directory</Link>.
          </p>
        </div>

        <section aria-label="Contracts in view" className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-[#172B4D]">Largest contracts in view</h2>
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline">
              <List className="w-3.5 h-3.5" /> Full directory
            </Link>
          </div>
          {state === 'ready' && points.length === 0 ? (
            <p className="p-6 text-sm text-center text-[#64748B]">
              No mapped contracts match in this area. Zoom out, move the map, or reset the filters.
            </p>
          ) : (
            <ul className="max-h-[560px] overflow-y-auto divide-y divide-[#E2E8F0]">
              {listed.map((p) => (
                <li key={p.contract_id}>
                  <button type="button" onClick={() => setSelectedId(p.contract_id)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#F8FAFC] ${selectedId === p.contract_id ? 'bg-[#F1F5F9]' : ''}`}>
                    <span className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono font-semibold text-[#172B4D]">{p.contract_id}</span>
                      <span className="inline-flex items-center gap-1 font-semibold" style={{ color: statusTextColor(p.status) }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(p.status) }} />
                        {statusLabel(p.status)}
                      </span>
                    </span>
                    <span className="block text-sm font-medium text-[#0F172A] line-clamp-2 mt-0.5">{p.contract_name ?? p.title}</span>
                    <span className="flex items-center justify-between gap-2 mt-1 text-xs text-[#64748B]">
                      <span className="inline-flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{p.province ?? p.region ?? 'Location not reported'}</span>
                      <span className="tabular-nums font-semibold text-[#0F172A] shrink-0">{formatPeso(p.contract_amount)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {points.length > listed.length && (
                <li className="px-4 py-3 text-xs text-[#64748B]">
                  {formatCount(points.length - listed.length)} more on the map. Zoom in or use the directory to browse all.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-[#64748B] leading-relaxed">
        Only contracts with DPWH-reported coordinates appear on the map; contracts without coordinates are still listed
        in the <Link href="/projects" className="text-[#2563EB] hover:underline">project directory</Link>. Coordinates are
        as reported by DPWH and have not been field-verified by the LGU.
      </p>
    </div>
  );
}
