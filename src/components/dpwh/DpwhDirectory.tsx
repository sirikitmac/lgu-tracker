'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, LayoutGrid, List, RotateCcw, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import type { ColumnVisibilityState as VisibilityState, PaginationState } from '@tanstack/react-table';
import {
  DPWH_CATEGORIES,
  DPWH_CATEGORY_LABELS,
  DPWH_STATUSES,
  DPWH_STATUS_LABELS,
  type DpwhSummary,
  type ProjectListItem,
} from '@/types/dpwh';
import { PROJECT_SOURCES, PROJECT_SOURCE_IDS, sourceLabel } from '@/lib/integrations/bettergov/sources';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { DpwhSummaryPanel } from './DpwhSummaryPanel';
import { DataScopeNote } from './DataScopeNote';
import { DpwhContractDrawer } from './DpwhContractDrawer';
import { ColumnToggle, DEFAULT_COLUMN_VISIBILITY, DirectoryPager, DpwhProjectTable, PAGE_SIZE_OPTIONS, useDirectoryTable } from './DpwhProjectTable';
import { DpwhProjectCard, DpwhProjectCardSkeleton } from './DpwhProjectCard';
import { assignCardImages, creditsFor, recordKey } from './categoryImages';
import { categoryLabel, formatCount, statusLabel } from './format';
import { controlBaseClass, controlClass, panelClass, secondaryButtonLgClass, secondaryButtonSmClass } from './ui';

export const SORT_OPTIONS = [
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
  source: string;
  sort: string;
}

export type DirectoryView = 'list' | 'grid';

export interface DirectoryInitialState {
  filters?: Partial<Filters>;
  view?: DirectoryView;
  /** 1-based, as in the URL. */
  page?: number;
  pageSize?: number;
}

const EMPTY_FILTERS: Filters = {
  q: '', region: '', province: '', municipality: '', category: '', status: '', office: '', contractor: '', source: '',
  sort: 'contract_amount-desc',
};
const DEFAULT_PAGE_SIZE = 25;
// v2: the grid became the default; choices saved while the table was the default are not carried over.
const VIEW_STORAGE_KEY = 'lgu-tracker:directory-view:v2';
const COLUMNS_STORAGE_KEY = 'lgu-tracker:directory-columns';
const FILTER_KEYS = ['region', 'province', 'municipality', 'category', 'status', 'office', 'contractor', 'source'] as const;
const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  region: 'Region', province: 'Province', municipality: 'City / municipality', category: 'Category',
  status: 'Status', office: 'Office', contractor: 'Contractor', source: 'Source',
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Case is handled by the database (ILIKE); runs of spaces collapse so "  san   juan " finds "san juan". */
const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block mb-1.5 text-xs font-medium text-subtle">{label}</span>
      {children}
    </label>
  );
}

