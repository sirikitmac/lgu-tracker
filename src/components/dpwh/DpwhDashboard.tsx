'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { DpwhCount, DpwhStatus, DpwhSummary } from '@/types/dpwh';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { DataScopeNote } from './DataScopeNote';
import { categoryLabel, formatCount, formatPeso, formatPesoCompact, formatShare, statusColor, statusLabel } from './format';
import { controlBaseClass, panelClass, secondaryButtonClass, secondaryButtonSmClass } from './ui';

/**
 * The public dashboard. Contract figures come from the cached summary only;
 * NEP budget proposals are a separate dataset, counted on their own and never
 * added to a contract total. With a region selected, figures switch to that
 * region where the summary has a per-region breakdown, and say "all regions"
 * where it does not.
 */

const ALL_STATUSES_ORDER: DpwhStatus[] = ['completed', 'ongoing', 'for_procurement', 'not_yet_started', 'terminated', 'unknown'];

function Panel({ title, note, children, className = '', action }: { title: string; note?: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${panelClass} flex flex-col p-5 sm:p-6 min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-semibold text-ink">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-muted leading-relaxed">{note}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 flex-1 min-w-0">{children}</div>
    </section>
  );
}

/** A KPI is a figure and its denominator in words, not a tile with an icon. */
function Figure({ label, value, detail, title }: { label: string; value: React.ReactNode; detail: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6 sm:py-5">
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.025em] text-ink tabular-nums" title={title}>
        {value}
      </dd>
      <dd className="mt-2 text-xs text-muted leading-relaxed">{detail}</dd>
    </div>
  );
}

/**
 * Ranked horizontal bars. Each row is a real button when it filters; its
 * colour swatch, name, count and share are all printed, so the bar never
 * carries meaning alone.
 */
