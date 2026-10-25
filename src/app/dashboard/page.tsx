'use client';

import React, { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Info } from 'lucide-react';
import {
  LGUProject,
  ProjectCategory,
  ProjectFilterState,
  ProjectStatus,
} from '@/types/project';
import {
  SAMPLE_LGU_PROJECTS,
  computeSummaryMetrics,
  formatPHP,
  PROJECT_CATEGORIES,
} from '@/data/sampleProjects';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import {
  ProjectFilters,
  ProjectSortOption,
} from '@/components/dashboard/ProjectFilters';
import { ProjectTable } from '@/components/dashboard/ProjectTable';
import { ProjectCardGrid } from '@/components/dashboard/ProjectCardGrid';
import { ProjectDetailDrawer } from '@/components/dashboard/ProjectDetailDrawer';

function DashboardContent() {
  const searchParams = useSearchParams();
  const initialModeParam = searchParams.get('mode');
  const initialSectionParam = searchParams.get('section');
  const initialProjectParam = searchParams.get('project');

  const [isPublicMode, setIsPublicMode] = useState<boolean>(
    initialModeParam === 'public'
  );
  const [activeSection, setActiveSection] = useState<
    'overview' | 'projects' | 'budget' | 'transparency'
  >(
    initialModeParam === 'public'
      ? 'transparency'
      : initialSectionParam === 'projects' || initialSectionParam === 'budget'
      ? initialSectionParam
      : 'overview'
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [sortBy, setSortBy] = useState<ProjectSortOption>('budget-desc');

  const [filters, setFilters] = useState<ProjectFilterState>({
    searchQuery: '',
    category: 'All',
    status: 'All',
    barangay: 'All',
  });

  const [selectedProject, setSelectedProject] = useState<LGUProject | null>(
    null
  );

  useEffect(() => {
    if (initialModeParam === 'public') {
      setIsPublicMode(true);
      setActiveSection('transparency');
    } else if (
      initialSectionParam === 'projects' ||
      initialSectionParam === 'budget' ||
      initialSectionParam === 'overview'
    ) {
      setActiveSection(initialSectionParam);
    }
  }, [initialModeParam, initialSectionParam]);

  useEffect(() => {
    if (initialProjectParam) {
      const matched = SAMPLE_LGU_PROJECTS.find(
        (p) => p.id === initialProjectParam
      );
      if (matched) {
        setSelectedProject(matched);
      }
    }
  }, [initialProjectParam]);

  const filteredProjects = useMemo(() => {
    const filtered = SAMPLE_LGU_PROJECTS.filter((project) => {
      const matchesCategory =
        filters.category === 'All' || project.category === filters.category;
      const matchesStatus =
        filters.status === 'All' || project.status === filters.status;

      const query = filters.searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        project.title.toLowerCase().includes(query) ||
        project.referenceCode.toLowerCase().includes(query) ||
        project.barangay.toLowerCase().includes(query) ||
        project.implementingOffice.toLowerCase().includes(query) ||
        project.category.toLowerCase().includes(query);

      return matchesCategory && matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'budget-desc':
          return b.allocatedBudget - a.allocatedBudget;
        case 'budget-asc':
          return a.allocatedBudget - b.allocatedBudget;
        case 'progress-desc':
          return b.progressPercentage - a.progressPercentage;
        case 'date-asc':
          return a.targetCompletionDate.localeCompare(b.targetCompletionDate);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [filters, sortBy]);

  const summaryMetrics = useMemo(
    () => computeSummaryMetrics(filteredProjects),
    [filteredProjects]
  );

  const sectorBudgetBreakdown = useMemo(() => {
    return PROJECT_CATEGORIES.map((category) => {
      const categoryProjects = SAMPLE_LGU_PROJECTS.filter(
        (p) => p.category === category
      );
      const allocated = categoryProjects.reduce(
        (sum, p) => sum + p.allocatedBudget,
        0
      );
      const disbursed = categoryProjects.reduce(
        (sum, p) => sum + p.disbursedBudget,
        0
      );
      return {
        category,
        projectCount: categoryProjects.length,
        allocated,
        disbursed,
        utilization:
          allocated > 0 ? Math.round((disbursed / allocated) * 100) : 0,
      };
    });
  }, []);

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      category: 'All',
      status: 'All',
      barangay: 'All',
    });
  };

  const sectionMetadata: Record<
    'overview' | 'projects' | 'budget' | 'transparency',
    { title: string; description: string; breadcrumb: string }
  > = {
    overview: {
      title: 'Municipal Project Monitoring Dashboard',
      description:
        'Consolidated tracking of physical accomplishment, procurement stages, and financial allocations across priority local government programs.',
      breadcrumb: 'Monitoring Overview',
    },
    projects: {
      title: 'LGU Project Directory & Status Registry',
      description:
        'Search and filter individual infrastructure, education, health, and disaster resilience projects by sector, status, or barangay.',
      breadcrumb: 'Project Directory',
    },
    budget: {
      title: 'AIP Budget Allocation & Utilization Summary',
      description:
        'Sector-by-sector comparison of approved Annual Investment Program (AIP) appropriations and actual disbursed funds.',
      breadcrumb: 'Budget & Utilization',
    },
    transparency: {
      title: 'Public Transparency Portal — Bantay Proyekto',
      description:
        'Open-access citizen view of municipal infrastructure and community programs for public accountability and community oversight.',
      breadcrumb: 'Public Transparency Portal',
    },
  };

  const currentMeta = sectionMetadata[activeSection];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      {/* Reusable Sidebar Navigation */}
      <DashboardSidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          if (sec === 'transparency') {
            setIsPublicMode(true);
          }
        }}
        selectedCategory={filters.category}
        onSelectCategory={(category: ProjectCategory | 'All') =>
          setFilters((prev) => ({ ...prev, category }))
        }
        isPublicMode={isPublicMode}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area (Scrollable Right Pane) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <DashboardTopbar
          isPublicMode={isPublicMode}
          onToggleMode={(pub) => {
            setIsPublicMode(pub);
            setActiveSection(pub ? 'transparency' : 'overview');
          }}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          activeSectionLabel={currentMeta.breadcrumb}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Page Title & Description */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] tracking-tight">
                {currentMeta.title}
              </h1>
              <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
                {currentMeta.description}
              </p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <SummaryCards metrics={summaryMetrics} />

          {/* Optional Sector Budget Breakdown when on Budget Section */}
          {activeSection === 'budget' && (
            <section
              aria-label="Sector Budget Breakdown"
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-2xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h2 className="font-display text-base font-bold text-[#172B4D]">
                  Sector Appropriation &amp; Disbursement Breakdown (Sample Data)
                </h2>
                <span className="text-xs text-[#64748B]">
                  Click any sector to filter projects below
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectorBudgetBreakdown.map((item) => {
                  const isActive = filters.category === item.category;
                  return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          category:
                            prev.category === item.category
                              ? 'All'
                              : item.category,
                        }))
                      }
                      className={`text-left p-4 rounded-lg border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#F8FAFC] border-[#2563EB] shadow-2xs'
                          : 'bg-white border-[#E2E8F0] hover:border-[#64748B]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                        <span className="font-semibold text-[#0F172A]">
                          {item.category}
                        </span>
                        <span className="font-mono tabular-nums">
                          {item.projectCount} projects
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-2 font-mono tabular-nums">
                        <span className="text-sm font-bold text-[#0F172A]">
                          {formatPHP(item.allocated)}
                        </span>
                        <span className="text-xs text-[#16A34A] font-semibold">
                          {item.utilization}% disbursed (
                          {formatPHP(item.disbursed, true)})
                        </span>
                      </div>
                      <div className="mt-2.5 w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2563EB]"
                          style={{ width: `${item.utilization}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Search, Category/Status Filters, Sorting & View Switcher */}
          <ProjectFilters
            filters={filters}
            onSearchChange={(searchQuery) =>
              setFilters((prev) => ({ ...prev, searchQuery }))
            }
            onCategoryChange={(category) =>
              setFilters((prev) => ({ ...prev, category }))
            }
            onStatusChange={(status: ProjectStatus | 'All') =>
              setFilters((prev) => ({ ...prev, status }))
            }
            onResetFilters={handleResetFilters}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={filteredProjects.length}
            totalCount={SAMPLE_LGU_PROJECTS.length}
          />

          {/* Project Display: Structured Table or Project Cards Grid */}
          {viewMode === 'table' ? (
            <ProjectTable
              projects={filteredProjects}
              onSelectProject={(project) => setSelectedProject(project)}
              onResetFilters={handleResetFilters}
            />
          ) : (
            <ProjectCardGrid
              projects={filteredProjects}
              onSelectProject={(project) => setSelectedProject(project)}
              onResetFilters={handleResetFilters}
            />
          )}
        </main>
      </div>

      {/* Project Details Slide-Over Drawer */}
      <ProjectDetailDrawer
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#64748B]">
          Loading LGU Tracker Monitoring Workspace...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
