import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { DpwhDirectory } from '@/components/dpwh/DpwhDirectory';

export const metadata: Metadata = {
  title: 'DPWH Project Directory · LGU Tracker',
  description: 'Search, filter, and sort DPWH infrastructure contracts nationwide from the BetterGov.ph snapshot of the DPWH Transparency Portal.',
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function PublicProjectsPage({ searchParams }: PageProps<'/projects'>) {
  const params = await searchParams;

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] tracking-tight">DPWH Project Directory</h1>
          <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
            Every DPWH infrastructure contract in the published BetterGov.ph snapshot of the DPWH Transparency Portal.
            Values are as reported by DPWH and have not been verified by the LGU.
          </p>
        </div>
        <Link
          href="/projects/map"
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-[#172B4D] hover:bg-[#2563EB] rounded-lg shadow-2xs transition-colors self-start lg:self-auto"
        >
          <MapPin className="w-4 h-4" /> Open project map
        </Link>
      </div>
      <DpwhDirectory initialFilters={{ q: first(params.q), region: first(params.region), province: first(params.province) }} />
    </>
  );
}
