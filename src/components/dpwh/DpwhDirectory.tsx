'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { FolderSearch, LayoutGrid, List, RotateCcw, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import type { ColumnVisibilityState as VisibilityState, PaginationState } from '@tanstack/react-table';
import {
  DPWH_CATEGORIES,
  DPWH_CATEGORY_LABELS,
  DPWH_STATUSES,
  DPWH_STATUS_LABELS,
  type DpwhSummary,
  type ProjectListItem,
} from '@/types/dpwh';
import {
  AGENCY_SCOPE,
  AGENCY_SOURCES,
  PROJECT_SOURCES,
  PROJECT_SOURCE_IDS,
  agencyOf,
  isProjectAgency,
  sourceLabel,
  type ProjectAgency,
} from '@/lib/integrations/bettergov/sources';
import { SUBAYBAYAN_CATEGORIES, SUBAYBAYAN_CATEGORY_SHORT, isSubaybayanCategory } from '@/lib/subaybayan/categories';
import { SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';
import { directoryProvinceLabel, directoryRegionLabel } from '@/lib/subaybayan/ui';
import type { FacetsPayload } from '@/lib/subaybayan/query';
import { DilgProjectCard } from '@/components/subaybayan/DilgDirectoryCard';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { errorMessage, fetchJson } from '@/lib/http';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, Notice } from '@/components/ui/StateViews';
import { DpwhSummaryPanel } from './DpwhSummaryPanel';
import { DataScopeNote } from './DataScopeNote';
import { DataFreshness } from './DataFreshness';
import { DpwhContractDrawer } from './DpwhContractDrawer';
import { ColumnToggle, DEFAULT_COLUMN_VISIBILITY, DirectoryPager, DpwhProjectTable, PAGE_SIZE_OPTIONS, useDirectoryTable } from './DpwhProjectTable';
import { DpwhProjectCard, DpwhProjectCardSkeleton } from './DpwhProjectCard';
import { assignCardImages, creditsFor, photoSubjects, recordKey } from './categoryImages';
import { categoryLabel, formatCount, statusLabel } from './format';
import { controlBaseClass, controlClass, panelClass, secondaryButtonLgClass, secondaryButtonSmClass } from './ui';

/** Every sort the API accepts, labelled for DPWH records (the labels before DILG rows joined the directory). */
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

/** Sorts that only order DPWH fields: DILG rows have no budget or contract date. */
const DPWH_ONLY_SORTS = new Set<string>(['budget-desc', 'budget-asc', 'contract_date-desc', 'contract_date-asc']);

/**
 * Sort menu for the chosen agency. The amount sort orders DPWH contract
 * amounts and DILG total project costs (unverified DILG totals last); the
 * labels say which amount is meant.
 */
