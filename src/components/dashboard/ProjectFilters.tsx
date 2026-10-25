'use client';

import React from 'react';
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react';
import {
  ProjectCategory,
  ProjectFilterState,
  ProjectStatus,
} from '@/types/project';
import { PROJECT_CATEGORIES, PROJECT_STATUSES } from '@/data/sampleProjects';

export type ProjectSortOption =
  | 'budget-desc'
  | 'budget-asc'
  | 'progress-desc'
  | 'date-asc'
  | 'title-asc';

interface ProjectFiltersProps {
  filters: ProjectFilterState;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: ProjectCategory | 'All') => void;
  onStatusChange: (status: ProjectStatus | 'All') => void;
  onResetFilters: () => void;
  sortBy: ProjectSortOption;
  onSortChange: (sort: ProjectSortOption) => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
  resultCount: number;
  totalCount: number;
}

export function ProjectFilters({
  filters,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onResetFilters,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
}: ProjectFiltersProps) {
  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.category !== 'All' ||
    filters.status !== 'All';

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <label htmlFor="project-search" className="sr-only">
            Search projects by title, reference code, barangay, or office
          </label>
          <Search
            className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="project-search"
            type="search"
            value={filters.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by project title, code (e.g. LGU-2026), or barangay..."
            className="w-full h-10 pl-10 pr-4 text-sm text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg placeholder:text-[#64748B] focus:bg-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
          />
        </div>

        {/* Category Select, Sort Select & View Switcher */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3">
          {/* Category Filter */}
          <div className="w-full sm:w-auto sm:min-w-[210px] flex-1">
            <label htmlFor="category-filter" className="sr-only">
              Filter by LGU Project Category
            </label>
            <select
              id="category-filter"
              value={filters.category}
              onChange={(e) =>
                onCategoryChange(e.target.value as ProjectCategory | 'All')
              }
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:bg-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition-all cursor-pointer"
            >
              <option value="All">All Project Categories</option>
              {PROJECT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Select */}
          <div className="relative flex-1 sm:flex-initial sm:min-w-[185px]">
            <label htmlFor="project-sort" className="sr-only">
              Sort projects
            </label>
            <ArrowUpDown
              className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="project-sort"
              value={sortBy}
              onChange={(e) =>
                onSortChange(e.target.value as ProjectSortOption)
              }
              className="w-full h-10 pl-8 pr-3 text-xs sm:text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:bg-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition-all cursor-pointer"
            >
              <option value="budget-desc">Budget: High to Low</option>
              <option value="budget-asc">Budget: Low to High</option>
              <option value="progress-desc">Progress: High to Low</option>
              <option value="date-asc">Target Date: Soonest</option>
              <option value="title-asc">Project Title: A–Z</option>
            </select>
          </div>

          {/* View Mode Toggle (Card Grid vs. Table) */}
          <div
            role="group"
            aria-label="Project Display Layout"
            className="flex items-center p-1 h-10 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg shrink-0"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#172B4D] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              aria-pressed={viewMode === 'table'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#172B4D] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Status Filter Bar & Count Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-[#E2E8F0]">
        <div
          role="group"
          aria-label="Filter by project status"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => onStatusChange('All')}
            aria-pressed={filters.status === 'All'}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              filters.status === 'All'
                ? 'bg-[#172B4D] text-white'
                : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
            }`}
          >
            All Statuses
          </button>
          {PROJECT_STATUSES.map((status) => {
            const isSelected = filters.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#64748B]">
          <span className="font-mono tabular-nums">
            Showing <strong className="text-[#0F172A]">{resultCount}</strong> of{' '}
            <strong className="text-[#0F172A]">{totalCount}</strong> sample
            projects
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#172B4D] hover:underline whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
