'use client';

import React, { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  LGUProject,
  ProjectCategory,
  ProjectFilterState,
  ProjectStatus,
} from '@/types/project';
import {
  computeSummaryMetrics,
  formatPHP,
  PROJECT_CATEGORIES,
} from '@/data/sampleProjects';
import { fetchLGUProjects, isSupabaseConfigured } from '@/lib/supabase/client';
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

  // Live project data from Supabase (RLS-filtered for the current session).
  // Starts empty/loading rather than pre-seeded with sample data, so the
  // bundled demo dataset is never shown without the disclosure banner below.
  const [projects, setProjects] = useState<LGUProject[]>([]);
  const [isSampleData, setIsSampleData] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setIsLoadingData(true);
    fetchLGUProjects()
      .then((result) => {
        if (!active) return;
        setProjects(result.projects);
        setIsSampleData(result.isSampleData);
        setDataError(result.errorMessage);
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      const matched = projects.find((p) => p.id === initialProjectParam);
      if (matched) {
        setSelectedProject(matched);
      }
    }
  }, [initialProjectParam, projects]);

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
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
  }, [projects, filters, sortBy]);

  const summaryMetrics = useMemo(
    () => computeSummaryMetrics(filteredProjects),
    [filteredProjects]
  );

  const sectorBudgetBreakdown = useMemo(() => {
    return PROJECT_CATEGORIES.map((category) => {
      const categoryProjects = projects.filter(
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
  }, [projects]);

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
    <div className="min-h-screen flex bg-ground text-ink">
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
              <h1 className="page-title text-[34px] sm:text-[42px] text-ink">
                {currentMeta.title}
              </h1>
              <p className="text-sm text-muted max-w-3xl leading-relaxed">
                {currentMeta.description}
              </p>
            </div>
          </div>

          {/* Live-Data Disclosure: never blend sample/demo data in silently */}
          {!isLoadingData && isSampleData && (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3.5 rounded-lg border border-warn-line bg-warn-soft text-xs text-warn-ink leading-relaxed"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warn-ink" />
              <span>
                {!isSupabaseConfigured
                  ? 'Supabase is not connected in this environment — displaying bundled sample/demo data, not live LGU records.'
                  : dataError
                  ? `Unable to load live data from Supabase (${dataError}) — displaying bundled sample/demo data instead.`
                  : 'Displaying bundled sample/demo data, not live LGU records.'}
              </span>
            </div>
          )}

          {isLoadingData ? (
            <div className="flex items-center justify-center gap-2.5 py-20 text-sm font-medium text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-accent-ink" />
              <span>Loading project records from Supabase...</span>
            </div>
          ) : (
            <>
              {/* KPI Summary Cards */}
              <SummaryCards metrics={summaryMetrics} />

              {/* Optional Sector Budget Breakdown when on Budget Section */}
              {activeSection === 'budget' && (
                <section
                  aria-label="Sector Budget Breakdown"
                  className="bg-surface border border-line rounded-card p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h2 className="font-display text-base font-bold text-ink">
                      Sector Appropriation &amp; Disbursement Breakdown
                      {isSampleData ? ' (Sample Data)' : ''}
                    </h2>
                    <span className="text-xs text-muted">
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
                              ? 'bg-ground border-accent'
                              : 'bg-surface border-line hover:border-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs text-muted">
                            <span className="font-semibold text-ink">
                              {item.category}
                            </span>
                            <span className="tabular-nums">
                              {item.projectCount} projects
                            </span>
                          </div>
                          <div className="mt-2 flex items-baseline justify-between gap-2 tabular-nums">
                            <span className="text-sm font-bold text-ink">
                              {formatPHP(item.allocated)}
                            </span>
                            <span className="text-xs text-[#16A34A] font-semibold">
                              {item.utilization}% disbursed (
                              {formatPHP(item.disbursed, true)})
                            </span>
                          </div>
                          <div className="mt-2.5 w-full h-1.5 bg-line rounded-full overflow-hidden">
                            <div
                              className="h-full bg-ink"
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
                totalCount={projects.length}
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
            </>
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
        <div className="min-h-screen flex items-center justify-center bg-ground text-sm font-medium text-muted">
          Loading LGU Tracker Monitoring Workspace...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
