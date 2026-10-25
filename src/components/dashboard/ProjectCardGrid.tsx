'use client';

import React from 'react';
import {
  ArrowUpRight,
  FolderSearch,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react';
import { LGUProject } from '@/types/project';
import { formatPHP } from '@/data/sampleProjects';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface ProjectCardGridProps {
  projects: LGUProject[];
  onSelectProject: (project: LGUProject) => void;
  onResetFilters: () => void;
}

export function ProjectCardGrid({
  projects,
  onSelectProject,
  onResetFilters,
}: ProjectCardGridProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-white civic-subtle-grid border border-[#E2E8F0] rounded-xl p-10 sm:p-12 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mx-auto mb-3.5">
          <FolderSearch
            className="w-6 h-6 text-[#64748B]"
            aria-hidden="true"
          />
        </div>
        <h3 className="font-display text-base font-bold text-[#0F172A]">
          No Matching LGU Projects Found
        </h3>
        <p className="text-sm text-[#64748B] max-w-md mx-auto mt-1.5 leading-relaxed">
          No sample project records match your current search query or selected filters.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-5 inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#172B4D] rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {projects.map((project) => {
        const progressBarColor =
          project.status === 'Completed'
            ? 'bg-[#16A34A]'
            : project.status === 'Delayed'
            ? 'bg-[#DC2626]'
            : project.status === 'Procurement' || project.status === 'Planned'
            ? 'bg-[#D97706]'
            : 'bg-[#2563EB]';

        return (
          <article
            key={project.id}
            onClick={() => onSelectProject(project)}
            className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md hover:border-[#2563EB]/40 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
          >
            <div>
              {/* Clean Project Picture Holder */}
              <div className="relative h-36 w-full bg-[#F8FAFC] civic-subtle-grid border-b border-[#E2E8F0] flex flex-col items-center justify-center overflow-hidden">
                {project.imageUrl ? (
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-[#64748B] group-hover:text-[#2563EB] transition-colors">
                    <ImageIcon className="w-6 h-6 mb-1.5 opacity-75" aria-hidden="true" />
                    <span className="text-[11px] font-medium text-[#64748B]">
                      Project Photo
                    </span>
                  </div>
                )}
              </div>

              {/* Essential Card Info: Barangay, Status & Shortened Title */}
              <div className="p-5 pb-4">
                <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#64748B] truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                    <span className="truncate">{project.barangay}</span>
                  </span>
                  <StatusBadge status={project.status} />
                </div>

                <h3
                  title={project.title}
                  className="font-display text-base font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors mt-2 leading-snug truncate"
                >
                  {project.title}
                </h3>
              </div>
            </div>

            {/* Compact Footer: Progress, Budget & Action */}
            <div className="px-5 pb-5 pt-3 border-t border-[#E2E8F0]/80 space-y-3.5">
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#64748B]">Progress</span>
                  <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                    {project.progressPercentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressBarColor} transition-all`}
                    style={{ width: `${project.progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Budget & Details Button */}
              <div
                className="flex items-center justify-between gap-3 pt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <span className="block text-[11px] text-[#64748B]">
                    Budget
                  </span>
                  <span className="font-mono text-sm font-bold text-[#0F172A] tabular-nums">
                    {formatPHP(project.allocatedBudget)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectProject(project)}
                  className="inline-flex items-center gap-1 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-[#172B4D] hover:text-white bg-[#F8FAFC] hover:bg-[#2563EB] border border-[#E2E8F0] hover:border-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                >
                  <span>Details</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
