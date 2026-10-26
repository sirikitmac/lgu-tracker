import React from 'react';
import {
  FolderKanban,
  Clock,
  CheckCircle2,
  Landmark,
} from 'lucide-react';
import { SummaryMetrics } from '@/types/project';
import { formatPHP } from '@/data/sampleProjects';

interface SummaryCardsProps {
  metrics: SummaryMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const utilizationRate =
    metrics.totalAllocatedBudget > 0
      ? Math.round(
          (metrics.totalDisbursedBudget / metrics.totalAllocatedBudget) * 100
        )
      : 0;

  return (
    <section
      aria-label="Project Summary Statistics"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {/* Total Projects */}
      <div className="bg-surface border border-line rounded-card p-5 flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">
            Total Monitored Projects
          </span>
          <div className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
            <FolderKanban
              className="w-4 h-4 text-ink"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-semibold text-[36px] tracking-tight text-ink tabular-nums leading-none">
            {metrics.totalProjects}
          </p>
          <p className="text-xs text-muted mt-2">
            Across 4 priority municipal sectors
          </p>
        </div>
      </div>

      {/* Projects In Progress */}
      <div className="bg-surface border border-line rounded-card p-5 flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">
            Projects In Progress
          </span>
          <div className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#2563EB] dark:text-blue-400" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-semibold text-[36px] tracking-tight text-[#2563EB] dark:text-blue-400 tabular-nums leading-none">
            {metrics.inProgressProjects}
          </p>
          <p className="text-xs text-muted mt-2">
            Active civil works &amp; field implementation
          </p>
        </div>
      </div>

      {/* Completed Projects */}
      <div className="bg-surface border border-line rounded-card p-5 flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">
            Completed Projects
          </span>
          <div className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
            <CheckCircle2
              className="w-4 h-4 text-[#16A34A]"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-semibold text-[36px] tracking-tight text-[#16A34A] tabular-nums leading-none">
            {metrics.completedProjects}
          </p>
          <p className="text-xs text-muted mt-2">
            Inspected &amp; turned over to barangays
          </p>
        </div>
      </div>

      {/* Allocated Budget */}
      <div className="bg-surface border border-line rounded-card p-5 flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">
            Allocated Budget (Sample)
          </span>
          <div className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3">
          <p
            className="font-semibold text-[36px] tracking-tight text-ink tabular-nums leading-none"
            title={formatPHP(metrics.totalAllocatedBudget)}
          >
            {formatPHP(metrics.totalAllocatedBudget, true)}
          </p>
          <p className="text-xs text-muted mt-2 tabular-nums">
            {formatPHP(metrics.totalDisbursedBudget, true)} disbursed (
            {utilizationRate}%)
          </p>
        </div>
      </div>
    </section>
  );
}
