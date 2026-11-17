import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BarChart3, List, Map as MapIcon } from 'lucide-react';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { CONTRACT_ID_PATTERN } from '@/lib/integrations/dpwh/nationwide/detail';
import { DpwhPublicMap, type MapFocus } from '@/components/dpwh/DpwhPublicMap';
import { DpwhDashboard } from '@/components/dpwh/DpwhDashboard';
import { DashboardSkeleton } from '@/components/dpwh/DashboardSkeleton';
import { SubaybayanMap } from '@/components/subaybayan/SubaybayanMap';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { asCode } from '@/lib/subaybayan/code';
import { EMPTY_FILTERS, ID_PATTERN, parseSubaybayanQuery } from '@/lib/subaybayan/query';
import { exploreViewHref, parseExploreView, type ExploreView } from '@/lib/nav/exploreView';
import type { DpwhSummary } from '@/types/dpwh';

type Params = Record<string, string | string[] | undefined>;

const TITLE = 'Map & Dashboard · LGU Tracker';
const DESCRIPTION: Record<ExploreView, string> = {
  map: 'Public map of DPWH infrastructure contracts and DILG SubayBAYAN LGU projects.',
  dashboard: 'DPWH infrastructure contracts in the Visayas and Mindanao by region, status, category and year, with FY 2027 NEP proposals counted separately.',
};

export async function generateMetadata({ searchParams }: PageProps<'/projects/map'>): Promise<Metadata> {
  const view = parseExploreView((await searchParams).view);
  return { title: TITLE, description: DESCRIPTION[view] };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?focus=<contract id>&lat=&lng= centers the map on one contract. */
function parseFocus(params: Params): MapFocus | null {
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
// The view switcher: larger than the layer pills (44px), and full width on phones so either tab is under the thumb.
const viewTab = (active: boolean) =>
  `inline-flex flex-1 sm:flex-none items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${focusRing} ${
    active ? 'bg-ink text-on-ink shadow-raise' : 'text-subtle hover:text-ink'
  }`;

/** Which map layer the URL asks for, and its initial SubayBAYAN filters and focus. */
function parseMapParams(params: Params) {
  // ?code=<SubayBAYAN project code> (shared links) always opens the LGU layer and looks the code up.
  const rawCode = first(params.code);
  const code = rawCode && rawCode.length <= 80 ? asCode(rawCode) : null;
  const layer: 'dpwh' | 'subaybayan' = code || first(params.layer) === 'subaybayan' ? 'subaybayan' : 'dpwh';

  let initialFilters = EMPTY_FILTERS;
  if (layer === 'subaybayan') {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const value = first(v);
      if (value !== undefined && k !== 'layer' && k !== 'focus' && k !== 'code' && k !== 'view') usp.set(k, value);
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
  return { layer, initialFilters, focusId };
}

/**
 * Public analytics. Every figure comes from the cached aggregate row
 * (dpwh_directory_stats, refreshed by the database after each sync) plus one
 * head-only count of NEP proposals; no project rows are sent to the browser.
 */
async function DashboardView({ region }: { region: string }) {
  const supabase = await createSupabaseServerClient();

  let summary: DpwhSummary | null = null;
  let nepCount: number | null = null;
  let error: string | null = supabase ? null : 'Supabase is not configured.';

  if (supabase) {
    const [stats, nep] = await Promise.all([
      supabase
        .from('dpwh_directory_stats')
        .select('computed_at, last_successful_sync_at, source_revision, source_snapshot_at, stats')
        .eq('id', 1)
        .maybeSingle(),
      supabase.from('project_directory').select('record_id', { count: 'exact', head: true }).eq('source', 'dpwh_nep_2027'),
    ]);
    if (stats.error) {
      console.error('[LGU Tracker] Dashboard summary query failed:', stats.error);
      error = 'Could not load the contract summary.';
    } else {
      summary = (stats.data as DpwhSummary | null) ?? null;
    }
    if (nep.error) console.error('[LGU Tracker] NEP count query failed:', nep.error);
    else nepCount = nep.count;
  }

  return <DpwhDashboard summary={summary} nepCount={nepCount} error={error} initialRegion={region} />;
}

/**
 * Map & Dashboard: the public map and the public DPWH dashboard on one page,
 * switched with ?view=map (default) or ?view=dashboard. Only the active view
 * renders and queries on the server.
 */
export default async function MapAndDashboardPage({ searchParams }: PageProps<'/projects/map'>) {
  const params = await searchParams;
  const view = parseExploreView(params.view);
  const map = view === 'map' ? parseMapParams(params) : null;

  return (
    <div data-frame={view === 'map' ? 'wide' : undefined} className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-subtle">
            <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
            {map?.layer === 'subaybayan' ? 'DILG SubayBAYAN · LGU projects nationwide' : 'DPWH contracts · Visayas and Mindanao'}
          </p>
          <h1 className="mt-2 page-title text-[30px] sm:text-[40px] text-ink">Map &amp; Dashboard</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-subtle">
            {!map
              ? 'Every DPWH contract figure, by region, status and category, from the published summary.'
              : map.layer === 'dpwh'
                ? 'Contracts at the coordinates DPWH reports. The list follows the map; select a contract or marker to see it on both.'
                : 'Locally funded and 20% Development Fund projects from DILG SubayBAYAN, placed at the centre of their barangay, town or province, not the project site.'}
          </p>
        </div>
        <nav aria-label="Other views" className="flex flex-wrap items-center gap-2 md:shrink-0">
          <Link href="/projects" className={secondaryButtonClass}>
            <List className="w-4 h-4" aria-hidden="true" /> Directory
          </Link>
        </nav>
      </header>

      <nav aria-label="Map or dashboard" className="flex">
        <div className="flex w-full sm:w-auto sm:inline-flex max-w-full overflow-x-auto gap-0.5 p-1 rounded-full bg-surface border border-line shadow-raise">
          <Link href={exploreViewHref('map')} aria-current={view === 'map' ? 'page' : undefined} className={viewTab(view === 'map')}>
            <MapIcon className="w-4 h-4" aria-hidden="true" /> Map
          </Link>
          <Link href={exploreViewHref('dashboard')} aria-current={view === 'dashboard' ? 'page' : undefined} className={viewTab(view === 'dashboard')}>
            <BarChart3 className="w-4 h-4" aria-hidden="true" /> Dashboard
          </Link>
        </div>
      </nav>

      {map ? (
        <>
          <nav aria-label="Map layer" className="flex">
            <div className="inline-flex max-w-full overflow-x-auto gap-0.5 p-1 rounded-full bg-surface border border-line shadow-raise">
              <Link href="/projects/map" aria-current={map.layer === 'dpwh' ? 'page' : undefined} className={layerTab(map.layer === 'dpwh')}>
                DPWH contracts
              </Link>
              <Link href="/projects/map?layer=subaybayan" aria-current={map.layer === 'subaybayan' ? 'page' : undefined} className={layerTab(map.layer === 'subaybayan')}>
                LGU projects<span className="hidden sm:inline">&nbsp;(DILG SubayBAYAN)</span>
              </Link>
            </div>
          </nav>

          {map.layer === 'dpwh' ? (
            <DpwhPublicMap focus={parseFocus(params)} />
          ) : (
            <SubaybayanMap initialFilters={map.initialFilters} focusId={map.focusId} />
          )}
        </>
      ) : (
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardView region={first(params.region) ?? ''} />
        </Suspense>
      )}
    </div>
  );
}
