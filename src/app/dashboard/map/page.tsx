'use client';

import React, { Suspense, useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  RotateCcw,
  MapPin,
  MapPinOff,
  List,
  Map as MapIcon,
  Columns,
  Info,
  Calendar,
  ArrowUpRight,
  FolderSearch,
} from 'lucide-react';
import {
  LGUProject,
  ProjectCategory,
  ProjectFilterState,
  ProjectStatus,
  hasValidCoordinates,
} from '@/types/project';
import {
  SAMPLE_LGU_PROJECTS,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  formatPHP,
} from '@/data/sampleProjects';
import { fetchLGUProjects } from '@/lib/supabase/client';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';
import { ProjectDetailDrawer } from '@/components/dashboard/ProjectDetailDrawer';
import { StatusBadge } from '@/components/ui/StatusBadge';

const IliganProjectMap = dynamic(
  () => import('@/components/map/IliganProjectMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[420px] sm:min-h-[540px] rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center mb-3 shadow-2xs">
          <MapPin className="w-5 h-5 text-[#2563EB] animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-[#172B4D]">
          Initializing Iligan City Interactive Map...
        </p>
        <p className="text-xs text-[#64748B] mt-1">
          Loading OpenStreetMap tiles and project markers
        </p>
      </div>
    ),
  }
);

type MapLayoutMode = 'split' | 'map' | 'list';

