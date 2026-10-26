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
      <div className="bg-white civic-subtle-grid border border-line rounded-card p-10 sm:p-12 text-center">
        <div className="w-12 h-12 rounded-card bg-sunken border border-line flex items-center justify-center mx-auto mb-3.5">
          <FolderSearch
            className="w-6 h-6 text-muted"
            aria-hidden="true"
          />
        </div>
        <h3 className="font-display text-base font-bold text-ink">
          No Matching LGU Projects Found
        </h3>
        <p className="text-sm text-muted max-w-md mx-auto mt-1.5 leading-relaxed">
          No sample project records match your current search query or selected filters. Try adjusting your search terms or resetting the filter criteria.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-5 inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-ink hover:bg-ink-soft rounded-lg transition-colors cursor-pointer"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-ground border-b border-line text-xs font-semibold text-muted">
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
          <tbody className="divide-y divide-line text-sm">
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
                  className="hover:bg-ground focus-visible:bg-sunken focus-visible:outline-none transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4 tabular-nums text-xs font-medium text-muted whitespace-nowrap">
                    {project.referenceCode}
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-semibold text-ink group-hover:text-accent-ink transition-colors line-clamp-1">
                      {project.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                      <span>{project.barangay}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Target: {project.targetCompletionDate}
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="text-xs font-medium text-ink whitespace-nowrap">
                      {project.category}
                    </div>
                    <div className="text-xs text-muted truncate max-w-[200px] mt-0.5">
                      {project.implementingOffice}
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right tabular-nums text-xs font-semibold text-ink whitespace-nowrap">
                    <div>{formatPHP(project.allocatedBudget)}</div>
                    <div className="text-[11px] font-normal text-muted mt-0.5">
                      Disbursed: {formatPHP(project.disbursedBudget, true)}
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-24 h-2 bg-line rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${project.progressPercentage}%`, backgroundColor: progressBarColor }}
                        />
                      </div>
                      <span className="tabular-nums text-xs font-semibold text-ink w-9 text-right">
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
                      className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-accent-ink hover:text-white bg-ground hover:bg-ink-soft border border-line hover:border-accent rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
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