export function sortOptionsFor(agency: string): (readonly [string, string])[] {
  return SORT_OPTIONS.filter(([value]) => agency !== 'DILG' || !DPWH_ONLY_SORTS.has(value)).map(([value, label]) => {
    if (value.startsWith('contract_amount-')) {
      const dir = value.endsWith('desc') ? 'high to low' : 'low to high';
      if (agency === 'DILG') return [value, `Total project cost: ${dir}`] as const;
      if (agency === '') return [value, `Contract amount / total cost: ${dir}`] as const;
    }
    if (agency === 'DILG' && value.startsWith('progress-')) {
      return [value, `Physical accomplishment: ${value.endsWith('desc') ? 'high to low' : 'low to high'}`] as const;
    }
    return [value, label] as const;
  });
}

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
  /** '' (all), 'DPWH' or 'DILG'. */
  agency: string;
  /** DILG category (LGU Tracker classification); only with agency DILG. */
  sector: string;
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
  agency: '', sector: '', sort: 'contract_amount-desc',
};
const DEFAULT_PAGE_SIZE = 25;
// v2: the grid became the default; choices saved while the table was the default are not carried over.
const VIEW_STORAGE_KEY = 'lgu-tracker:directory-view:v2';
const COLUMNS_STORAGE_KEY = 'lgu-tracker:directory-columns';
const FILTER_KEYS = ['agency', 'region', 'province', 'municipality', 'category', 'sector', 'status', 'office', 'contractor', 'source'] as const;
const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  agency: 'Agency', region: 'Region', province: 'Province', municipality: 'City / municipality', category: 'Category',
  sector: 'DILG category', status: 'Status', office: 'Office', contractor: 'Contractor', source: 'Source',
};
const AGENCY_OPTIONS = [['', 'All'], ['DPWH', 'DPWH'], ['DILG', 'DILG']] as const;

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
  const { toast } = useToast();
  // Filters start folded away unless a shared link already applies some.
  const [filtersOpen, setFiltersOpen] = useState(() =>
    // The agency switch sits outside the panel, so ?agency= alone does not open it.
    FILTER_KEYS.some((key) => key !== 'agency' && (initial?.filters?.[key] ?? '').trim() !== '')
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

  // DILG regions (nationwide) for the region filter, and the selected region's DILG provinces.
  // Raw SubayBAYAN labels are mapped to the directory's ("REGION X - ..." -> "Region X").
  const includesDilg = filters.agency !== 'DPWH';
  const [dilgRegions, setDilgRegions] = useState<Map<string, string>>(new Map());
  const [dilgProvinces, setDilgProvinces] = useState<string[]>([]);
  useEffect(() => {
    if (!includesDilg || dilgRegions.size > 0) return;
    let active = true;
    fetchJson<FacetsPayload>('/api/subaybayan/facets')
      .then((f) => {
        if (!active) return;
        const m = new Map<string, string>();
        for (const r of f.regions) {
          const label = directoryRegionLabel(r.value);
          if (label) m.set(label, r.value);
        }
        setDilgRegions(m);
      })
      .catch(() => {
        // DPWH region options still work.
      });
    return () => {
      active = false;
    };
  }, [includesDilg, dilgRegions.size]);
  const dilgRawRegion = filters.region ? dilgRegions.get(filters.region) : undefined;
  useEffect(() => {
    if (!includesDilg || !dilgRawRegion) {
      setDilgProvinces([]);
      return;
    }
    let active = true;
    fetchJson<FacetsPayload>(`/api/subaybayan/facets?region=${encodeURIComponent(dilgRawRegion)}`)
      .then((f) => active && setDilgProvinces(f.provinces.map((p) => directoryProvinceLabel(p.value)).filter((p): p is string => !!p)))
      .catch(() => active && setDilgProvinces([]));
    return () => {
      active = false;
    };
  }, [includesDilg, dilgRawRegion]);

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
    set('agency', filters.agency);
    set('sector', filters.sector);
    p.set('sort', filters.sort);
    p.set('page', String(pagination.pageIndex + 1));
    p.set('pageSize', String(pagination.pageSize));
    return p;
  }, [q, contractor, filters.region, filters.province, filters.municipality, filters.category, filters.status, filters.office, filters.source, filters.agency, filters.sector, filters.sort, pagination]);
  const params = query.toString();

  useEffect(() => {
    const controller = new AbortController();
    setListState('loading');
    // Aborting on every change means a slow, superseded response can never overwrite newer results.
    fetchJson<{ items: ProjectListItem[]; total: number }>(`/api/dpwh/contracts?${params}`, { signal: controller.signal })
      .then((body) => {
        setItems(body.items);
        setTotal(body.total);
        setListState('ready');
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === 'AbortError') return;
        setListError(errorMessage(error, 'Could not load projects. Please try again.'));
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
  const regionOptions = useMemo(() => {
    const dpwh = filters.agency === 'DILG' ? [] : (stats?.by_region ?? []).filter((r) => r.value !== null).map((r) => r.value as string);
    const dilg = filters.agency === 'DPWH' ? [] : [...dilgRegions.keys()];
    return [...new Set([...dpwh, ...dilg])].sort();
  }, [stats, filters.agency, dilgRegions]);
  const provinceOptions = useMemo(() => {
    const rows = filters.agency === 'DILG' ? [] : (stats?.provinces ?? []).filter((p) => !filters.region || p.region === filters.region);
    const dilg = filters.agency === 'DPWH' || !filters.region ? [] : dilgProvinces;
    return [...new Set([...rows.map((p) => p.province), ...dilg])].sort();
  }, [stats, filters.region, filters.agency, dilgProvinces]);
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
      // Agency and source go together: DPWH = contracts or NEP 2027, DILG = Locally Funded or LIME 20% DF.
      if (patch.agency !== undefined && patch.agency !== prev.agency) {
        if (next.source && next.agency && agencyOf(next.source) !== next.agency) next.source = '';
        if (next.agency === 'DPWH') next.sector = '';
        if (next.agency === 'DILG') {
          next.category = '';
          next.office = '';
          if (DPWH_ONLY_SORTS.has(next.sort)) next.sort = EMPTY_FILTERS.sort;
        }
      }
      // A DPWH source cannot be combined with a DILG category.
      if (patch.source !== undefined && patch.source && agencyOf(patch.source) === 'DPWH') next.sector = '';
      if (patch.sector !== undefined && patch.sector && next.agency !== 'DILG') {
        next.agency = 'DILG';
        next.category = '';
        next.office = '';
        if (next.source && agencyOf(next.source) !== 'DILG') next.source = '';
        if (DPWH_ONLY_SORTS.has(next.sort)) next.sort = EMPTY_FILTERS.sort;
      }
      return next;
    });
    firstPage();
  };
  const resetFilters = () => {
    setFilters((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort }));
    firstPage();
    toast({ id: 'directory-filters', tone: 'info', title: 'Search and filters cleared', description: 'Showing all projects.' });
  };

  // The DILG category column is all dashes with DPWH alone; hide it there without changing the saved choice.
  const shownColumns = useMemo(
    () => (filters.agency === 'DPWH' ? { ...columnVisibility, dilg_category: false } : columnVisibility),
    [columnVisibility, filters.agency]
  );
  const table = useDirectoryTable({
    items,
    total,
    sort: filters.sort,
    onSortChange: (sort) => update({ sort }),
    pagination,
    onPaginationChange: setPagination,
    columnVisibility: shownColumns,
    onColumnVisibilityChange: changeColumns,
  });

  const activeFilters = FILTER_KEYS.filter((key) => filters[key].trim() !== '').map((key) => {
    const value = filters[key];
    const shown =
      key === 'category'
        ? categoryLabel(value)
        : key === 'status'
          ? statusLabel(value)
          : key === 'source'
            ? sourceLabel(value)
            : key === 'sector' && isSubaybayanCategory(value)
              ? SUBAYBAYAN_CATEGORY_SHORT[value]
              : value;
    return { key, label: FILTER_LABELS[key], value: shown };
  });
  const searchActive = filters.q.trim() !== '';
  const isFiltered = searchActive || activeFilters.length > 0;
  // The directory mixes sources; say which ones the count covers so it is not read as the contract total above.
  const scopeNote = filters.source
    ? `Source: ${sourceLabel(filters.source)}`
    : isProjectAgency(filters.agency)
      ? `${filters.agency} only: ${AGENCY_SCOPE[filters.agency]}`
      : `Across all sources: ${AGENCY_SCOPE.DPWH}, and ${AGENCY_SCOPE.DILG}`;
  const sourceOptions = isProjectAgency(filters.agency) ? AGENCY_SOURCES[filters.agency as ProjectAgency] : PROJECT_SOURCE_IDS;
  const sortOptions = sortOptionsFor(filters.agency);
  const rows = table.getRowModel().rows;
  // One assignment per visible page: no photo repeats on it, and re-sorting the same records keeps their photos.
  const cardImages = useMemo(() => assignCardImages(photoSubjects(items)), [items]);
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
        <Notice tone="danger">
          Could not load the data summary, so the location and office filters have no options. Search and the other filters still work.
        </Notice>
      )}
      {summaryState === 'empty' && (
        <Notice tone="warn">No DPWH data has been imported yet. An administrator needs to run the initial sync.</Notice>
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
              placeholder="Search by project name, ID, contractor, office or place"
              aria-describedby={searchHintId}
              maxLength={200}
              className={`${controlBaseClass} w-full h-11 pl-10 pr-4 rounded-full text-[15px]`}
            />
            <span id={searchHintId} className="sr-only">
              Searches project name, contract or project ID, contractor, description, and implementing office; for DILG projects also the city, barangay and province.
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span id={`${filtersId}-agency`} className="text-xs font-medium text-subtle">Agency</span>
          <div role="radiogroup" aria-labelledby={`${filtersId}-agency`} className="inline-flex items-center gap-1 h-10 p-1 rounded-full bg-sunken">
            {AGENCY_OPTIONS.map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                role="radio"
                aria-checked={filters.agency === value}
                onClick={() => update({ agency: value })}
                title={value ? AGENCY_SCOPE[value] : 'Every agency and source'}
                className={`inline-flex items-center h-8 px-3.5 rounded-full text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink ${
                  filters.agency === value ? 'bg-surface text-ink shadow-raise' : 'text-subtle hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
                title={hasMunicipalityData ? undefined : filters.agency === 'DPWH' ? 'The DPWH source does not report city or municipality.' : 'DPWH does not report city or municipality; for DILG projects, type the city in the search box.'}
              >
                <option value="">{hasMunicipalityData ? 'All cities / municipalities' : filters.agency === 'DPWH' ? 'Not reported by source' : 'Use search for a city (DILG)'}</option>
                {municipalityOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            {filters.agency === 'DILG' ? (
              <Field label="DILG category (LGU Tracker classification)">
                <select className={controlClass} value={filters.sector} onChange={(e) => update({ sector: e.target.value })}>
                  <option value="">All DILG categories</option>
                  {SUBAYBAYAN_CATEGORIES.map((c) => <option key={c} value={c}>{SUBAYBAYAN_CATEGORY_SHORT[c]}</option>)}
                </select>
              </Field>
            ) : (
              <Field label={filters.agency === 'DPWH' ? 'Category' : 'Category (work type)'}>
                <select className={controlClass} value={filters.category} onChange={(e) => update({ category: e.target.value })}>
                  <option value="">All categories</option>
                  {DPWH_CATEGORIES.map((c) => <option key={c} value={c}>{DPWH_CATEGORY_LABELS[c]}</option>)}
                </select>
              </Field>
            )}
            <Field label="Status">
              <select className={controlClass} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
                <option value="">All statuses</option>
                {DPWH_STATUSES.map((s) => <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select className={controlClass} value={filters.source} onChange={(e) => update({ source: e.target.value })}>
                <option value="">{filters.agency ? `All ${filters.agency} sources` : 'All sources'}</option>
                {sourceOptions.map((s) => <option key={s} value={s}>{PROJECT_SOURCES[s].label}</option>)}
              </select>
            </Field>
            <Field label="Implementing office (DPWH)">
              <select
                className={controlClass}
                value={filters.office}
                onChange={(e) => update({ office: e.target.value })}
                disabled={filters.agency === 'DILG'}
                title={filters.agency === 'DILG' ? 'DILG projects are implemented by LGUs, not DPWH offices.' : undefined}
              >
                <option value="">{filters.agency === 'DILG' ? 'DPWH only' : 'All offices'}</option>
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
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs text-muted">{scopeNote}</p>
              {filters.agency !== 'DILG' && <DataFreshness summary={summary} />}
              {filters.agency !== 'DPWH' && <p className="text-xs text-muted">DILG SubayBAYAN retrieved {SUBAYBAYAN_RETRIEVED_LABEL}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-subtle">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select className={`${controlBaseClass} h-10 pl-3.5 pr-8 w-[16.5rem] max-w-full rounded-full text-sm`} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
                {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
          <ErrorState
            className={panelClass}
            title="Projects could not be loaded"
            description={listError}
            onRetry={() => setReload((n) => n + 1)}
          >
            {(filters.status || filters.sort !== EMPTY_FILTERS.sort) && (
              <p className="max-w-sm text-xs text-muted">
                Some sort orders can time out on the hosted database when every agency is shown. Choosing one agency or using the default sort usually helps.
              </p>
            )}
          </ErrorState>
        ) : listState === 'ready' && items.length === 0 ? (
          isFiltered ? (
            <EmptyState
              className={panelClass}
              icon={SearchX}
              title="No projects found"
              description="No projects match your current search or filters. Try fewer filters or a different search term."
              action={
                <button type="button" onClick={resetFilters} className={secondaryButtonSmClass}>
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Clear search and filters
                </button>
              }
            />
          ) : (
            <EmptyState
              className={panelClass}
              icon={FolderSearch}
              title="No projects available yet"
              description="There are no project records to show. Records appear here once the DPWH data has been imported."
            />
          )
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
                        {row.original.agency === 'DILG' ? (
                          <DilgProjectCard item={row.original} image={cardImages.get(recordKey(row.original))} eager={i < 4} />
                        ) : (
                          <DpwhProjectCard item={row.original} image={cardImages.get(recordKey(row.original))} onOpenContract={setSelectedId} eager={i < 4} />
                        )}
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
              Photos are representative of the kind of work and do not show these projects; DILG projects with no fitting photo show an illustration. Credits for the {photoCredits.length} photo{photoCredits.length === 1 ? '' : 's'} on this page
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
