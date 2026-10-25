import type { Metadata } from 'next';
import { CONTRACT_ID_PATTERN } from '@/lib/integrations/dpwh/nationwide/detail';
import { DpwhPublicMap, type MapFocus } from '@/components/dpwh/DpwhPublicMap';

export const metadata: Metadata = {
  title: 'DPWH Project Map · LGU Tracker',
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
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#172B4D] tracking-tight">DPWH Project Map</h1>
        <p className="text-sm text-[#64748B] max-w-3xl leading-relaxed">
          DPWH infrastructure contracts nationwide, plotted at their DPWH-reported coordinates. Click a marker for
          details. No sign-in required.
        </p>
      </div>
      <DpwhPublicMap focus={focus} />
    </>
  );
}
