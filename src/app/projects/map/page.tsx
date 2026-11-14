import type { Metadata } from 'next';
import Link from 'next/link';
import { List } from 'lucide-react';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { DpwhDashboard } from '@/components/dpwh/DpwhDashboard';
import { ScrollToMap } from '@/components/dpwh/ScrollToMap';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DpwhSummary } from '@/types/dpwh';
import { CONTRACT_ID_PATTERN } from '@/lib/integrations/dpwh/nationwide/detail';
import { DpwhPublicMap, type MapFocus } from '@/components/dpwh/DpwhPublicMap';
import { SubaybayanMap } from '@/components/subaybayan/SubaybayanMap';
import { asCode } from '@/lib/subaybayan/code';
import { EMPTY_FILTERS, ID_PATTERN, parseSubaybayanQuery } from '@/lib/subaybayan/query';

export const metadata: Metadata = {
  title: 'Dashboard and Map · LGU Tracker',
  description:
    'DPWH infrastructure contracts in the Visayas and Mindanao by region, status, category and year, and a public map of DPWH contracts and DILG SubayBAYAN LGU projects.',
};

/**
 * The dashboard's region lives in its own parameter: `region` is a SubayBAYAN
 * map filter, and the two must not read each other's value.
 */
const DASHBOARD_REGION_PARAM = 'stats_region';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?focus=<contract id>&lat=&lng= centers the map on one contract. */
function parseFocus(params: Record<string, string | string[] | undefined>): MapFocus | null {
  const lat = Number(first(params.lat));
  const lng = Number(first(params.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const id = first(params.focus);
  return { id: id && CONTRACT_ID_PATTERN.test(id) ? id : null, lat, lng };
}

/**
 * Dashboard figures: the cached aggregate row (dpwh_directory_stats, refreshed
 * by the database after each sync) plus one head-only count of NEP proposals;
 * no project rows are sent to the browser.
 */
async function loadDashboard() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { summary: null, nepCount: null, error: 'Supabase is not configured.' };

  const [stats, nep] = await Promise.all([
    supabase
      .from('dpwh_directory_stats')
      .select('computed_at, last_successful_sync_at, source_revision, source_snapshot_at, stats')
      .eq('id', 1)
      .maybeSingle(),
    supabase.from('project_directory').select('record_id', { count: 'exact', head: true }).eq('source', 'dpwh_nep_2027'),
  ]);

  let summary: DpwhSummary | null = null;
  let error: string | null = null;
  if (stats.error) {
    console.error('[LGU Tracker] Dashboard summary query failed:', stats.error);
    error = 'Could not load the contract summary.';
  } else {
    summary = (stats.data as DpwhSummary | null) ?? null;
  }
  if (nep.error) console.error('[LGU Tracker] NEP count query failed:', nep.error);
  return { summary, nepCount: nep.error ? null : nep.count, error };
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
      if (value !== undefined && k !== 'layer' && k !== 'focus' && k !== 'code' && k !== DASHBOARD_REGION_PARAM) usp.set(k, value);
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
  const dpwhFocus = layer === 'dpwh' ? parseFocus(params) : null;
  // Links that point at one project open the page at the map, not the dashboard above it.
  const pointsAtProject = Boolean(code || focusId || dpwhFocus);

  const dashboard = await loadDashboard();

  return (
    <div data-frame="wide" className="space-y-14">
      <DpwhDashboard
        summary={dashboard.summary}
        nepCount={dashboard.nepCount}
        error={dashboard.error}
        initialRegion={first(params[DASHBOARD_REGION_PARAM]) ?? ''}
        regionParam={DASHBOARD_REGION_PARAM}
      />

      <section id="map" aria-labelledby="map-title" className="space-y-6 scroll-mt-24 border-t border-line pt-10">
        {pointsAtProject && <ScrollToMap />}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-subtle">
              <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
              {layer === 'dpwh' ? 'DPWH contracts · Visayas and Mindanao' : 'DILG SubayBAYAN · LGU projects nationwide'}
            </p>
            <h2 id="map-title" className="mt-2 page-title text-[30px] sm:text-[36px] text-ink">Project Map</h2>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-subtle">
              {layer === 'dpwh'
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

        <nav aria-label="Map layer" className="flex">
          <div className="inline-flex max-w-full overflow-x-auto gap-0.5 p-1 rounded-full bg-surface border border-line shadow-raise">
            <Link href="/projects/map#map" aria-current={layer === 'dpwh' ? 'page' : undefined} className={layerTab(layer === 'dpwh')}>
              DPWH contracts
            </Link>
            <Link href="/projects/map?layer=subaybayan#map" aria-current={layer === 'subaybayan' ? 'page' : undefined} className={layerTab(layer === 'subaybayan')}>
              LGU projects<span className="hidden sm:inline">&nbsp;(DILG SubayBAYAN)</span>
            </Link>
          </div>
        </nav>

        {layer === 'dpwh' ? <DpwhPublicMap focus={dpwhFocus} /> : <SubaybayanMap initialFilters={initialFilters} focusId={focusId} />}
      </section>
    </div>
  );
}
