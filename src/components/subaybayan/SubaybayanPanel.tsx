'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Crosshair, Info, Layers, MapPin, RotateCcw, SearchX, X } from 'lucide-react';
import { errorMessage, fetchJson } from '@/lib/http';
import {
  SUBAYBAYAN_CATEGORY_COLORS,
  SUBAYBAYAN_CATEGORY_LABELS,
  SUBAYBAYAN_STATUS_LABELS,
} from '@/lib/subaybayan/categories';
import type { SubaybayanDetail, SubaybayanSummary } from '@/lib/subaybayan/query';
import { SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';
import { isApproximate, placeLine, precisionLabel, precisionNote, subaybayanStatusBadge } from '@/lib/subaybayan/ui';
import { formatCount, formatDate, formatPeso, readableTitle } from '@/components/dpwh/format';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { secondaryButtonSmClass, textLinkClass } from '@/components/dpwh/ui';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
export const PANEL_PAGE = 30;

// Summaries are cached per id for the session: the data is a snapshot.
const summaryCache = new Map<string, SubaybayanSummary>();

function useSummaries(ids: string[]): { rows: Map<string, SubaybayanSummary>; state: 'loading' | 'ready' | 'error'; retry: () => void } {
  const [, force] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('ready');
  const [attempt, setAttempt] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    const missing = ids.filter((id) => !summaryCache.has(id));
    if (missing.length === 0) {
      setState('ready');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 60) chunks.push(missing.slice(i, i + 60));
    Promise.all(
      chunks.map((chunk) =>
        fetchJson<{ projects: SubaybayanSummary[] }>(`/api/subaybayan/projects?ids=${chunk.map(encodeURIComponent).join(',')}`, { signal: controller.signal })
      )
    )
      .then((bodies) => {
        for (const b of bodies) for (const p of b.projects) summaryCache.set(p.id, p);
        setState('ready');
        force((n) => n + 1);
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setState('error');
      });
    return () => controller.abort();
    // `key` stands for `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { rows: summaryCache, state, retry: () => setAttempt((n) => n + 1) };
}

function StatusChip({ status }: { status: SubaybayanSummary['status'] }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[11.5px] font-semibold whitespace-nowrap ${subaybayanStatusBadge(status)}`}>
      {SUBAYBAYAN_STATUS_LABELS[status]}
    </span>
  );
}

function ProjectRow({ id, row, selected, onSelect }: { id: string; row: SubaybayanSummary | undefined; selected: boolean; onSelect: (id: string) => void }) {
  if (!row) {
    return (
      <li className="rounded-2xl border border-line bg-surface px-4 py-3.5" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-3.5 w-full" />
        <Skeleton className="mt-2 h-3.5 w-3/5" />
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={selected ? 'true' : undefined}
        className={`relative block w-full text-left rounded-2xl border px-4 pt-3 pb-3.5 transition-[background-color,border-color,box-shadow] ${focusRing} focus-visible:outline-offset-0 ${
          selected ? 'bg-surface border-accent-ink/45 shadow-raise' : 'bg-surface border-line hover:border-line-strong hover:shadow-raise'
        }`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 min-w-0 text-[12px] font-medium text-muted">
            <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ backgroundColor: SUBAYBAYAN_CATEGORY_COLORS[row.sector_category] }} aria-hidden="true" />
            <span className="truncate tabular-nums">{row.project_code ?? 'No project code'}</span>
          </span>
          <StatusChip status={row.status} />
        </span>
        <span className="mt-1.5 block text-[14.5px] font-semibold leading-[1.45] text-ink text-pretty break-words line-clamp-3">{readableTitle(row.title)}</span>
        <span className="mt-2.5 pt-2.5 border-t border-line grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
          <span className="flex items-start gap-1.5 min-w-0 text-[12.5px] leading-snug text-subtle">
            <MapPin className={`w-3.5 h-3.5 mt-px shrink-0 ${isApproximate(row.location_precision) ? 'text-muted' : 'text-subtle'}`} aria-hidden="true" />
            <span className="min-w-0 break-words">
              {placeLine(row)}
              {isApproximate(row.location_precision) && <span className="text-muted"> · approx.</span>}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-[11px] leading-none text-muted">FY {row.funding_year ?? '—'}</span>
            <span className="block mt-1 text-[14px] font-semibold leading-none text-ink tabular-nums">{row.total_cost === null ? 'No cost' : formatPeso(row.total_cost)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

function PagedList({ ids, selectedId, onSelect, label }: { ids: string[]; selectedId: string | null; onSelect: (id: string) => void; label: string }) {
  const [visible, setVisible] = useState(PANEL_PAGE);
  const key = ids.length > 0 ? `${ids[0]}|${ids.length}` : '';
  useEffect(() => setVisible(PANEL_PAGE), [key]);
  const shown = ids.slice(0, visible);
  const { rows, state, retry } = useSummaries(shown);
  return (
    <>
      {state === 'error' && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-ink" role="alert">
          Project titles could not be loaded.
          <button type="button" onClick={retry} className={`font-semibold underline underline-offset-2 ${focusRing}`}>Try again</button>
        </div>
      )}
      <ol className="space-y-2.5" aria-label={label}>
        {shown.map((id) => (
          <ProjectRow key={id} id={id} row={rows.get(id)} selected={id === selectedId} onSelect={onSelect} />
        ))}
      </ol>
      {ids.length > visible && (
        <div className="mt-4 mb-1 text-center">
          <button
            type="button"
            onClick={() => setVisible((n) => n + PANEL_PAGE)}
            className={`inline-flex items-center justify-center h-10 px-5 rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink hover:bg-sunken transition-colors ${focusRing}`}
          >
            Show {formatCount(Math.min(PANEL_PAGE, ids.length - visible))} more
            <span className="ml-1.5 font-normal text-muted tabular-nums">· {formatCount(ids.length - visible)} left</span>
          </button>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink break-words">{children ?? <span className="text-muted">Not reported</span>}</dd>
    </>
  );
}

function DetailView({ id, onBack, onLocate }: { id: string; onBack: () => void; onLocate: (p: SubaybayanDetail) => void }) {
  const [project, setProject] = useState<SubaybayanDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetchJson<{ project: SubaybayanDetail }>(`/api/subaybayan/projects/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((b) => {
        setProject(b.project);
        setState('ready');
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === 'AbortError') return;
        setError(errorMessage(e, 'Could not load this project.'));
        setState('error');
      });
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (state === 'ready') headingRef.current?.focus({ preventScroll: true });
  }, [state]);

  if (state === 'error') return <ErrorState className="flex-1 px-8 py-14" title="Project could not be loaded" description={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (state === 'loading' || !project) {
    return (
      <div className="p-5 space-y-3" aria-busy="true">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    );
  }
  const p = project;
  const info = SUBAYBAYAN_DATASET_INFO[p.source_dataset];
  return (
    <div className="px-5 pt-4 pb-6 motion-safe:animate-[bp-in_220ms_var(--ease-out)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-sunken text-[11.5px] font-semibold text-ink">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SUBAYBAYAN_CATEGORY_COLORS[p.sector_category] }} aria-hidden="true" />
          {SUBAYBAYAN_CATEGORY_LABELS[p.sector_category]}
          {p.sector_subcategory && p.sector_subcategory !== 'Uncategorized' && <span className="font-normal text-subtle">· {p.sector_subcategory}</span>}
        </span>
        <StatusChip status={p.status} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted">LGU Tracker classification ({p.classification_reason}), not an official DILG category.</p>
      <h3 ref={headingRef} tabIndex={-1} className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink text-pretty break-words outline-none">
        {readableTitle(p.title)}
      </h3>
      <p className="mt-1 text-[12.5px] text-muted tabular-nums">{p.project_code ?? 'No project code (not yet enrolled)'}</p>

      <div className="mt-4 rounded-xl bg-sunken px-3.5 py-3 text-[13px] leading-snug">
        <p className="flex items-start gap-1.5 font-medium text-ink">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{placeLine(p)}{p.region ? <span className="text-subtle"> · {p.region}</span> : null}</span>
        </p>
        <p className="mt-1.5 text-[12px] text-subtle">
          <span className="font-semibold">{precisionLabel(p.location_precision)}.</span> {precisionNote(p.location_precision)}
        </p>
        {p.latitude !== null && p.longitude !== null && (
          <button type="button" onClick={() => onLocate(p)} className={`mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold ${textLinkClass}`}>
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Show on map
          </button>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-snug">
        <Field label="Total cost">{p.total_cost === null ? null : <span className="font-semibold tabular-nums">{formatPeso(p.total_cost)}</span>}</Field>
        <Field label="National subsidy">{p.national_subsidy === null ? null : <span className="tabular-nums">{formatPeso(p.national_subsidy)}</span>}</Field>
        <Field label="LGU counterpart">{p.lgu_counterpart === null ? null : <span className="tabular-nums">{formatPeso(p.lgu_counterpart)}</span>}</Field>
        <Field label="Funding year">{p.funding_year}</Field>
        <Field label="Status">{p.status_raw ?? SUBAYBAYAN_STATUS_LABELS[p.status]}</Field>
        <Field label="Latest OWPA">{p.owpa === null ? null : <span className="tabular-nums">{p.owpa}%</span>}</Field>
        <Field label="Program">{p.program}</Field>
        <Field label="Project type">{p.project_type}</Field>
        <Field label="Sector">{p.sector}</Field>
        <Field label="Implementation">{p.mode_of_implementation}</Field>
        <Field label="Contractor">{p.contractor}</Field>
        <Field label="Start date">{p.start_date ? formatDate(p.start_date) : null}</Field>
        <Field label="End date">{p.end_date ? formatDate(p.end_date) : null}</Field>
        <Field label="Geotagged photos">{p.geotagged_photos === null ? null : formatCount(p.geotagged_photos)}</Field>
        <Field label="Approval status">{p.approval_status}</Field>
        {p.size_text && <Field label="Size / length">{p.size_text}</Field>}
        {p.beneficiaries_text && <Field label="Beneficiaries">{p.beneficiaries_text}</Field>}
        <Field label="Project owner">{p.project_owner}</Field>
      </dl>
      {p.component_details && (
        <details className="mt-3 group">
          <summary className={`cursor-pointer text-[13px] font-semibold text-ink rounded-sm ${focusRing}`}>Components</summary>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-subtle break-words">{p.component_details}</p>
        </details>
      )}

      <div className="mt-5 pt-4 border-t border-line text-[12.5px] leading-relaxed text-subtle">
        <p>
          Source:{' '}
          <a href={info.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-0.5 font-semibold ${textLinkClass}`}>
            DILG SubayBAYAN – {info.label} <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
          </a>
        </p>
        <p className="mt-0.5">Retrieved {SUBAYBAYAN_RETRIEVED_LABEL} (snapshot). The portal needs a sign-in; check it for the latest status.</p>
        {p.source_file && <p className="mt-0.5 text-muted">Export file {p.source_file}, row {p.source_row}.</p>}
      </div>
      <button type="button" onClick={onBack} className={`${secondaryButtonSmClass} mt-5`}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to list
      </button>
    </div>
  );
}

export type ListMode = { kind: 'list' } | { kind: 'stack'; ids: string[] } | { kind: 'unmapped' };
export type PanelMode = ListMode | { kind: 'detail'; id: string; back: ListMode };

export function SubaybayanPanel({
  state,
  counts,
  total,
  approxShown,
  inViewIds,
  unmappedIds,
  mode,
  selectedId,
  onMode,
  onSelect,
  onLocate,
  onRetry,
  emptyHint,
  onClearFilters,
  className = '',
}: {
  state: 'idle' | 'loading' | 'ready' | 'error';
  counts: { barangay: number; approximate: number; unmapped: number } | null;
  total: number;
  approxShown: boolean;
  inViewIds: string[];
  unmappedIds: string[];
  mode: PanelMode;
  selectedId: string | null;
  onMode: (m: PanelMode) => void;
  onSelect: (id: string) => void;
  onLocate: (p: SubaybayanDetail) => void;
  onRetry: () => void;
  /** Which filters to loosen when nothing matches (null when no filter is active). */
  emptyHint: string | null;
  onClearFilters?: () => void;
  className?: string;
}) {
  const ready = state === 'ready' || (state === 'loading' && counts !== null);
  return (
    <section aria-labelledby="sb-panel-title" className={`bg-surface border border-line rounded-card min-w-0 flex-col lg:overflow-hidden ${className}`}>
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-line">
        <h2 id="sb-panel-title" className="text-[17px] font-semibold tracking-[-0.015em] text-ink">LGU projects</h2>
        {/* Summary bar, in sync with the filters. */}
        <dl className={`mt-3 grid grid-cols-4 gap-2 text-center transition-opacity ${state === 'loading' ? 'opacity-60' : ''}`} aria-busy={state === 'loading'}>
          {[
            { label: 'Matching', value: total, hint: 'All projects that match the filters' },
            { label: 'Barangay', value: counts?.barangay ?? 0, hint: 'Placed at a barangay centre' },
            { label: 'Approx.', value: counts?.approximate ?? 0, hint: approxShown ? 'Placed at a municipality or province centre' : 'Hidden: approximate locations are turned off' },
            { label: 'Unmapped', value: counts?.unmapped ?? 0, hint: 'Location could not be matched; listed, not plotted' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-sunken px-1.5 py-2" title={s.hint}>
              <dt className="text-[11px] leading-none text-muted">{s.label}</dt>
              <dd className={`mt-1.5 text-[15px] font-semibold leading-none tabular-nums ${s.label === 'Approx.' && !approxShown ? 'text-muted line-through' : 'text-ink'}`}>
                {ready ? formatCount(s.value) : '–'}
              </dd>
            </div>
          ))}
        </dl>
        {mode.kind === 'list' && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {formatCount(inViewIds.length)} in view · largest cost first
            {unmappedIds.length > 0 && (
              <button type="button" onClick={() => onMode({ kind: 'unmapped' })} className={`ml-auto font-semibold ${textLinkClass}`}>
                {formatCount(unmappedIds.length)} unmapped
              </button>
            )}
          </p>
        )}
        {mode.kind === 'stack' && (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-subtle">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {formatCount(mode.ids.length)} projects share this area centroid
            </span>
            <button type="button" onClick={() => onMode({ kind: 'list' })} aria-label="Close this location list" className={`inline-flex items-center gap-1 font-semibold text-ink rounded-full ${focusRing}`}>
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Close
            </button>
          </div>
        )}
        {mode.kind === 'unmapped' && (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-subtle">
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Not on the map (location not matched)</span>
            <button type="button" onClick={() => onMode({ kind: 'list' })} className={`inline-flex items-center gap-1 font-semibold text-ink rounded-full ${focusRing}`}>
              <X className="w-3.5 h-3.5" aria-hidden="true" /> Close
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 lg:overflow-y-auto overscroll-contain bg-ground/60 [scrollbar-gutter:stable]">
        {mode.kind === 'detail' ? (
          <div className="bg-surface min-h-full">
            <DetailView id={mode.id} onBack={() => onMode(mode.back)} onLocate={onLocate} />
          </div>
        ) : state === 'error' && counts === null ? (
          <ErrorState className="px-8 py-14" title="LGU projects could not be loaded" description="The project list did not load. Check the connection and try again." onRetry={onRetry} />
        ) : !ready ? (
          <ul aria-busy="true" aria-label="Loading projects" className="p-3 sm:p-4 space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-3.5 w-full" />
                <Skeleton className="mt-2 h-3.5 w-3/5" />
              </li>
            ))}
          </ul>
        ) : total === 0 ? (
          <EmptyState
            className="px-8 py-14"
            icon={SearchX}
            title="No LGU projects match"
            description={emptyHint ?? 'There are no projects in this snapshot.'}
            action={
              onClearFilters && (
                <button type="button" onClick={onClearFilters} className={secondaryButtonSmClass}>
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Clear search and filters
                </button>
              )
            }
          />
        ) : (
          <div className="p-3 sm:p-4">
            {mode.kind === 'stack' ? (
              <PagedList ids={mode.ids} selectedId={selectedId} onSelect={onSelect} label="Projects at this location" />
            ) : mode.kind === 'unmapped' ? (
              <PagedList ids={unmappedIds} selectedId={selectedId} onSelect={onSelect} label="Projects not on the map" />
            ) : inViewIds.length === 0 ? (
              <EmptyState compact icon={MapPin} title="Nothing in this part of the map" description="Zoom out or move the map to see matching projects." />
            ) : (
              <PagedList ids={inViewIds} selectedId={selectedId} onSelect={onSelect} label="Projects in view" />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
