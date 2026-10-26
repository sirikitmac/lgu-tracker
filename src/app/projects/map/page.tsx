import type { Metadata } from 'next';
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
      <header>
        <h1 className="page-title text-[30px] sm:text-[36px] text-ink">Project Map</h1>
        <p className="mt-1.5 text-[15px] text-subtle">
          DPWH contracts in the Visayas and Mindanao at their reported coordinates. Select a marker for details.
        </p>
      </header>
      <DpwhPublicMap focus={focus} />
    </>
  );
}
