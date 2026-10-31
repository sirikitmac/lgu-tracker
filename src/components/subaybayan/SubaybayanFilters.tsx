'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  SUBAYBAYAN_CATEGORIES,
  SUBAYBAYAN_CATEGORY_COLORS,
  SUBAYBAYAN_CATEGORY_SHORT,
  SUBAYBAYAN_STATUS_LABELS,
  type SubaybayanCategory,
  type SubaybayanDataset,
  type SubaybayanStatus,
} from '@/lib/subaybayan/categories';
import { SUBAYBAYAN_DATASET_INFO } from '@/lib/subaybayan/source';
import {
  CATEGORY_DETAIL_FILTERS,
  DETAIL_LABELS,
  EMPTY_FILTERS,
  withCategory,
  type DetailKey,
  type FacetValue,
  type FacetsPayload,
  type SubaybayanFilters as Filters,
} from '@/lib/subaybayan/query';
import { placeOptionLabel, regionLabel, subaybayanStatusFill } from '@/lib/subaybayan/ui';
import { formatCount } from '@/components/dpwh/format';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** Labelled select framed like the DPWH map's filter segments. */
function Segment({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative flex flex-col justify-center min-w-0 h-14 px-4 rounded-2xl transition-colors ${
        disabled ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer hover:bg-sunken focus-within:bg-sunken'
      } has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-ink`}
    >
      <span className="text-[11.5px] font-medium leading-none text-muted">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full min-w-0 appearance-none bg-transparent pr-6 text-[14px] font-medium leading-tight truncate outline-none disabled:cursor-not-allowed ${value ? 'text-ink' : 'text-subtle'} ${disabled ? '' : 'cursor-pointer'}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 bottom-[13px] w-4 h-4 text-muted" aria-hidden="true" />
    </label>
  );
}

function Chip({ label, swatch, onRemove }: { label: string; swatch?: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className={`inline-flex items-center gap-1.5 h-8 max-w-full pl-3 pr-2 rounded-full bg-surface border border-line text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-sunken ${focusRing}`}
    >
      {swatch && <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ backgroundColor: swatch }} aria-hidden="true" />}
      <span className="truncate">{label}</span>
      <X className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

/** Options from facets with counts; the current value stays listed even at zero so the select never goes blank. */
function options(values: FacetValue[] | undefined, current: string, label: (v: string) => string = (v) => v) {
  const list = [...(values ?? [])];
  if (current && !list.some((v) => v.value === current)) list.unshift({ value: current, count: 0 });
  return list.map((v) => (
    <option key={v.value} value={v.value}>
      {label(v.value)} ({formatCount(v.count)})
    </option>
  ));
}

export function SubaybayanFilterBar({
  filters,
  facets,
  onChange,
  resultLine,
  trailing,
}: {
  filters: Filters;
  facets: FacetsPayload | null;
  onChange: (next: Filters) => void;
  resultLine: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const catCount = new Map((facets?.categories ?? []).map((c) => [c.value, c.count]));
  const allCount = (facets?.categories ?? []).reduce((n, c) => n + c.count, 0);
  const detailKeys: DetailKey[] = filters.category ? CATEGORY_DETAIL_FILTERS[filters.category] : [];
  const activeCount =
    [filters.source, filters.region, filters.province, filters.city, filters.status, filters.year !== null ? 'y' : '', filters.approx ? '' : 'a'].filter(Boolean).length +
    detailKeys.filter((k) => filters[k]).length;
  const isFiltered = activeCount > 0 || filters.q !== '' || filters.category !== '';

  return (
    <section aria-label="Search and filter LGU projects" className="space-y-3">
      <div className="bg-surface border border-line rounded-[22px] shadow-raise p-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="relative flex-1 min-w-0 flex items-center h-14 rounded-2xl transition-colors hover:bg-sunken focus-within:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-ink">
            <span className="sr-only">Search LGU projects by title or project code</span>
            <Search className="absolute left-4 w-[18px] h-[18px] text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search project title or code"
              maxLength={200}
              className="w-full h-full min-w-0 bg-transparent pl-11 pr-4 text-[15px] text-ink placeholder:text-muted outline-none [&::-webkit-search-cancel-button]:cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="sb-filter-fields"
            className={`md:hidden relative inline-flex items-center justify-center gap-1.5 h-12 px-4 mr-0.5 shrink-0 rounded-2xl text-sm font-semibold transition-colors ${
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

        {/* Category chips: always visible, they are the main way into the data. */}
        <div role="radiogroup" aria-label="Category (LGU Tracker classification)" className="flex gap-1.5 overflow-x-auto px-2 pt-2 pb-1.5 [scrollbar-width:thin]">
          {(['', ...SUBAYBAYAN_CATEGORIES] as const).map((c) => {
            const active = filters.category === c;
            const count = c === '' ? allCount : catCount.get(c) ?? 0;
            return (
              <button
                key={c || 'all'}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(withCategory(filters, c as SubaybayanCategory | ''))}
                className={`inline-flex items-center gap-2 h-9 shrink-0 px-3.5 rounded-full border text-[13px] font-semibold transition-colors ${focusRing} ${
                  active ? 'bg-ink text-on-ink border-ink' : 'bg-surface text-ink border-line hover:border-line-strong hover:bg-sunken'
                }`}
              >
                {c && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SUBAYBAYAN_CATEGORY_COLORS[c] }} aria-hidden="true" />}
                {c ? SUBAYBAYAN_CATEGORY_SHORT[c] : 'All'}
                <span className={`tabular-nums font-medium ${active ? 'text-on-ink/75' : 'text-muted'}`}>{facets ? formatCount(count) : '…'}</span>
              </button>
            );
          })}
        </div>

        <div id="sb-filter-fields" className={`${open ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-0.5 mt-1 pt-1.5 border-t border-line`}>
          <Segment label="Source" value={filters.source} onChange={(v) => set({ source: v as SubaybayanDataset | '' })}>
            <option value="">Both sources</option>
            {options(facets?.sources, filters.source, (v) => SUBAYBAYAN_DATASET_INFO[v as SubaybayanDataset]?.short ?? v)}
          </Segment>
          <Segment label="Region" value={filters.region} onChange={(v) => set({ region: v, province: '', city: '' })}>
            <option value="">All regions</option>
            {options(facets?.regions, filters.region, regionLabel)}
          </Segment>
          <Segment label="Province" value={filters.province} disabled={!filters.region} onChange={(v) => set({ province: v, city: '' })}>
            <option value="">{filters.region ? 'All provinces' : 'Choose a region first'}</option>
            {options(facets?.provinces, filters.province, placeOptionLabel)}
          </Segment>
          <Segment label="City / municipality" value={filters.city} disabled={!filters.province} onChange={(v) => set({ city: v })}>
            <option value="">{filters.province ? 'All cities and municipalities' : 'Choose a province first'}</option>
            {options(facets?.cities, filters.city, placeOptionLabel)}
          </Segment>
          <Segment label="Funding year" value={filters.year === null ? '' : String(filters.year)} onChange={(v) => set({ year: v ? Number(v) : null })}>
            <option value="">All years</option>
            {options(facets?.years, filters.year === null ? '' : String(filters.year))}
          </Segment>
          <Segment label="Status" value={filters.status} onChange={(v) => set({ status: v as SubaybayanStatus | '' })}>
            <option value="">All statuses</option>
            {options(facets?.statuses, filters.status, (v) => SUBAYBAYAN_STATUS_LABELS[v as SubaybayanStatus] ?? v)}
          </Segment>
          <label className={`flex items-center gap-3 min-w-0 h-14 px-4 rounded-2xl cursor-pointer transition-colors hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-ink`}>
            <input
              type="checkbox"
              checked={filters.approx}
              onChange={(e) => set({ approx: e.target.checked })}
              className="w-4 h-4 shrink-0 accent-[var(--color-ink)] cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight text-ink">Approximate locations</span>
              <span className="block mt-0.5 text-[11.5px] leading-tight text-muted">Municipality / province centres</span>
            </span>
          </label>

          {detailKeys.length > 0 && (
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 mt-1 pt-1.5 border-t border-line">
              <p className="col-span-full px-4 pt-1 pb-0.5 text-[11.5px] font-semibold text-muted">
                {SUBAYBAYAN_CATEGORY_SHORT[filters.category as SubaybayanCategory]} filters
              </p>
              {detailKeys.map((key) => (
                <Segment key={key} label={DETAIL_LABELS[key]} value={filters[key]} onChange={(v) => set({ [key]: v } as Partial<Filters>)}>
                  <option value="">All</option>
                  {options(facets?.details[key], filters[key])}
                </Segment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-1">
        <p aria-live="polite" className="text-[13px] leading-snug text-muted tabular-nums min-h-5">{resultLine}</p>
        {(isFiltered || trailing) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {trailing}
            {filters.q && <Chip label={`“${filters.q.trim()}”`} onRemove={() => set({ q: '' })} />}
            {filters.category && (
              <Chip label={SUBAYBAYAN_CATEGORY_SHORT[filters.category]} swatch={SUBAYBAYAN_CATEGORY_COLORS[filters.category]} onRemove={() => onChange(withCategory(filters, ''))} />
            )}
            {filters.source && <Chip label={SUBAYBAYAN_DATASET_INFO[filters.source].short} onRemove={() => set({ source: '' })} />}
            {filters.region && <Chip label={regionLabel(filters.region)} onRemove={() => set({ region: '', province: '', city: '' })} />}
            {filters.province && <Chip label={placeOptionLabel(filters.province)} onRemove={() => set({ province: '', city: '' })} />}
            {filters.city && <Chip label={placeOptionLabel(filters.city)} onRemove={() => set({ city: '' })} />}
            {filters.year !== null && <Chip label={`FY ${filters.year}`} onRemove={() => set({ year: null })} />}
            {filters.status && <Chip label={SUBAYBAYAN_STATUS_LABELS[filters.status]} swatch={subaybayanStatusFill(filters.status)} onRemove={() => set({ status: '' })} />}
            {!filters.approx && <Chip label="Barangay locations only" onRemove={() => set({ approx: true })} />}
            {detailKeys.filter((k) => filters[k]).map((k) => (
              <Chip key={k} label={`${DETAIL_LABELS[k]}: ${filters[k]}`} onRemove={() => set({ [k]: '' } as Partial<Filters>)} />
            ))}
            {isFiltered && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
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