function ProjectMapPageContent() {
  const searchParams = useSearchParams();
  const initialModeParam = searchParams.get('mode');

  const [isPublicMode, setIsPublicMode] = useState<boolean>(
    initialModeParam === 'public'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<MapLayoutMode>('split');

  const [projects, setProjects] = useState<LGUProject[]>(SAMPLE_LGU_PROJECTS);
  const [isSampleData, setIsSampleData] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ProjectFilterState>({
    searchQuery: '',
    category: 'All',
    status: 'All',
    barangay: 'All',
  });

  // Load projects from Supabase if configured, or fall back to sample data
  useEffect(() => {
    let active = true;
    setIsLoadingData(true);
    fetchLGUProjects()
      .then((res) => {
        if (!active) return;
        setProjects(res.projects);
        setIsSampleData(res.isSampleData);
        if (res.errorMessage) {
          setDataError(res.errorMessage);
        }
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableBarangays = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.barangay))).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesCategory =
        filters.category === 'All' || project.category === filters.category;
      const matchesStatus =
        filters.status === 'All' || project.status === filters.status;
      const matchesBarangay =
        filters.barangay === 'All' || project.barangay === filters.barangay;

      const query = filters.searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        project.title.toLowerCase().includes(query) ||
        project.referenceCode.toLowerCase().includes(query) ||
        project.barangay.toLowerCase().includes(query) ||
        project.municipality.toLowerCase().includes(query) ||
        project.implementingOffice.toLowerCase().includes(query);

      return (
        matchesCategory && matchesStatus && matchesBarangay && matchesSearch
      );
    });
  }, [projects, filters]);

  const mappedFilteredProjects = useMemo(
    () => filteredProjects.filter(hasValidCoordinates),
    [filteredProjects]
  );

  const unmappedFilteredProjects = useMemo(
    () => filteredProjects.filter((p) => !hasValidCoordinates(p)),
    [filteredProjects]
  );

  const [selectedMapProject, setSelectedMapProject] =
    useState<LGUProject | null>(() => SAMPLE_LGU_PROJECTS[0] || null);
  const [drawerProject, setDrawerProject] = useState<LGUProject | null>(null);

  // Keep selectedMapProject synchronized with active filters
  useEffect(() => {
    if (
      selectedMapProject &&
      !filteredProjects.some((p) => p.id === selectedMapProject.id)
    ) {
      setSelectedMapProject(
        mappedFilteredProjects[0] || filteredProjects[0] || null
      );
    } else if (!selectedMapProject && filteredProjects.length > 0) {
      setSelectedMapProject(mappedFilteredProjects[0] || filteredProjects[0]);
    }
  }, [filteredProjects, mappedFilteredProjects, selectedMapProject]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.category !== 'All' ||
    filters.status !== 'All' ||
    filters.barangay !== 'All';

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      category: 'All',
      status: 'All',
      barangay: 'All',
    });
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      {/* Fixed Left Sidebar */}
      <DashboardSidebar
        activeSection="map"
        selectedCategory={filters.category}
        onSelectCategory={(category: ProjectCategory | 'All') =>
          setFilters((prev) => ({ ...prev, category }))
        }
        isPublicMode={isPublicMode}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Right Scrollable Workspace */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <DashboardTopbar
          isPublicMode={isPublicMode}
          onToggleMode={(pub) => setIsPublicMode(pub)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          activeSectionLabel="Project Map"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Page Header & Layout Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] tracking-tight">
                Project Map
              </h1>
              <p className="text-sm text-[#64748B]">
                Explore government projects across Iligan City.
              </p>
            </div>

            {/* Map / Split / List View Toggle */}
            <div
              role="group"
              aria-label="Map and List View Switcher"
              className="flex items-center p-1 bg-white border border-[#E2E8F0] rounded-lg shadow-2xs self-start sm:self-auto shrink-0"
            >
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                aria-pressed={layoutMode === 'split'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  layoutMode === 'split'
                    ? 'bg-[#172B4D] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('map')}
                aria-pressed={layoutMode === 'map'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  layoutMode === 'map'
                    ? 'bg-[#172B4D] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map Focus</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                aria-pressed={layoutMode === 'list'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  layoutMode === 'list'
                    ? 'bg-[#172B4D] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls Bar */}
          <section
            aria-label="Map Search and Filters"
            className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-2xs space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              {/* Search Input */}
              <div className="sm:col-span-2 lg:col-span-4 relative">
                <label htmlFor="map-project-search" className="sr-only">
                  Search projects by name, reference code, or barangay
                </label>
                <Search
                  className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="map-project-search"
                  type="search"
                  value={filters.searchQuery}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      searchQuery: e.target.value,
                    }))
                  }
                  placeholder="Search project name, code, or barangay..."
                  className="w-full h-10 pl-10 pr-3.5 text-sm text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg placeholder:text-[#64748B] focus:bg-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="lg:col-span-2">
                <label htmlFor="map-status-filter" className="sr-only">
                  Filter by project status
                </label>
                <select
                  id="map-status-filter"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value as ProjectStatus | 'All',
                    }))
                  }
                  className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:bg-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition-all cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Barangay Filter */}
              <div className="lg:col-span-3">
                <label htmlFor="map-barangay-filter" className="sr-only">
                  Filter by Iligan City barangay
                </label>
                <select
                  id="map-barangay-filter"
                  value={filters.barangay}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      barangay: e.target.value,
                    }))
                  }
                  className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:bg-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition-all cursor-pointer"
                >
                  <option value="All">All Iligan Barangays</option>
                  {availableBarangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="lg:col-span-3">
                <label htmlFor="map-category-filter" className="sr-only">
                  Filter by project category
                </label>
                <select
                  id="map-category-filter"
                  value={filters.category}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      category: e.target.value as ProjectCategory | 'All',
                    }))
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
            </div>

            {/* Matching Project Count & Clear Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
                <span>
                  Showing{' '}
                  <strong className="text-[#0F172A]">
                    {filteredProjects.length}
                  </strong>{' '}
                  matching{' '}
                  {filteredProjects.length === 1 ? 'project' : 'projects'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#16A34A] font-medium">
                  {mappedFilteredProjects.length} plotted on map
                </span>
                {unmappedFilteredProjects.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#D97706] font-medium">
                      {unmappedFilteredProjects.length} location unavailable
                    </span>
                  </>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#172B4D] hover:underline whitespace-nowrap cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </section>

          {/* Empty State When No Projects Match */}
          {filteredProjects.length === 0 ? (
            <div className="bg-white civic-subtle-grid border border-[#E2E8F0] rounded-xl p-10 sm:p-12 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mx-auto mb-3.5">
                <FolderSearch
                  className="w-6 h-6 text-[#64748B]"
                  aria-hidden="true"
                />
              </div>
              <h2 className="font-display text-base font-bold text-[#0F172A]">
                No Matching Iligan City Projects Found
              </h2>
              <p className="text-sm text-[#64748B] max-w-md mx-auto mt-1.5 leading-relaxed">
                No project locations match your current search or filter settings. Clear the filters to restore all project markers across Iligan City.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-5 inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#172B4D] rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            /* Primary Interactive Map & Accompanying Project Details / Directory */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Interactive Map Column */}
              {layoutMode !== 'list' && (
                <div
                  className={
                    layoutMode === 'map'
                      ? 'lg:col-span-12 space-y-4'
                      : 'lg:col-span-7 xl:col-span-8 space-y-4'
                  }
                >
                  <div className="h-[460px] sm:h-[580px] w-full">
                    <IliganProjectMap
                      projects={filteredProjects}
                      selectedProject={selectedMapProject}
                      onSelectMarker={(project) =>
                        setSelectedMapProject(project)
                      }
                      onInspectFullDetails={(project) =>
                        setDrawerProject(project)
                      }
                    />
                  </div>

                  {/* Selected Marker Quick Summary Card when in Map-Only Focus Mode */}
                  {layoutMode === 'map' && selectedMapProject && (
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                          <span className="font-mono font-semibold text-[#172B4D] tabular-nums">
                            {selectedMapProject.referenceCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{selectedMapProject.barangay}</span>
                          <span aria-hidden="true">·</span>
                          <StatusBadge status={selectedMapProject.status} />
                        </div>
                        <h3 className="font-display text-base font-bold text-[#0F172A] truncate">
                          {selectedMapProject.title}
                        </h3>
                        <p className="text-xs text-[#64748B] font-mono tabular-nums">
                          Allocated Budget:{' '}
                          <strong className="text-[#0F172A]">
                            {formatPHP(selectedMapProject.allocatedBudget)}
                          </strong>{' '}
                          · Completion:{' '}
                          <strong className="text-[#0F172A]">
                            {selectedMapProject.progressPercentage}%
                          </strong>{' '}
                          · Target: {selectedMapProject.targetCompletionDate}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDrawerProject(selectedMapProject)}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>View Full Project Details</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Side Panel: Selected Project Details + Accompanying Project List */}
              {layoutMode !== 'map' && (
                <div
                  className={
                    layoutMode === 'list'
                      ? 'lg:col-span-12 space-y-6'
                      : 'lg:col-span-5 xl:col-span-4 space-y-5'
                  }
                >
                  {/* Selected Project Details Panel */}
                  {selectedMapProject && (
                    <section
                      aria-label="Selected Project Details"
                      className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                        <span className="text-xs font-semibold text-[#64748B]">
                          Selected Project Details
                        </span>
                        <StatusBadge status={selectedMapProject.status} />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-mono tabular-nums">
                          <span className="font-semibold text-[#172B4D]">
                            {selectedMapProject.referenceCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-sans truncate">
                            {selectedMapProject.category}
                          </span>
                        </div>
                        <h2 className="font-display text-base font-bold text-[#0F172A] mt-1 leading-snug">
                          {selectedMapProject.title}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1.5">
                          {hasValidCoordinates(selectedMapProject) ? (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                              <span>
                                {selectedMapProject.barangay}, Iligan City
                              </span>
                            </>
                          ) : (
                            <>
                              <MapPinOff className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                              <span className="text-[#D97706] font-medium">
                                {selectedMapProject.barangay} (Coordinates
                                unavailable)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3.5 text-xs">
                        <div>
                          <span className="block text-[#64748B]">
                            Allocated Budget
                          </span>
                          <span className="font-mono text-sm font-bold text-[#0F172A] tabular-nums mt-0.5 block">
                            {formatPHP(selectedMapProject.allocatedBudget)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[#64748B]">
                            Completion
                          </span>
                          <span className="font-mono text-sm font-bold text-[#0F172A] tabular-nums mt-0.5 block">
                            {selectedMapProject.progressPercentage}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[#64748B]">
                            Start Date
                          </span>
                          <span className="font-mono font-medium text-[#0F172A] tabular-nums mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#64748B]" />
                            {selectedMapProject.startDate}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[#64748B]">
                            Target Completion
                          </span>
                          <span className="font-mono font-medium text-[#0F172A] tabular-nums mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#64748B]" />
                            {selectedMapProject.targetCompletionDate}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDrawerProject(selectedMapProject)}
                        className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2.5 text-xs font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg shadow-2xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                      >
                        <span>View Full Project Details</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </section>
                  )}

                  {/* Accompanying Matching Projects List */}
                  <section
                    aria-label="Matching Projects Directory"
                    className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs"
                  >
                    <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-[#172B4D]">
                        Matching Projects ({filteredProjects.length})
                      </h3>
                      <span className="text-[11px] text-[#64748B]">
                        Click to locate on map
                      </span>
                    </div>

                    <div className="max-h-[340px] overflow-y-auto divide-y divide-[#E2E8F0]">
                      {filteredProjects.map((project) => {
                        const isSelected = selectedMapProject?.id === project.id;
                        const hasCoords = hasValidCoordinates(project);

                        return (
                          <div
                            key={project.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedMapProject(project)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedMapProject(project);
                              }
                            }}
                            className={`p-4 text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#F1F5F9]'
                                : 'hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono font-semibold text-[#172B4D] tabular-nums">
                                {project.referenceCode}
                              </span>
                              <StatusBadge status={project.status} />
                            </div>

                            <p className="font-display text-sm font-bold text-[#0F172A] mt-1 line-clamp-1">
                              {project.title}
                            </p>

                            <div className="flex items-center justify-between gap-2 mt-2 text-xs text-[#64748B]">
                              <span className="inline-flex items-center gap-1 truncate">
                                {hasCoords ? (
                                  <>
                                    <MapPin className="w-3 h-3 text-[#2563EB] shrink-0" />
                                    <span className="truncate">
                                      {project.barangay}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <MapPinOff className="w-3 h-3 text-[#D97706] shrink-0" />
                                    <span className="text-[#D97706] truncate">
                                      {project.barangay} · Location unavailable
                                    </span>
                                  </>
                                )}
                              </span>

                              <span className="font-mono font-semibold text-[#0F172A] tabular-nums shrink-0">
                                {formatPHP(project.allocatedBudget, true)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Full Project Detail Slide-Over Drawer */}
      <ProjectDetailDrawer
        project={drawerProject}
        onClose={() => setDrawerProject(null)}
      />
    </div>
  );
}

export default function ProjectMapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#64748B]">
          Loading Iligan City Project Map...
        </div>
      }
    >
      <ProjectMapPageContent />
    </Suspense>
  );
}