export function DpwhDirectory({ initial, showSummary = false }: { initial?: DirectoryInitialState; showSummary?: boolean } = {}) {
  const [summary, setSummary] = useState<DpwhSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...initial?.filters }));
  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: Math.max(0, (initial?.page ?? 1) - 1),
    pageSize: initial?.pageSize ?? DEFAULT_PAGE_SIZE,
  }));
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_COLUMN_VISIBILITY);
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<DirectoryView>(initial?.view ?? 'grid');
  // Filters start folded away unless a shared link already applies some.
  const [filtersOpen, setFiltersOpen] = useState(() =>
    FILTER_KEYS.some((key) => (initial?.filters?.[key] ?? '').trim() !== '')
  );
  const filtersId = useId();
  const searchHintId = useId();
  const resultsId = useId();

  // A ?view= link wins; otherwise this browser's last choice; otherwise the
  // grid. Switching views only re-renders the records already loaded.
  useEffect(() => {
    try {
      const cols = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? 'null');
      if (cols && typeof cols === 'object') setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY, ...cols });
    } catch {
      // Storage unavailable or corrupt: keep the defaults.
    }
    if (initial?.view) return;
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === 'grid' || saved === 'list') setView(saved);
    } catch {
      // Keep the grid.
    }
  }, [initial?.view]);
  const remember = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore (private mode, blocked storage).
    }
  };
  const chooseView = (next: DirectoryView) => {
    setView(next);
    remember(VIEW_STORAGE_KEY, next);
  };
  const changeColumns = (next: VisibilityState) => {
    setColumnVisibility(next);
    remember(COLUMNS_STORAGE_KEY, JSON.stringify(next));
  };

  // Free-text inputs are debounced; selects apply immediately.
  const q = useDebounced(normalizeText(filters.q), 350);
  const contractor = useDebounced(normalizeText(filters.contractor), 350);

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

  /** Server query for one page; the same values (minus defaults) are mirrored into the address bar. */
  const query = useMemo(() => {
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
    set('source', filters.source);
    p.set('sort', filters.sort);
    p.set('page', String(pagination.pageIndex + 1));
    p.set('pageSize', String(pagination.pageSize));
    return p;
  }, [q, contractor, filters.region, filters.province, filters.municipality, filters.category, filters.status, filters.office, filters.source, filters.sort, pagination]);
  const params = query.toString();

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

  // Keep the address bar in step with the table so a view can be shared or reloaded.
  useEffect(() => {
    const shown = new URLSearchParams(query);
    if (shown.get('sort') === EMPTY_FILTERS.sort) shown.delete('sort');
    if (shown.get('page') === '1') shown.delete('page');
    if (shown.get('pageSize') === String(DEFAULT_PAGE_SIZE)) shown.delete('pageSize');
    if (view === 'list') shown.set('view', 'list');
    const qs = shown.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', next);
  }, [query, view]);

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

  const firstPage = () => setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
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
    firstPage();
  };
  const resetFilters = () => {
    setFilters((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort }));
    firstPage();
  };

  const table = useDirectoryTable({
    items,
    total,
    sort: filters.sort,
    onSortChange: (sort) => update({ sort }),
    pagination,
    onPaginationChange: setPagination,
    columnVisibility,
    onColumnVisibilityChange: changeColumns,
  });

  const activeFilters = FILTER_KEYS.filter((key) => filters[key].trim() !== '').map((key) => {
    const value = filters[key];
    const shown =
      key === 'category' ? categoryLabel(value) : key === 'status' ? statusLabel(value) : key === 'source' ? sourceLabel(value) : value;
    return { key, label: FILTER_LABELS[key], value: shown };
  });
  const searchActive = filters.q.trim() !== '';
  const isFiltered = searchActive || activeFilters.length > 0;
  // The directory mixes sources; say which ones the count covers so it is not read as the contract total above.
  const scopeNote = filters.source
    ? `Source: ${sourceLabel(filters.source)}`
    : `Across all sources: ${PROJECT_SOURCE_IDS.map((s) => PROJECT_SOURCES[s].label).join(' and ')}`;
  const rows = table.getRowModel().rows;
  // One assignment per visible page: no photo repeats on it, and re-sorting the same records keeps their photos.
  const cardImages = useMemo(() => assignCardImages(items), [items]);
  const photoCredits = useMemo(() => creditsFor(cardImages), [cardImages]);

  const viewButton = (value: DirectoryView, Icon: typeof List, label: string) => (
    <button
      type="button"
      onClick={() => chooseView(value)}
      aria-pressed={view === value}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink ${
        view === value ? 'bg-surface text-ink shadow-raise' : 'text-subtle hover:text-ink'
      }`}
    >
      <Icon className="w-4 h-4" aria-hidden="true" /> {label}
    </button>
  );
  const chipClass =
    'inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-accent-soft text-[13px] text-ink hover:bg-accent-soft-hover focus-visible:outline-2 focus-visible:outline-accent-ink';

  return (
    <div className="space-y-5">
      {summaryState === 'error' && (
        <div role="alert" className="flex items-start gap-2 p-3.5 rounded-card border border-danger-line bg-danger-soft text-[13px] text-danger-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> Could not load the data summary, so the location and office filters have no options. Search and the other filters still work.
        </div>
      )}
      {summaryState === 'empty' && (
        <div role="status" className="flex items-start gap-2 p-3.5 rounded-card border border-warn-line bg-warn-soft text-[13px] text-warn-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> No DPWH data has been imported yet. An administrator needs to run the initial sync.
        </div>
      )}
      {showSummary && summary && (
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
      {!showSummary && summaryState !== 'loading' && <DataScopeNote summary={summary} />}

      <section aria-label="Search and filter projects" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[min(100%,16rem)]">
            <span className="sr-only">Search projects</span>
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search by project name, ID, contractor or office"
              aria-describedby={searchHintId}
              maxLength={200}
              className={`${controlBaseClass} w-full h-11 pl-10 pr-4 rounded-full text-[15px]`}
            />
            <span id={searchHintId} className="sr-only">
              Searches project name, contract or project ID, contractor, description, and implementing office.
            </span>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            className={`${secondaryButtonLgClass} !h-11 ${filtersOpen ? '!bg-sunken' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Filters
            {activeFilters.length > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-ink text-on-ink text-[11px] tabular-nums">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        <div id={filtersId} hidden={!filtersOpen} className={`${panelClass} p-4 sm:p-5`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Region (project location)">
              <select className={controlClass} value={filters.region} onChange={(e) => update({ region: e.target.value })}>
                <option value="">All regions</option>
                {regionOptions.map((r) => <option key={r} value={r}>{regionDisplayName(r)}</option>)}
              </select>
            </Field>
            <Field label="Province">
              <select className={controlClass} value={filters.province} onChange={(e) => update({ province: e.target.value })}>
                <option value="">{filters.region ? `All provinces in ${filters.region}` : 'All provinces'}</option>
                {provinceOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="City / municipality">
              <select
                className={controlClass}
                value={filters.municipality}
                onChange={(e) => update({ municipality: e.target.value })}
                disabled={!hasMunicipalityData}
                title={hasMunicipalityData ? undefined : 'The DPWH source does not report city or municipality.'}
              >
                <option value="">{hasMunicipalityData ? 'All cities / municipalities' : 'Not reported by source'}</option>
                {municipalityOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className={controlClass} value={filters.category} onChange={(e) => update({ category: e.target.value })}>
                <option value="">All categories</option>
                {DPWH_CATEGORIES.map((c) => <option key={c} value={c}>{DPWH_CATEGORY_LABELS[c]}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={controlClass} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                <option value="">All statuses</option>
                {DPWH_STATUSES.map((s) => <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select className={controlClass} value={filters.source} onChange={(e) => update({ source: e.target.value })}>
                <option value="">All sources</option>
                {PROJECT_SOURCE_IDS.map((s) => <option key={s} value={s}>{PROJECT_SOURCES[s].label}</option>)}
              </select>
            </Field>
            <Field label="Implementing office">
              <select className={controlClass} value={filters.office} onChange={(e) => update({ office: e.target.value })}>
                <option value="">All offices</option>
                {officeGroups.map(([region, offices]) => (
                  <optgroup key={region} label={region}>
                    {offices.map((o) => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Contractor (starts with)">
              <input
                value={filters.contractor}
                onChange={(e) => update({ contractor: e.target.value })}
                placeholder="e.g. JEJOR"
                maxLength={200}
                className={controlClass}
              />
            </Field>
          </div>
        </div>

        {isFiltered && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ul className="contents" aria-label="Active filters">
              {searchActive && (
                <li>
                  <button type="button" onClick={() => update({ q: '' })} className={chipClass} aria-label={`Remove search “${filters.q.trim()}”`}>
                    <span className="text-muted">Search</span> <span className="max-w-[14rem] truncate font-medium">{filters.q.trim()}</span>
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              )}
              {activeFilters.map((f) => (
                <li key={f.key}>
                  <button type="button" onClick={() => update({ [f.key]: '' })} className={chipClass} aria-label={`Remove filter ${f.label}: ${f.value}`}>
                    {f.key === 'region' && (
                      <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: regionColor(filters.region) }} aria-hidden="true" />
                    )}
                    <span className="text-muted">{f.label}</span> <span className="max-w-[14rem] truncate font-medium">{f.value}</span>
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={resetFilters} className={`${secondaryButtonSmClass} !h-8`}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Clear all
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby={resultsId} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 id={resultsId} className="text-[15px] font-semibold text-ink">
              <span aria-live="polite">
                {listState === 'ready'
                  ? `${formatCount(total)} ${total === 1 ? 'record' : 'records'}`
                  : listState === 'loading'
                    ? 'Searching…'
                    : 'Projects'}
              </span>
            </h2>
            <p className="text-xs text-muted">{scopeNote}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-subtle">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select className={`${controlBaseClass} h-10 pl-3.5 pr-8 w-[16.5rem] max-w-full rounded-full text-sm`} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
                {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {view === 'list' && <ColumnToggle table={table} />}
            <div role="group" aria-label="Results layout" className="inline-flex items-center gap-1 h-10 p-1 rounded-full bg-sunken">
              {viewButton('grid', LayoutGrid, 'Grid')}
              {viewButton('list', List, 'Table')}
            </div>
          </div>
        </div>

        {listState === 'error' ? (
          <div role="alert" className={`${panelClass} p-8 text-center text-sm text-danger-ink space-y-3`}>
            <AlertTriangle className="w-6 h-6 mx-auto" aria-hidden="true" />
            <p>Could not load projects ({listError}).</p>
            {filters.status && (
              <p className="text-xs text-muted">Filters on rare statuses can time out on the hosted database. Removing the status filter usually helps.</p>
            )}
            <button type="button" onClick={() => setReload((n) => n + 1)} className={secondaryButtonSmClass}>
              Try again
            </button>
          </div>
        ) : listState === 'ready' && items.length === 0 ? (
          <div className={`${panelClass} p-10 text-center space-y-3`}>
            <SearchX className="w-7 h-7 mx-auto text-muted" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">No projects match these filters.</p>
            {isFiltered && (
              <button type="button" onClick={resetFilters} className="text-sm font-medium text-ink underline underline-offset-2">Clear all filters</button>
            )}
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${listState === 'loading' ? 'opacity-60' : ''}`} aria-busy={listState === 'loading'}>
            {view === 'list' ? (
              <div className={`${panelClass} overflow-hidden`}>
                <DpwhProjectTable table={table} loading={listState === 'loading'} onOpenContract={setSelectedId} />
              </div>
            ) : (
              <ul className="grid gap-4 sm:gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))]">
                {listState === 'loading' && rows.length === 0
                  ? Array.from({ length: 6 }, (_, i) => <li key={i} className="flex [&>*]:flex-1"><DpwhProjectCardSkeleton /></li>)
                  : rows.map((row, i) => (
                      <li key={row.id} className="flex [&>*]:flex-1">
                        <DpwhProjectCard item={row.original} image={cardImages.get(recordKey(row.original))} onOpenContract={setSelectedId} eager={i < 4} />
                      </li>
                    ))}
              </ul>
            )}
          </div>
        )}

        {listState !== 'error' && total > Math.min(...PAGE_SIZE_OPTIONS) && <DirectoryPager table={table} total={total} />}

        {view === 'grid' && listState !== 'error' && photoCredits.length > 0 && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer w-fit rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink">
              Photos are representative of each category and do not show these projects. Credits for the {photoCredits.length} photo{photoCredits.length === 1 ? '' : 's'} on this page
            </summary>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              {photoCredits.map((photo) => (
                <li key={photo.src}>
                  {categoryLabel(photo.category)}: <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{photo.title}</a> by {photo.creator},{' '}
                  <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{photo.license}</a>, via Wikimedia Commons
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <DpwhContractDrawer contractId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
