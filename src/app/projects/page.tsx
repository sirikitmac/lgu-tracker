import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, MapPin } from 'lucide-react';
import { DpwhDirectory } from '@/components/dpwh/DpwhDirectory';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { isProjectSource } from '@/lib/integrations/bettergov/sources';
import { DPWH_SORTS } from '@/lib/integrations/dpwh/nationwide/query';
import { DPWH_CATEGORIES, DPWH_STATUSES } from '@/types/dpwh';

export const metadata: Metadata = {
  title: 'Projects · LGU Tracker',
  description: 'Search, filter, and sort infrastructure projects from BetterGov.ph datasets: DPWH contracts and DPWH FY 2027 NEP proposals.',
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const oneOf = (value: string, allowed: readonly string[]) => (allowed.includes(value) ? value : '');
const PAGE_SIZES = [10, 25, 50, 100];

export default async function PublicProjectsPage({ searchParams }: PageProps<'/projects'>) {
  const params = await searchParams;
  const view = first(params.view);
  const page = Number(first(params.page));
  const pageSize = Number(first(params.pageSize));
  const sort = first(params.sort);

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title text-[30px] sm:text-[36px] text-ink">Projects</h1>
          <p className="mt-1.5 text-[15px] text-subtle">
            DPWH contracts across the Visayas and Mindanao, and FY 2027 budget proposals nationwide.
          </p>
        </div>
        <nav aria-label="Other views" className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link href="/projects/dashboard" className={secondaryButtonClass}>
            <BarChart3 className="w-4 h-4" aria-hidden="true" /> Dashboard
          </Link>
          <Link href="/projects/map" className={secondaryButtonClass}>
            <MapPin className="w-4 h-4" aria-hidden="true" /> Map
          </Link>
        </nav>
      </header>
      <DpwhDirectory
        initial={{
          view: view === 'grid' || view === 'list' ? view : undefined,
          page: Number.isInteger(page) && page > 0 ? page : undefined,
          pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : undefined,
          // Unknown values are dropped rather than sent to the API, which rejects them.
          filters: {
            q: first(params.q), region: first(params.region), province: first(params.province),
            municipality: first(params.municipality), office: first(params.office), contractor: first(params.contractor),
            source: isProjectSource(first(params.source)) ? first(params.source) : '',
            status: oneOf(first(params.status), DPWH_STATUSES),
            category: oneOf(first(params.category), DPWH_CATEGORIES),
            ...(sort in DPWH_SORTS ? { sort } : {}),
          },
        }}
      />
    </>
  );
}
