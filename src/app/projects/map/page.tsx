import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, List } from 'lucide-react';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { CONTRACT_ID_PATTERN } from '@/lib/integrations/dpwh/nationwide/detail';
import { DpwhPublicMap, type MapFocus } from '@/components/dpwh/DpwhPublicMap';

export const metadata: Metadata = {
  title: 'Project Map · LGU Tracker',
  description: 'Public map of DPWH infrastructure contracts with DPWH-reported coordinates.',
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?focus=<contract id>&lat=&lng= centers the map on one contract. */
function parseFocus(params: Record<string, string | string[] | undefined>): MapFocus | null {
  const lat = Number(first(params.lat));
  const lng = Number(first(params.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const id = first(params.focus);
  return { id: id && CONTRACT_ID_PATTERN.test(id) ? id : null, lat, lng };
}

export default async function PublicProjectMapPage({ searchParams }: PageProps<'/projects/map'>) {
  const focus = parseFocus(await searchParams);

  return (
    <div data-frame="wide" className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-subtle">
            <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
            DPWH contracts · Visayas and Mindanao
          </p>
          <h1 className="mt-2 page-title text-[30px] sm:text-[40px] text-ink">Project Map</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-subtle">
            Contracts placed at the coordinates DPWH reports. Move the map or filter to update the list; select a contract
            or a marker to see it on both.
          </p>
        </div>
        <nav aria-label="Other views" className="flex flex-wrap items-center gap-2 md:shrink-0">
          <Link href="/projects/dashboard" className={secondaryButtonClass}>
            <BarChart3 className="w-4 h-4" aria-hidden="true" /> Dashboard
          </Link>
          <Link href="/projects" className={secondaryButtonClass}>
            <List className="w-4 h-4" aria-hidden="true" /> Directory
          </Link>
        </nav>
      </header>
      <DpwhPublicMap focus={focus} />
    </div>
  );
}
