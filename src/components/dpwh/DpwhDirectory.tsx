'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, MapPin, MapPinOff, RotateCcw, Search, SearchX } from 'lucide-react';
import {
  DPWH_CATEGORIES,
  DPWH_CATEGORY_LABELS,
  DPWH_STATUSES,
  DPWH_STATUS_LABELS,
  type DpwhContractListItem,
  type DpwhSummary,
} from '@/types/dpwh';
import { DpwhSummaryPanel } from './DpwhSummaryPanel';
import { DpwhContractDrawer } from './DpwhContractDrawer';
import { STATUS_STYLES, categoryLabel, contractMapHref, formatCount, formatDate, formatPeso, formatProgress, statusLabel } from './format';

const SORT_OPTIONS = [
  ['contract_amount-desc', 'Contract amount: high to low'],
  ['contract_amount-asc', 'Contract amount: low to high'],
  ['budget-desc', 'DPWH budget: high to low'],
  ['budget-asc', 'DPWH budget: low to high'],
  ['progress-desc', 'Reported progress: high to low'],
  ['progress-asc', 'Reported progress: low to high'],
  ['start_date-desc', 'Start date: newest first'],
  ['start_date-asc', 'Start date: oldest first'],
  ['contract_date-desc', 'Contract date: newest first'],
  ['contract_date-asc', 'Contract date: oldest first'],
  ['location-asc', 'Location: region / province A to Z'],
  ['location-desc', 'Location: region / province Z to A'],
  ['title-asc', 'Project name: A to Z'],
  ['title-desc', 'Project name: Z to A'],
] as const;

