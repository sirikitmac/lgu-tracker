import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { BpAssistant } from '@/components/bp/BpAssistant';
import { DpwhDirectory } from '@/components/dpwh/DpwhDirectory';
import { primaryButtonClass } from '@/components/dpwh/ui';
import { isProjectSource } from '@/lib/integrations/bettergov/sources';
import { DPWH_SORTS } from '@/lib/integrations/dpwh/nationwide/query';
import { DPWH_CATEGORIES, DPWH_STATUSES } from '@/types/dpwh';

export const metadata: Metadata = {
  title: 'Project Directory · LGU Tracker',
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
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0 max-w-3xl">
          <h1 className="page-title text-[36px] sm:text-[44px] text-ink">Project Directory</h1>
          <p className="mt-3 text-base sm:text-[17px] leading-relaxed text-ink">
            Infrastructure projects from BetterGov.ph datasets. Each row shows its source. Values are as published and have not been
            verified by the LGU.
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 text-[13px] leading-relaxed">
            <div className="pl-3 border-l-2 border-accent">
              <dt className="font-semibold text-ink">DPWH contracts</dt>
              <dd className="text-muted">From the DPWH Transparency Portal snapshot (Visayas and Mindanao project locations)</dd>
            </div>
            <div className="pl-3 border-l-2 border-line-strong">
              <dt className="font-semibold text-ink">FY 2027 NEP proposals</dt>
              <dd className="text-muted">DPWH projects proposed in the FY 2027 National Expenditure Program (nationwide)</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:pb-1">
          <BpAssistant />
          <Link href="/projects/map" className={primaryButtonClass}>
            <MapPin className="w-4 h-4" aria-hidden="true" /> Open project map
          </Link>
        </div>
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
