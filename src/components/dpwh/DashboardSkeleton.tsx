import { Skeleton } from '@/components/ui/StateViews';
import { panelClass } from '@/components/dpwh/ui';

function PanelSkeleton({ rows, className = '' }: { rows: number; className?: string }) {
  return (
    <div className={`${panelClass} p-5 sm:p-6 space-y-4 ${className}`}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="space-y-3.5 pt-1">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The dashboard's layout (header, figures row, chart panels) while the summary query runs. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <header className="min-w-0">
        <h1 className="page-title text-[30px] sm:text-[36px] text-ink">Dashboard</h1>
        <p className="mt-1.5 text-[15px] text-subtle">What the published DPWH contracts show, by region, status and category.</p>
        <p role="status" className="sr-only">Loading dashboard figures…</p>
      </header>

      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-3 w-48 ml-1" />
        <Skeleton className="h-11 !rounded-card" />
      </div>

      <div className={`${panelClass} overflow-hidden`} aria-hidden="true">
        <div className="grid grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] gap-px bg-line [&>*]:bg-surface">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`px-5 py-4 sm:px-6 sm:py-5 space-y-3 ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3" aria-hidden="true">
        <PanelSkeleton rows={7} className="lg:col-span-2" />
        <PanelSkeleton rows={5} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2" aria-hidden="true">
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={5} />
      </div>
    </div>
  );
}
