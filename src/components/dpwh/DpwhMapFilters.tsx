'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { DPWH_CATEGORIES, DPWH_CATEGORY_LABELS, DPWH_STATUS_LABELS, type DpwhCategory, type DpwhStatus } from '@/types/dpwh';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { MAP_STATUSES, statusColor } from './format';

export interface MapFilters {
  q: string;
  region: string;
  category: string;
  status: string;
}
export const EMPTY_MAP_FILTERS: MapFilters = { q: '', region: '', category: '', status: '' };

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/**
 * One labelled segment of the filter bar: a small label over the current
 * value, like a field in a form, so three selects never read as three
 * identical pills. The native select keeps keyboard and screen-reader
 * behaviour; the segment only frames it.
 */
function FilterSegment({
  label,
  value,
  onChange,
  children,
  divided,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  divided: boolean;
}) {
  return (
    <label
      className={`group/seg relative flex flex-col justify-center min-w-0 h-14 px-4 rounded-2xl cursor-pointer transition-colors hover:bg-sunken focus-within:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-ink ${
        divided ? 'xl:before:absolute xl:before:-left-px xl:before:inset-y-3.5 xl:before:w-px xl:before:bg-line xl:hover:before:opacity-0 xl:focus-within:before:opacity-0' : ''
      }`}
    >
      <span className="text-[11.5px] font-medium leading-none text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full min-w-0 appearance-none bg-transparent pr-6 text-[14px] font-medium leading-tight truncate cursor-pointer outline-none ${value ? 'text-ink' : 'text-subtle'}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 bottom-[13px] w-4 h-4 text-muted" aria-hidden="true" />
    </label>
  );
}

/** A removable chip for one active filter, with the swatch the map uses for it. */
function FilterChip({ label, swatch, onRemove }: { label: string; swatch?: React.ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className={`inline-flex items-center gap-1.5 h-8 max-w-full pl-3 pr-2 rounded-full bg-surface border border-line text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-sunken ${focusRing}`}
    >
      {swatch}
      <span className="truncate">{label}</span>
      <X className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

/**
 * Search and filters for the public map: a raised bar with the search field
 * and three labelled selects, and under it a quiet row with the result line
 * and the active filters as removable chips. On phones the selects fold
 * behind a Filters button so the search field keeps the full width.
 */
export function DpwhMapFilters({
  filters,
  onChange,
  regionOptions,
  resultLine,
  trailing,
}: {
  filters: MapFilters;
  onChange: (next: MapFilters) => void;
  regionOptions: string[];
  /** The live result count, announced politely. */
  resultLine: React.ReactNode;
  /** Extra action in the result row (e.g. "Try again"). */
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<MapFilters>) => onChange({ ...filters, ...patch });
  const activeCount = [filters.region, filters.category, filters.status].filter(Boolean).length;
  const isFiltered = activeCount > 0 || filters.q !== '';

  return (
    <section aria-label="Search and filter the map" className="space-y-3">
      <div className="bg-surface border border-line rounded-[22px] shadow-raise p-1.5 grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))] xl:items-center">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="relative flex-1 min-w-0 flex items-center h-14 rounded-2xl transition-colors hover:bg-sunken focus-within:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-ink">
            <span className="sr-only">Search projects on the map</span>
            <Search className="absolute left-4 w-[18px] h-[18px] text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search project, contract ID, contractor or office"
              maxLength={200}
              className="w-full h-full min-w-0 bg-transparent pl-11 pr-4 text-[15px] text-ink placeholder:text-muted outline-none [&::-webkit-search-cancel-button]:cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="map-filter-fields"
            className={`sm:hidden relative inline-flex items-center justify-center gap-1.5 h-12 px-4 mr-0.5 shrink-0 rounded-2xl text-sm font-semibold transition-colors ${
              open || activeCount > 0 ? 'bg-ink text-on-ink' : 'bg-sunken text-ink hover:bg-line'
            } ${focusRing}`}
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-accent text-night text-[11px] font-bold tabular-nums">{activeCount}</span>
            )}
          </button>
        </div>

        <div
          id="map-filter-fields"
          className={`${open ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-3 gap-0.5 mt-1.5 pt-1.5 border-t border-line xl:contents`}
        >
          <FilterSegment label="Region" value={filters.region} onChange={(region) => set({ region })} divided>
            <option value="">All regions</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>{regionDisplayName(r)}</option>
            ))}
          </FilterSegment>
          <FilterSegment label="Category" value={filters.category} onChange={(category) => set({ category })} divided>
            <option value="">All categories</option>
            {DPWH_CATEGORIES.map((c) => (
              <option key={c} value={c}>{DPWH_CATEGORY_LABELS[c]}</option>
            ))}
          </FilterSegment>
          <FilterSegment label="Reported status" value={filters.status} onChange={(status) => set({ status })} divided>
            <option value="">All statuses</option>
            {MAP_STATUSES.map((s) => (
              <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>
            ))}
          </FilterSegment>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-1">
        <p aria-live="polite" className="text-[13px] leading-snug text-muted tabular-nums min-h-5">{resultLine}</p>
        {(isFiltered || trailing) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {trailing}
            {filters.q && <FilterChip label={`“${filters.q.trim()}”`} onRemove={() => set({ q: '' })} />}
            {filters.region && (
              <FilterChip
                label={regionDisplayName(filters.region)}
                swatch={<span className="w-2.5 h-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: regionColor(filters.region) }} aria-hidden="true" />}
                onRemove={() => set({ region: '' })}
              />
            )}
            {filters.category && (
              <FilterChip label={DPWH_CATEGORY_LABELS[filters.category as DpwhCategory] ?? filters.category} onRemove={() => set({ category: '' })} />
            )}
            {filters.status && (
              <FilterChip
                label={DPWH_STATUS_LABELS[filters.status as DpwhStatus] ?? filters.status}
                swatch={<span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor(filters.status) }} aria-hidden="true" />}
                onRemove={() => set({ status: '' })}
              />
            )}
            {isFiltered && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_MAP_FILTERS)}
                className={`inline-flex items-center h-8 px-3 rounded-full text-[13px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink ${focusRing}`}
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
