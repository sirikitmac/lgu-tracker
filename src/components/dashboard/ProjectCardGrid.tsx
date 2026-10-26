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
import { lguStatusTone } from '@/lib/statusPalette';

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
      <div className="bg-surface civic-subtle-grid border border-line rounded-card p-10 sm:p-12 text-center">
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
          No sample project records match your current search query or selected filters.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-5 inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold text-on-ink bg-ink hover:bg-ink-soft rounded-lg transition-colors cursor-pointer"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {projects.map((project) => {
        const progressBarColor = lguStatusTone(project.status).fill;

        return (
          <article
            key={project.id}
            onClick={() => onSelectProject(project)}
            className="bg-surface border border-line rounded-card overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
          >
            <div>
              {/* Clean Project Picture Holder */}
              <div className="relative h-36 w-full bg-ground civic-subtle-grid border-b border-line flex flex-col items-center justify-center overflow-hidden">
                {project.imageUrl ? (
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-muted group-hover:text-accent-ink transition-colors">
                    <ImageIcon className="w-6 h-6 mb-1.5 opacity-75" aria-hidden="true" />
                    <span className="text-[11px] font-medium text-muted">
                      Project Photo
                    </span>
                  </div>
                )}
              </div>

              {/* Essential Card Info: Barangay, Status & Shortened Title */}
              <div className="p-5 pb-4">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 font-medium text-muted truncate">
                    <MapPin className="w-3.5 h-3.5 text-accent-ink shrink-0" />
                    <span className="truncate">{project.barangay}</span>
                  </span>
                  <StatusBadge status={project.status} />
                </div>

                <h3
                  title={project.title}
                  className="font-display text-base font-bold text-ink group-hover:text-accent-ink transition-colors mt-2 leading-snug truncate"
                >
                  {project.title}
                </h3>
              </div>
            </div>

            {/* Compact Footer: Progress, Budget & Action */}
            <div className="px-5 pb-5 pt-3 border-t border-line/80 space-y-3.5">
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted">Progress</span>
                  <span className="tabular-nums font-semibold text-ink">
                    {project.progressPercentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${project.progressPercentage}%`, backgroundColor: progressBarColor }}
                  />
                </div>
              </div>

              {/* Budget & Details Button */}
              <div
                className="flex items-center justify-between gap-3 pt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <span className="block text-[11px] text-muted">
                    Budget
                  </span>
                  <span className="tabular-nums text-sm font-bold text-ink">
                    {formatPHP(project.allocatedBudget)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectProject(project)}
                  className="inline-flex items-center gap-1 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-ink hover:text-on-ink bg-ground hover:bg-ink-soft border border-line hover:border-accent rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-ink"
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
