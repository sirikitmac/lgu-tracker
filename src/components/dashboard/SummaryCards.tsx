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
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#64748B]">
            Total Monitored Projects
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <FolderKanban
              className="w-4 h-4 text-[#172B4D]"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-mono text-2xl sm:text-3xl font-bold text-[#0F172A] tabular-nums leading-none">
            {metrics.totalProjects}
          </p>
          <p className="text-xs text-[#64748B] mt-2">
            Across 4 priority municipal sectors
          </p>
        </div>
      </div>

      {/* Projects In Progress */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#64748B]">
            Projects In Progress
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-mono text-2xl sm:text-3xl font-bold text-[#2563EB] tabular-nums leading-none">
            {metrics.inProgressProjects}
          </p>
          <p className="text-xs text-[#64748B] mt-2">
            Active civil works &amp; field implementation
          </p>
        </div>
      </div>

      {/* Completed Projects */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#64748B]">
            Completed Projects
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <CheckCircle2
              className="w-4 h-4 text-[#16A34A]"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="mt-3">
          <p className="font-mono text-2xl sm:text-3xl font-bold text-[#16A34A] tabular-nums leading-none">
            {metrics.completedProjects}
          </p>
          <p className="text-xs text-[#64748B] mt-2">
            Inspected &amp; turned over to barangays
          </p>
        </div>
      </div>

      {/* Allocated Budget */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs flex flex-col justify-between min-h-[124px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#64748B]">
            Allocated Budget (Sample)
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3">
          <p
            className="font-mono text-2xl sm:text-3xl font-bold text-[#0F172A] tabular-nums leading-none"
            title={formatPHP(metrics.totalAllocatedBudget)}
          >
            {formatPHP(metrics.totalAllocatedBudget, true)}
          </p>
          <p className="text-xs text-[#64748B] mt-2 font-mono tabular-nums">
            {formatPHP(metrics.totalDisbursedBudget, true)} disbursed (
            {utilizationRate}%)
          </p>
        </div>
      </div>
    </section>
  );
}
