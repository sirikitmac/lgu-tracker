'use client';

import React from 'react';
import { Database, FileText, Info, RefreshCw } from 'lucide-react';
import type { DpwhCount, DpwhSummary } from '@/types/dpwh';
import { categoryLabel, formatCount, formatDate, formatPesoCompact, statusColor, statusLabel } from './format';

/**
 * Nationwide totals and simple bar lists. Each list is a single series, so
 * bars share one hue and carry their value as text (the list doubles as the
 * table view). Contract amounts are award amounts as reported, never
 * disbursements, and are never added to other amount fields.
 */

function BarList({
  title,
  rows,
  label,
  onSelect,
  selected,
  swatch,
  note,
}: {
  title: string;
  rows: DpwhCount<string | null>[];
  label: (value: string | null) => string;
  onSelect?: (value: string | null) => void;
  selected?: string | null;
  /** Key color shown beside each label (status lists match the map legend). */
  swatch?: (value: string | null) => string;
  note?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section aria-label={title} className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs">
      <h3 className="font-display text-sm font-bold text-[#172B4D] mb-3">{title}</h3>
      <ul className="space-y-1">
        {rows.map((row) => {
          const name = label(row.value);
          const isSelected = selected !== undefined && selected === row.value;
          return (
            <li key={String(row.value)}>
              <button
                type="button"
                disabled={!onSelect || row.value === null}
                onClick={() => onSelect?.(isSelected ? null : row.value)}
                title={`${name}: ${formatCount(row.count)} contracts`}
                className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  onSelect && row.value !== null ? 'hover:bg-[#F1F5F9] cursor-pointer' : 'cursor-default'
                } ${isSelected ? 'bg-[#EFF6FF] ring-1 ring-[#2563EB]' : ''}`}
              >
                <span className="truncate text-[#0F172A]">
                  {swatch && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: swatch(row.value) }} aria-hidden="true" />}
                  {name}
                </span>
                <span className="tabular-nums text-[#64748B]">{formatCount(row.count)}</span>
                <span className="col-span-2 h-2 rounded-r bg-[#F1F5F9]" aria-hidden="true">
                  <span className="block h-2 rounded-r bg-[#2563EB]" style={{ width: `${Math.max(1, (row.count / max) * 100)}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {note && <p className="mt-2 text-[11px] text-[#64748B] leading-relaxed">{note}</p>}
    </section>
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
  const withValue = stats.contract_amount.contracts_with_value;
  const regions = stats.by_region.map((r) => ({ ...r, value: r.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-xs text-[#1E3A8A] leading-relaxed">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          {summary.source_snapshot_at ? (
            <>
              <strong>Scope:</strong> all DPWH infrastructure contracts in BetterGov.ph&apos;s published snapshot of the DPWH
              Transparency Portal (CC0), snapshot of <strong>{formatDate(summary.source_snapshot_at)}</strong>.
            </>
          ) : (
            // No sync has finished: the stored contracts are a partial import.
            <>
              <strong>Scope:</strong> the DPWH contracts imported so far from BetterGov.ph&apos;s published snapshot of the
              DPWH Transparency Portal (CC0). The import has not completed, so this is not the full snapshot.
            </>
          )}{' '}
          Values are as reported by DPWH and have not been
          verified by the LGU. Location comes from the contract components DPWH reports, not from the implementing office.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-[#64748B]"><Database className="w-4 h-4" /> Contracts in directory</div>
          <p className="font-display text-2xl font-bold text-[#172B4D] mt-1 tabular-nums">{formatCount(stats.total_contracts)}</p>
          <p className="text-xs text-[#64748B] mt-1">Unique DPWH contract IDs</p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-[#64748B]"><FileText className="w-4 h-4" /> Total reported contract amount</div>
          <p className="font-display text-2xl font-bold text-[#172B4D] mt-1 tabular-nums">{formatPesoCompact(Number(stats.contract_amount.sum))}</p>
          <p className="text-xs text-[#64748B] mt-1">
            Award amounts for {formatCount(withValue)} of {formatCount(stats.total_contracts)} contracts. Not disbursements or audited spending.
          </p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-[#64748B]"><RefreshCw className="w-4 h-4" /> Last successful sync</div>
          <p className="font-display text-lg font-bold text-[#172B4D] mt-1">{formatDate(summary.last_successful_sync_at)}</p>
          <p className="text-xs text-[#64748B] mt-1">
            Source snapshot {formatDate(summary.source_snapshot_at)}. Weekly checks do not make an old snapshot current.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BarList title="Contracts by reported region" rows={regions} label={(v) => v ?? 'Location not reported'}
          onSelect={onSelectRegion} selected={selectedRegion} />
        <BarList title="Contracts by category" rows={stats.by_category} label={categoryLabel}
          onSelect={onSelectCategory} selected={selectedCategory} />
        <BarList title="Contracts by status" rows={stats.by_status} label={statusLabel}
          onSelect={onSelectStatus} selected={selectedStatus} swatch={statusColor}
          note="Status as reported by DPWH for each contract. FY 2027 NEP budget proposals are not contracts and are not counted here; filter by status “Proposed (budget)” to list them." />
      </div>
    </div>
  );
}
