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
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title text-[30px] sm:text-[36px] text-ink">Project Map</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-subtle">
            DPWH contracts across the Visayas and Mindanao, placed at the coordinates DPWH reports. Select a marker or a
            contract for details.
          </p>
        </div>
        <nav aria-label="Other views" className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link href="/projects/dashboard" className={secondaryButtonClass}>
            <BarChart3 className="w-4 h-4" aria-hidden="true" /> Dashboard
          </Link>
          <Link href="/projects" className={secondaryButtonClass}>
            <List className="w-4 h-4" aria-hidden="true" /> Directory
          </Link>
        </nav>
      </header>
      <DpwhPublicMap focus={focus} />
    </>
  );
}
