import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, List } from 'lucide-react';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { CONTRACT_ID_PATTERN } from '@/lib/integrations/dpwh/nationwide/detail';
import { DpwhPublicMap, type MapFocus } from '@/components/dpwh/DpwhPublicMap';
import { SubaybayanMap } from '@/components/subaybayan/SubaybayanMap';
import { asCode } from '@/lib/subaybayan/code';
import { EMPTY_FILTERS, ID_PATTERN, parseSubaybayanQuery } from '@/lib/subaybayan/query';

export const metadata: Metadata = {
  title: 'Project Map · LGU Tracker',
  description: 'Public map of DPWH infrastructure contracts and DILG SubayBAYAN LGU projects.',
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

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
const layerTab = (active: boolean) =>
  `inline-flex items-center justify-center h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${focusRing} ${
    active ? 'bg-ink text-on-ink shadow-raise' : 'text-subtle hover:text-ink'
  }`;

export default async function PublicProjectMapPage({ searchParams }: PageProps<'/projects/map'>) {
  const params = await searchParams;
  // ?code=<SubayBAYAN project code> (shared links) always opens the LGU layer and looks the code up.
  const rawCode = first(params.code);
  const code = rawCode && rawCode.length <= 80 ? asCode(rawCode) : null;
  const layer = code || first(params.layer) === 'subaybayan' ? 'subaybayan' : 'dpwh';

  let initialFilters = EMPTY_FILTERS;
  if (layer === 'subaybayan') {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const value = first(v);
      if (value !== undefined && k !== 'layer' && k !== 'focus' && k !== 'code') usp.set(k, value);
    }
    const parsed = parseSubaybayanQuery(usp);
    // An invalid shared link falls back to no filters rather than an error page.
    if (parsed.ok) initialFilters = parsed.filters;
    // The map looks up any search text that is a code; the lookup then clears filters that would hide it.
    if (code) initialFilters = { ...initialFilters, q: code };
  }

  // ?layer=subaybayan&focus=<project id> opens that project.
  const sbFocus = layer === 'subaybayan' ? first(params.focus) : undefined;
  const focusId = sbFocus && ID_PATTERN.test(sbFocus) ? sbFocus : null;

  return (
    <div data-frame="wide" className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-subtle">
            <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
            {layer === 'dpwh' ? 'DPWH contracts · Visayas and Mindanao' : 'DILG SubayBAYAN · LGU projects nationwide'}
          </p>
          <h1 className="mt-2 page-title text-[30px] sm:text-[40px] text-ink">Project Map</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-subtle">
            {layer === 'dpwh'
              ? 'Contracts placed at the coordinates DPWH reports. Move the map or filter to update the list; select a contract or a marker to see it on both.'
              : 'Locally funded and 20% Development Fund projects reported to DILG SubayBAYAN, placed at the centre of their barangay, city or province. Select a cluster to zoom in, or a marker for details.'}
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

      <nav aria-label="Map layer" className="flex">
        <div className="inline-flex max-w-full overflow-x-auto gap-0.5 p-1 rounded-full bg-surface border border-line shadow-raise">
          <Link href="/projects/map" aria-current={layer === 'dpwh' ? 'page' : undefined} className={layerTab(layer === 'dpwh')}>
            DPWH contracts
          </Link>
          <Link href="/projects/map?layer=subaybayan" aria-current={layer === 'subaybayan' ? 'page' : undefined} className={layerTab(layer === 'subaybayan')}>
            LGU projects<span className="hidden sm:inline">&nbsp;(DILG SubayBAYAN)</span>
          </Link>
        </div>
      </nav>

      {layer === 'dpwh' ? <DpwhPublicMap focus={parseFocus(params)} /> : <SubaybayanMap initialFilters={initialFilters} focusId={focusId} />}
    </div>
  );
}
