'use client';

import React from 'react';
import { Eye, FolderSearch } from 'lucide-react';
import { LGUProject } from '@/types/project';
import { formatPHP } from '@/data/sampleProjects';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { lguStatusTone } from '@/lib/statusPalette';

interface ProjectTableProps {
  projects: LGUProject[];
  onSelectProject: (project: LGUProject) => void;
  onResetFilters: () => void;
}

export function ProjectTable({
  projects,
  onSelectProject,
  onResetFilters,
}: ProjectTableProps) {
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
          No sample project records match your current search query or selected filters. Try adjusting your search terms or resetting the filter criteria.
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
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B]">
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                Ref Code
              </th>
              <th scope="col" className="py-3.5 px-4 min-w-[260px]">
                Project Title &amp; Barangay
              </th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                Sector &amp; Office
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-right whitespace-nowrap"
              >
                Allocated Budget
              </th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                Physical Progress
              </th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                Status
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-right whitespace-nowrap"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-sm">
            {projects.map((project) => {
              const progressBarColor = lguStatusTone(project.status).fill;

              return (
                <tr
                  key={project.id}
                  tabIndex={0}
                  onClick={() => onSelectProject(project)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectProject(project);
                    }
                  }}
                  className="hover:bg-[#F8FAFC] focus-visible:bg-[#F1F5F9] focus-visible:outline-none transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4 font-mono text-xs font-medium text-[#64748B] whitespace-nowrap tabular-nums">
                    {project.referenceCode}
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors line-clamp-1">
                      {project.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                      <span>{project.barangay}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Target: {project.targetCompletionDate}
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="text-xs font-medium text-[#0F172A] whitespace-nowrap">
                      {project.category}
                    </div>
                    <div className="text-xs text-[#64748B] truncate max-w-[200px] mt-0.5">
                      {project.implementingOffice}
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right font-mono text-xs font-semibold text-[#0F172A] whitespace-nowrap tabular-nums">
                    <div>{formatPHP(project.allocatedBudget)}</div>
                    <div className="text-[11px] font-normal text-[#64748B] mt-0.5">
                      Disbursed: {formatPHP(project.disbursedBudget, true)}
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-24 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${project.progressPercentage}%`, backgroundColor: progressBarColor }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#0F172A] tabular-nums w-9 text-right">
                        {project.progressPercentage}%
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <StatusBadge status={project.status} />
                  </td>

                  <td
                    className="py-4 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(project)}
                      className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:text-white bg-[#F8FAFC] hover:bg-[#2563EB] border border-[#E2E8F0] hover:border-[#2563EB] rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