function RankedBars<T extends string | null>({
  rows,
  total,
  label,
  color,
  selected,
  onSelect,
  swatchShape = 'square',
  unit = 'contracts',
}: {
  rows: DpwhCount<T>[];
  total: number;
  label: (value: T) => string;
  color: (value: T) => string;
  selected?: T | null;
  onSelect?: (value: T | null) => void;
  swatchShape?: 'square' | 'round';
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <ul className="-mx-2 space-y-0.5">
      {rows.map((row) => {
        const name = label(row.value);
        const isSelected = selected !== undefined && selected !== null && selected === row.value;
        const dimmed = selected !== undefined && selected !== null && !isSelected;
        const share = formatShare(row.count, total);
        const content = (
          <>
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 shrink-0 ${swatchShape === 'round' ? 'rounded-full' : 'rounded-[3px]'}`}
                style={{ backgroundColor: color(row.value) }}
                aria-hidden="true"
              />
              <span className={`truncate ${isSelected ? 'font-semibold' : ''}`}>{name}</span>
            </span>
            <span className="tabular-nums text-right text-ink font-medium">{formatCount(row.count)}</span>
            <span className="tabular-nums text-right text-muted">{share}</span>
            <span className="col-span-3 block h-2 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
              <span
                className="block h-full rounded-full origin-left transition-transform duration-700 ease-[var(--ease-out)]"
                style={{
                  width: row.count > 0 ? `max(4px, ${(row.count / max) * 100}%)` : 0,
                  backgroundColor: color(row.value),
                  transform: drawn ? 'scaleX(1)' : 'scaleX(0)',
                }}
              />
            </span>
          </>
        );
        const rowClass = `w-full text-left grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-x-3 gap-y-1.5 px-2 py-2 rounded-xl text-[13px] text-ink transition-[background-color,opacity] ${
          dimmed ? 'opacity-45 hover:opacity-100' : ''
        }`;
        return (
          <li key={String(row.value)}>
            {onSelect && row.value !== null ? (
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : row.value)}
                title={`${name}: ${formatCount(row.count)} ${unit} (${share}). ${isSelected ? 'Select again to show all regions.' : 'Select to focus the dashboard on this region.'}`}
                className={`${rowClass} hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-ink ${isSelected ? 'bg-sunken' : ''}`}
              >
                {content}
              </button>
            ) : (
              <div className={rowClass} title={`${name}: ${formatCount(row.count)} ${unit} (${share})`}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Donut of contract statuses. The legend beside it is the accessible
 * version (every status with count and share); the ring is decorative for
 * screen readers. Hovering or focusing a legend row (or hovering a segment)
 * puts that status in the centre; otherwise the centre shows the total.
 */
function StatusDonut({ rows, total }: { rows: DpwhCount<DpwhStatus>[]; total: number }) {
  const [active, setActive] = useState<DpwhStatus | null>(null);
  const ordered = useMemo(
    () => [...rows].filter((r) => r.count > 0).sort((a, b) => ALL_STATUSES_ORDER.indexOf(a.value) - ALL_STATUSES_ORDER.indexOf(b.value)),
    [rows]
  );
  const size = 180;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // A 2px gap between segments, in the surface colour; very small statuses
  // still get a visible sliver (and their exact share is in the legend).
  const gap = ordered.length > 1 ? 2 : 0;
  let offset = 0;
  const segments = ordered.map((row) => {
    const len = Math.max((row.count / Math.max(1, total)) * c - gap, 1.5);
    const seg = { row, len, offset };
    offset += len + gap;
    return seg;
  });
  const shown = ordered.find((r) => r.value === active) ?? null;
  const summary = ordered.map((r) => `${statusLabel(r.value)} ${formatCount(r.count)} (${formatShare(r.count, total)})`).join(', ');

  if (total === 0) return <p className="text-sm text-muted">No contracts to show.</p>;

  return (
    <div className="h-full flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Contracts by status: ${summary}.`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth={stroke} />
          {segments.map(({ row, len, offset: o }) => (
            <circle
              key={row.value}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={statusColor(row.value)}
              strokeWidth={active === row.value ? stroke + 4 : stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-o}
              opacity={active && active !== row.value ? 0.35 : 1}
              onPointerEnter={() => setActive(row.value)}
              onPointerLeave={() => setActive(null)}
              className="transition-[opacity,stroke-width] duration-200 cursor-default"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none" aria-hidden="true">
          <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
            {shown ? formatShare(shown.count, total) : formatCount(total)}
          </span>
          <span className="mt-1.5 max-w-[7.5rem] text-xs leading-tight text-muted">
            {shown ? `${statusLabel(shown.value)} · ${formatCount(shown.count)}` : 'contracts'}
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-0.5">
        {ordered.map((row) => (
          <li key={row.value}>
            <button
              type="button"
              onPointerEnter={() => setActive(row.value)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(row.value)}
              onBlur={() => setActive(null)}
              className={`w-full grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-x-3 px-2 py-1.5 rounded-lg text-left text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent-ink ${active === row.value ? 'bg-sunken' : ''}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor(row.value) }} aria-hidden="true" />
                <span className="truncate">{statusLabel(row.value)}</span>
              </span>
              <span className="tabular-nums text-right font-medium">{formatCount(row.count)}</span>
              <span className="tabular-nums text-right text-muted">{formatShare(row.count, total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Contracts per infrastructure year as columns; each column states its value on hover/focus and to screen readers. */
function YearColumns({ rows }: { rows: DpwhCount<number | null>[] }) {
  const years = rows.filter((r): r is DpwhCount<number> => r.value !== null).sort((a, b) => a.value - b.value);
  const unknown = rows.find((r) => r.value === null)?.count ?? 0;
  const max = Math.max(1, ...years.map((y) => y.count));
  if (years.length === 0) return <p className="text-sm text-muted">No infrastructure years reported.</p>;
  return (
    <div>
      <ul className="flex items-end gap-1.5 sm:gap-2 h-40" aria-label="Contracts by infrastructure year">
        {years.map((y) => (
          <li key={y.value} className="group relative flex-1 h-full flex flex-col justify-end items-center min-w-0">
            <span
              className="absolute -top-1 -translate-y-full px-1.5 py-0.5 rounded-md bg-raised border border-line text-[11px] text-ink tabular-nums whitespace-nowrap shadow-raise opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none z-10"
              aria-hidden="true"
            >
              {formatCount(y.count)}
            </span>
            <span
              tabIndex={0}
              role="img"
              aria-label={`${y.value}: ${formatCount(y.count)} contracts`}
              className="block w-full max-w-9 rounded-t-[4px] bg-subtle/80 group-hover:bg-ink focus-visible:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink transition-colors"
              style={{ height: `${Math.max(2, (y.count / max) * 100)}%` }}
            />
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 sm:gap-2 mt-2 border-t border-line pt-1.5" aria-hidden="true">
        {years.map((y) => (
          <span key={y.value} className="flex-1 text-center text-[11px] text-muted tabular-nums">
            {years.length > 8 ? `’${String(y.value).slice(-2)}` : y.value}
          </span>
        ))}
      </div>
      {unknown > 0 && <p className="mt-2 text-xs text-muted">{formatCount(unknown)} contracts report no infrastructure year.</p>}
    </div>
  );
}

export function DpwhDashboard({
  summary,
  nepCount,
  error,
  initialRegion,
}: {
  summary: DpwhSummary | null;
  nepCount: number | null;
  error: string | null;
  initialRegion: string;
}) {
  const stats = summary?.stats;
  const regions = useMemo(() => stats?.by_region ?? [], [stats]);
  const [region, setRegion] = useState<string | null>(() => (regions.some((r) => r.value === initialRegion) ? initialRegion : null));

  // Mirror the region into the address bar so the view can be shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (region) url.searchParams.set('region', region);
    else url.searchParams.delete('region');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [region]);

  if (!stats || !summary) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div role="alert" className="flex items-start gap-2 p-4 rounded-card border border-warn-line bg-warn-soft text-sm text-warn-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {error ?? 'No DPWH contracts have been imported yet, so there is nothing to chart.'}
        </div>
      </div>
    );
  }

  const total = stats.total_contracts;
  const detail = region ? stats.by_region_detail?.find((d) => d.region === region) : undefined;
  const regionCount = region ? (regions.find((r) => r.value === region)?.count ?? 0) : total;
  // Breakdowns for the selected region when the summary carries them; otherwise all regions.
  const scoped = !region || !!detail;
  const statusRows = detail?.by_status ?? stats.by_status;
  const categoryRows = detail?.by_category ?? stats.by_category;
  const breakdownTotal = detail ? detail.count : total;
  const amount = detail ? detail.amount_sum : Number(stats.contract_amount.sum);
  const withValue = detail ? detail.contracts_with_value : stats.contract_amount.contracts_with_value;
  const count = (status: DpwhStatus) => statusRows.find((s) => s.value === status)?.count ?? 0;
  const completed = count('completed');
  const ongoing = count('ongoing');
  const scopeWord = region ? regionDisplayName(region) : 'All regions';
  const allRegionsNote = region && !scoped ? 'All regions: the published summary has no per-region breakdown yet.' : undefined;

  const provinces = region
    ? (stats.provinces ?? []).filter((p) => p.region === region).map((p) => ({ value: p.province, count: p.count })).sort((a, b) => b.count - a.count)
    : [];
  const projectsHref = `/projects${region ? `?region=${encodeURIComponent(region)}` : ''}`;

  return (
    <div className="space-y-6">
      <DashboardHeader>
        <label className="flex items-center gap-2 text-[13px] font-medium text-subtle">
          <span>Region</span>
          <select
            className={`${controlBaseClass} h-10 pl-3.5 pr-8 rounded-full text-sm max-w-[16rem]`}
            value={region ?? ''}
            onChange={(e) => setRegion(e.target.value || null)}
          >
            <option value="">All regions</option>
            {[...regions].filter((r) => r.value).sort((a, b) => String(a.value).localeCompare(String(b.value), 'en', { numeric: true })).map((r) => (
              <option key={r.value} value={r.value as string}>{regionDisplayName(r.value)}</option>
            ))}
          </select>
        </label>
        {region && (
          <button type="button" onClick={() => setRegion(null)} className={secondaryButtonSmClass} aria-label={`Clear region ${region}`}>
            <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: regionColor(region) }} aria-hidden="true" />
            {region} <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </DashboardHeader>

      <DataScopeNote summary={summary} />

      <section aria-label={`Summary: ${scopeWord}`} className={`${panelClass} overflow-hidden`}>
        <dl className="grid grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] gap-px bg-line [&>*]:bg-surface">
          <Figure label="Contracts" value={formatCount(regionCount)} detail={region ? `${formatShare(regionCount, total)} of ${formatCount(total)} contracts` : 'Unique DPWH contract IDs'} />
          <Figure
            label="Reported contract value"
            value={formatPesoCompact(amount)}
            title={formatPeso(amount)}
            detail={
              scoped ? (
                <>Award amounts for {formatCount(withValue)} of {formatCount(detail ? detail.count : total)} contracts; not disbursements.</>
              ) : (
                'All regions; not yet broken down by region.'
              )
            }
          />
          <Figure
            label="Completed"
            value={formatCount(completed)}
            detail={scoped ? `${formatShare(completed, breakdownTotal)} of contracts` : `All regions (${formatShare(completed, breakdownTotal)})`}
          />
          <Figure
            label="On-going"
            value={formatCount(ongoing)}
            detail={scoped ? `${formatShare(ongoing, breakdownTotal)} of contracts` : `All regions (${formatShare(ongoing, breakdownTotal)})`}
          />
          <div className="col-span-2 lg:col-span-1 !bg-sunken">
            <Figure
              label="FY 2027 budget proposals"
              value={nepCount === null ? '—' : formatCount(nepCount)}
              detail={nepCount === null ? 'Count unavailable right now.' : 'NEP items, nationwide. A separate dataset: not contracts, not in any figure on the left.'}
            />
          </div>
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Contracts by region"
          note={`Where the contract's components are located. Select a region to focus the dashboard. ${formatCount(regions.length)} regions, ${formatCount(total)} contracts.`}
          className="lg:col-span-2"
        >
          <RankedBars
            rows={regions}
            total={total}
            label={(v) => (v ? regionDisplayName(v) : 'Location not reported')}
            color={(v) => regionColor(v)}
            selected={region}
            onSelect={(v) => setRegion(v)}
          />
        </Panel>

        <Panel title="Contracts by status" note={allRegionsNote ?? `${scopeWord}. Status as reported by DPWH.`}>
          <StatusDonut rows={statusRows} total={breakdownTotal} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Contracts by category" note={allRegionsNote ?? `${scopeWord}. Category assigned from the DPWH record.`}>
          <RankedBars rows={categoryRows} total={breakdownTotal} label={categoryLabel} color={() => 'var(--color-subtle)'} />
        </Panel>

        {region ? (
          <Panel
            title={`Provinces in ${region}`}
            note="Contracts with a component in each province. A contract spanning provinces counts in each, so these can sum above the region's total."
          >
            {provinces.length ? (
              <div className="max-h-[22rem] overflow-y-auto pr-1">
                <RankedBars rows={provinces} total={regionCount} label={(v) => v} color={() => regionColor(region)} />
              </div>
            ) : (
              <p className="text-sm text-muted">No provinces reported for this region.</p>
            )}
          </Panel>
        ) : (
          <Panel title="Contracts by infrastructure year" note="All regions. The year DPWH assigns to each contract's programme.">
            <YearColumns rows={stats.infra_years ?? []} />
          </Panel>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted">Figures computed from the published snapshot; select any region above to see its provinces.</p>
        <Link href={projectsHref} className={secondaryButtonClass}>
          {region ? `Browse ${formatCount(regionCount)} contracts in ${region}` : 'Browse all projects'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function DashboardHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="page-title text-[30px] sm:text-[36px] text-ink">Dashboard</h1>
        <p className="mt-1.5 text-[15px] text-subtle">What the published DPWH contracts show, by region, status and category.</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>}
    </header>
  );
}
