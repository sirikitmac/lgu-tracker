import { Skeleton } from '@/components/ui/StateViews';

/** One contract's page shape (back link, title, three key figures, detail sections) while it loads. */
export default function ContractLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">Loading contract…</p>
      <div className="space-y-6" aria-hidden="true">
        <Skeleton className="h-4 w-36" />
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-7 w-full max-w-3xl" />
          <Skeleton className="h-7 w-2/3 max-w-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-surface border border-line rounded-card divide-y sm:divide-y-0 sm:divide-x divide-line">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="p-4 sm:p-5 space-y-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-40" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-card p-5 sm:p-6 space-y-6">
          {[5, 4, 4].map((rows, s) => (
            <div key={s} className="space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className={`h-3.5 ${i % 2 ? 'w-2/3' : 'w-5/6'}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
