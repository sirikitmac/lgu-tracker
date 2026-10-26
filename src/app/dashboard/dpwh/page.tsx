'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';
import { DpwhDirectory } from '@/components/dpwh/DpwhDirectory';
import { DpwhSyncButton } from '@/components/dpwh/DpwhSyncButton';

function DpwhPageContent() {
  const searchParams = useSearchParams();
  const [isPublicMode, setIsPublicMode] = useState(searchParams.get('mode') === 'public');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-ground text-ink">
      <DashboardSidebar
        activeSection="dpwh"
        selectedCategory="All"
        onSelectCategory={() => {}}
        isPublicMode={isPublicMode}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <DashboardTopbar
          isPublicMode={isPublicMode}
          onToggleMode={(pub) => setIsPublicMode(pub)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          activeSectionLabel="DPWH Nationwide Directory"
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="page-title text-[34px] sm:text-[42px] text-ink">
                DPWH Nationwide Infrastructure Directory
              </h1>
              <p className="text-sm text-muted max-w-3xl leading-relaxed">
                Search, filter, and sort every DPWH infrastructure contract in the published BetterGov.ph snapshot of the
                DPWH Transparency Portal. Kept separate from locally managed LGU projects.
              </p>
            </div>
            <DpwhSyncButton />
          </div>
          <DpwhDirectory />
        </main>
      </div>
    </div>
  );
}

export default function DpwhPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading DPWH directory…
        </div>
      }
    >
      <DpwhPageContent />
    </Suspense>
  );
}
