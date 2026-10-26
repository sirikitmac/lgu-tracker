'use client';

import React from 'react';
import { Database, FileText, Info, RefreshCw } from 'lucide-react';
import type { DpwhCount, DpwhSummary } from '@/types/dpwh';
import { categoryLabel, formatCount, formatDate, formatPeso, formatPesoCompact, formatShare, statusColor, statusLabel } from './format';
import { panelClass } from './ui';

/**
 * Nationwide totals and simple bar lists. Each list is a single series, so
 * bars share one hue and carry their value as text (the list doubles as the
 * table view). Contract amounts are award amounts as reported, never
 * disbursements, and are never added to other amount fields. Shares are of
 * total_contracts: every breakdown in the summary sums to it.
 */

function BarList({
  title,
  rows,
  total,
  label,
  onSelect,
  selected,
  swatch,
  note,
  footer,
  className = '',
}: {
  title: string;
  rows: DpwhCount<string | null>[];
  total: number;
  label: (value: string | null) => string;
  onSelect?: (value: string | null) => void;
  selected?: string | null;
  /** Key color shown beside each label (status lists match the map legend). */
  swatch?: (value: string | null) => string;
  note?: string;
  /** A total pinned to the card's foot when the card stretches to its neighbour. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={`${panelClass} flex flex-col p-5 sm:p-6 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id={headingId} className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        <span className="grid grid-cols-[auto_3.25rem] gap-x-3 text-xs text-muted" aria-hidden="true">
          <span className="text-right">Contracts</span>
          <span className="text-right">Share</span>
        </span>
      </div>
      {/* With a footer the card stretches to its neighbour; the rows share the extra height evenly. */}
      <ul className={`-mx-2 ${footer ? 'flex-1 flex flex-col justify-around' : ''}`}>
        {rows.map((row) => {
          const name = label(row.value);
          const isSelected = selected !== undefined && selected === row.value;
          const selectable = !!onSelect && row.value !== null;
          return (
            <li key={String(row.value)}>
              <button
                type="button"
                disabled={!selectable}
                aria-pressed={selectable ? isSelected : undefined}
                onClick={() => onSelect?.(isSelected ? null : row.value)}
                title={`${name}: ${formatCount(row.count)} contracts (${formatShare(row.count, total)})${selectable ? (isSelected ? '. Select again to clear the filter.' : '. Select to filter the directory.') : ''}`}
                className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto_3.25rem] items-center gap-x-3 gap-y-1.5 px-2 py-2 rounded-lg text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-ink ${
                  selectable ? 'hover:bg-sunken cursor-pointer' : 'cursor-default'
                } ${isSelected ? 'bg-accent-soft ring-1 ring-inset ring-accent' : ''}`}
              >
                <span className="flex items-center gap-2 min-w-0 text-ink">
                  {swatch && <span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: swatch(row.value) }} aria-hidden="true" />}
                  <span className={`line-clamp-2 break-words leading-snug ${isSelected ? 'font-semibold text-ink' : ''}`}>{name}</span>
                </span>
                <span className="tabular-nums text-right text-ink">{formatCount(row.count)}</span>
                <span className="tabular-nums text-right text-muted">{formatShare(row.count, total)}</span>
                <span className="col-span-3 block h-1.5" aria-hidden="true">
                  <span
                    className="block h-1.5 rounded-full bg-accent-data transition-[width] duration-500 ease-out"
                    style={{ width: row.count > 0 ? `max(3px, ${(row.count / max) * 100}%)` : 0 }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-3 text-xs text-muted leading-relaxed">{note}</p>}
      {footer && <div className="mt-auto pt-3 border-t border-line text-xs text-muted">{footer}</div>}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  children,
  detail,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className="p-5 sm:p-6 min-w-0">
      <dt className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <Icon className="w-4 h-4 shrink-0" aria-hidden={true} /> {label}
      </dt>
      <dd className="mt-3">{children}</dd>
      <dd className="mt-1.5 text-xs text-muted leading-relaxed">{detail}</dd>
    </div>
  );
}

export function DpwhSummaryPanel({
  summary,
  selectedRegion,
  selectedCategory,
  selectedStatus,
  onSelectRegion,
  onSelectCategory,
  onSelectStatus,
}: {
  summary: DpwhSummary;
  selectedRegion: string | null;
  selectedCategory: string | null;
  selectedStatus: string | null;
  onSelectRegion: (value: string | null) => void;
  onSelectCategory: (value: string | null) => void;
  onSelectStatus: (value: string | null) => void;
}) {
  const { stats } = summary;
  const total = stats.total_contracts;
  const withValue = stats.contract_amount.contracts_with_value;
  const amount = Number(stats.contract_amount.sum);
  // Headline figures in the landing page's display serif, at app size.
  const figureClass = 'font-serif text-[40px] leading-none tracking-tight text-ink';

  return (
    <div className="space-y-5">
      <aside aria-label="About this data" className="flex items-start gap-3 px-4 py-3.5 sm:px-5 rounded-card bg-sunken text-ink">
        <Info className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent-ink" aria-hidden="true" />
        <div className="space-y-1 text-[13px] leading-relaxed max-w-[110ch]">
          <p>
            {summary.source_snapshot_at ? (
              <>
                <strong className="font-semibold">Scope:</strong> all DPWH infrastructure contracts in BetterGov.ph&apos;s published
                snapshot of the DPWH Transparency Portal (CC0), snapshot of <strong className="font-semibold">{formatDate(summary.source_snapshot_at)}</strong>.
              </>
            ) : (
              // No sync has finished: the stored contracts are a partial import.
              <>
                <strong className="font-semibold">Scope:</strong> the DPWH contracts imported so far from BetterGov.ph&apos;s published
                snapshot of the DPWH Transparency Portal (CC0). The import has not completed, so this is not the full snapshot.
              </>
            )}
          </p>
          <p>
            Values are as reported by DPWH and have not been verified by the LGU. Location comes from the contract components
            DPWH reports, not from the implementing office.
          </p>
        </div>
      </aside>

      <section aria-label="Directory totals" className={panelClass}>
        <dl className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
          <Metric icon={Database} label="Contracts in directory" detail="Unique DPWH contract IDs">
            <span className={figureClass}>{formatCount(total)}</span>
          </Metric>
          <Metric
            icon={FileText}
            label="Total reported contract amount"
            detail={<>Award amounts for {formatCount(withValue)} of {formatCount(total)} contracts. Not disbursements or audited spending.</>}
          >
            <span className={figureClass} title={formatPeso(amount)}>{formatPesoCompact(amount)}</span>
            <span className="block mt-1.5 text-xs text-muted tabular-nums">{formatPeso(amount)}</span>
          </Metric>
          <Metric
            icon={RefreshCw}
            label="Last successful sync"
            detail={
              <>
                Source snapshot: {summary.source_snapshot_at ? formatDate(summary.source_snapshot_at) : 'not available'}. Weekly checks do
                not make an old snapshot current.
                {summary.computed_at && <span className="block mt-1">Figures computed {formatDate(summary.computed_at)}.</span>}
              </>
            }
          >
            {summary.last_successful_sync_at ? (
              <span className="font-serif text-[32px] leading-none tracking-tight text-ink">{formatDate(summary.last_successful_sync_at)}</span>
            ) : (
              <span className="block pt-2 text-base leading-tight font-semibold text-subtle">No completed sync yet</span>
            )}
          </Metric>
        </dl>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BarList
          title="Contracts by reported region"
          rows={stats.by_region}
          total={total}
          label={(v) => v ?? 'Location not reported'}
          onSelect={onSelectRegion}
          selected={selectedRegion}
          footer={
            <span className="flex justify-between gap-3">
              <span>{formatCount(stats.by_region.length)} {stats.by_region.length === 1 ? 'region' : 'regions'}</span>
              <span className="tabular-nums">{formatCount(total)} contracts</span>
            </span>
          }
        />
        <div className="flex flex-col gap-5">
          <BarList title="Contracts by category" rows={stats.by_category} total={total} label={categoryLabel}
            onSelect={onSelectCategory} selected={selectedCategory} />
          <BarList title="Contracts by status" rows={stats.by_status} total={total} label={statusLabel}
            onSelect={onSelectStatus} selected={selectedStatus} swatch={statusColor} className="flex-1"
            note="Status as reported by DPWH for each contract. FY 2027 NEP budget proposals are not contracts and are not counted here; filter by status “Proposed (budget)” to list them." />
        </div>
      </div>
    </div>
  );
}