export interface Filters {
  q: string;
  region: string;
  province: string;
  municipality: string;
  category: string;
  status: string;
  office: string;
  contractor: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = {
  q: '', region: '', province: '', municipality: '', category: '', status: '', office: '', contractor: '',
  sort: 'contract_amount-desc',
};
const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const selectClass =
  'w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] focus:outline-2 focus:outline-[#2563EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]';

export function DpwhDirectory({ initialFilters }: { initialFilters?: Partial<Filters> } = {}) {
  const [summary, setSummary] = useState<DpwhSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...initialFilters }));
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DpwhContractListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Free-text inputs are debounced; selects apply immediately.
  const q = useDebounced(filters.q, 350);
  const contractor = useDebounced(filters.contractor, 350);

  useEffect(() => {
    let active = true;
    fetch('/api/dpwh/summary')
      .then(async (res) => {
        const body = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setSummary(body.summary);
        setSummaryState(body.summary ? 'ready' : 'empty');
      })
      .catch(() => active && setSummaryState('error'));
    return () => {
      active = false;
    };
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    const set = (key: string, value: string) => value.trim() && p.set(key, value.trim());
    set('q', q);
    set('contractor', contractor);
    set('region', filters.region);
    set('province', filters.province);
    set('municipality', filters.municipality);
    set('category', filters.category);
    set('status', filters.status);
    set('office', filters.office);
    p.set('sort', filters.sort);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    return p.toString();
  }, [q, contractor, filters.region, filters.province, filters.municipality, filters.category, filters.status, filters.office, filters.sort, page]);

  useEffect(() => {
    const controller = new AbortController();
    setListState('loading');
    fetch(`/api/dpwh/contracts?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setItems(body.items);
        setTotal(body.total);
        setListState('ready');
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        setListError(error.message);
        setListState('error');
      });
    return () => controller.abort();
  }, [params, reload]);

  // Dependent location options from the cached summary.
  const stats = summary?.stats;
  const regionOptions = useMemo(
    () => (stats?.by_region ?? []).filter((r) => r.value !== null).map((r) => r.value as string).sort(),
    [stats]
  );
  const provinceOptions = useMemo(() => {
    const rows = (stats?.provinces ?? []).filter((p) => !filters.region || p.region === filters.region);
    return [...new Set(rows.map((p) => p.province))].sort();
  }, [stats, filters.region]);
  const municipalityOptions = useMemo(
    () => (stats?.municipalities ?? []).filter((m) => !filters.province || m.province === filters.province).map((m) => m.municipality),
    [stats, filters.province]
  );
  const officeGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const o of stats?.offices ?? []) {
      const key = o.implementing_region ?? 'Other';
      groups.set(key, [...(groups.get(key) ?? []), o.office]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stats]);
  const hasMunicipalityData = (stats?.municipalities.length ?? 0) > 0;

  const update = (patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      // Narrowing a parent location clears children that no longer apply.
      if (patch.region !== undefined && patch.region !== prev.region) {
        next.province = '';
        next.municipality = '';
      }
      if (patch.province !== undefined && patch.province !== prev.province) next.municipality = '';
      return next;
    });
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };
  const isFiltered = JSON.stringify({ ...filters, sort: '' }) !== JSON.stringify({ ...EMPTY_FILTERS, sort: '' });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {summaryState === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-[#64748B]"><Loader2 className="w-4 h-4 animate-spin" /> Loading summary…</div>
      )}
      {summaryState === 'error' && (
        <div role="alert" className="flex items-start gap-2 p-3.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Could not load the DPWH summary. The directory below may still work.
        </div>
      )}
      {summaryState === 'empty' && (
        <div role="status" className="flex items-start gap-2 p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-[#92400E]">
          <AlertTriangle className="w-4 h-4 shrink-0" /> No DPWH data has been imported yet. An administrator needs to run the initial sync.
        </div>
      )}
      {summary && (
        <DpwhSummaryPanel
          summary={summary}
          selectedRegion={filters.region || null}
          selectedCategory={filters.category || null}
          selectedStatus={filters.status || null}
          onSelectRegion={(v) => update({ region: v ?? '' })}
          onSelectCategory={(v) => update({ category: v ?? '' })}
          onSelectStatus={(v) => update({ status: v ?? '' })}
        />
      )}

      <section aria-label="DPWH contract filters" className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search project name, contract ID, contractor, description, or implementing office"
            aria-label="Search DPWH contracts"
            maxLength={200}
            className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] text-sm focus:outline-2 focus:outline-[#2563EB]"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Region (project location)</span>
            <select className={selectClass} value={filters.region} onChange={(e) => update({ region: e.target.value })}>
              <option value="">All regions</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Province</span>
            <select className={selectClass} value={filters.province} onChange={(e) => update({ province: e.target.value })}>
              <option value="">{filters.region ? `All provinces in ${filters.region}` : 'All provinces'}</option>
              {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>City / municipality</span>
            <select
              className={selectClass}
              value={filters.municipality}
              onChange={(e) => update({ municipality: e.target.value })}
              disabled={!hasMunicipalityData}
              title={hasMunicipalityData ? undefined : 'The DPWH source does not report city or municipality.'}
            >
              <option value="">{hasMunicipalityData ? 'All cities / municipalities' : 'Not reported by source'}</option>
              {municipalityOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Category</span>
            <select className={selectClass} value={filters.category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {DPWH_CATEGORIES.map((c) => <option key={c} value={c}>{DPWH_CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Status</span>
            <select className={selectClass} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              <option value="">All statuses</option>
              {DPWH_STATUSES.map((s) => <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Implementing office</span>
            <select className={selectClass} value={filters.office} onChange={(e) => update({ office: e.target.value })}>
              <option value="">All offices</option>
              {officeGroups.map(([region, offices]) => (
                <optgroup key={region} label={region}>
                  {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Contractor (starts with)</span>
            <input
              value={filters.contractor}
              onChange={(e) => update({ contractor: e.target.value })}
              placeholder="e.g. JEJOR"
              maxLength={200}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E2E8F0] text-sm focus:outline-2 focus:outline-[#2563EB]"
            />
          </label>
          <label className="text-xs font-medium text-[#64748B] space-y-1">
            <span>Sort by</span>
            <select className={selectClass} value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
          <span aria-live="polite">
            {listState === 'ready' ? `${formatCount(total)} contract${total === 1 ? '' : 's'} match` : listState === 'loading' ? 'Searching…' : ''}
          </span>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!isFiltered}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#172B4D] font-medium hover:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset filters
          </button>
        </div>
      </section>

      <section aria-label="DPWH contracts" className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        {listState === 'error' ? (
          <div role="alert" className="p-8 text-center text-sm text-red-800 space-y-3">
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <p>Could not load contracts ({listError}).</p>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="px-3 py-2 rounded-lg border border-red-200 font-medium hover:bg-red-50">
              Try again
            </button>
          </div>
        ) : listState === 'ready' && items.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <SearchX className="w-7 h-7 mx-auto text-[#94A3B8]" />
            <p className="text-sm font-semibold text-[#172B4D]">No contracts match these filters.</p>
            {isFiltered && (
              <button type="button" onClick={resetFilters} className="text-sm font-medium text-[#2563EB] hover:underline">Reset filters</button>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto ${listState === 'loading' ? 'opacity-60' : ''}`} aria-busy={listState === 'loading'}>
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Project</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Location (reported)</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Category / status</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Contract amount</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {listState === 'loading' && items.length === 0
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}><td colSpan={5} className="px-4 py-4"><div className="h-4 rounded bg-[#F1F5F9] animate-pulse" /></td></tr>
                    ))
                  : items.map((item) => (
                      <tr key={item.contract_id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 max-w-md">
                          <button type="button" onClick={() => setSelectedId(item.contract_id)} className="text-left group">
                            <span className="block font-medium text-[#172B4D] group-hover:text-[#2563EB] group-hover:underline line-clamp-2">
                              {item.contract_name ?? item.title}
                            </span>
                            <span className="block text-xs text-[#64748B] mt-0.5">
                              {item.contract_id} · {item.implementing_office ?? 'Office not reported'}
                              {item.start_date ? ` · started ${formatDate(item.start_date)}` : ''}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#0F172A]">
                          {item.province ?? (item.provinces.length > 1 ? `${item.provinces.length} provinces` : 'Not reported')}
                          <span className="block text-[#64748B]">{item.region ?? '—'}</span>
                          {contractMapHref(item) ? (
                            <Link href={contractMapHref(item)!} className="inline-flex items-center gap-0.5 mt-1 text-[#2563EB] hover:underline">
                              <MapPin className="w-3 h-3" aria-hidden="true" /> Map
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 mt-1 text-[#94A3B8]" title="The source reports no coordinates for this contract.">
                              <MapPinOff className="w-3 h-3" aria-hidden="true" /> No coordinates
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="block text-[#0F172A]">{categoryLabel(item.category)}</span>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border ${STATUS_STYLES[item.status] ?? STATUS_STYLES.unknown}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatPeso(item.contract_amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatProgress(item.progress)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && listState !== 'error' && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#E2E8F0] text-xs text-[#64748B]">
            <span>Page {formatCount(page)} of {formatCount(pageCount)}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#E2E8F0] font-medium text-[#172B4D] hover:bg-[#F1F5F9] disabled:opacity-50">
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#E2E8F0] font-medium text-[#172B4D] hover:bg-[#F1F5F9] disabled:opacity-50">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </nav>
        )}
      </section>

      <DpwhContractDrawer contractId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
