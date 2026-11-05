import React from 'react';
import type { ReportPhoto } from '@/lib/reports/queries';

/** Photos attached to a report. Each opens full size in a new tab. */
export function ReportPhotos({ photos }: { photos: ReportPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-ink">
        Photos <span className="font-normal text-subtle">({photos.length})</span>
      </h3>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square overflow-hidden rounded-xl border border-line bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1} attached to this report`} loading="lazy" className="h-full w-full object-cover" />
              <span className="sr-only"> (opens full size in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
