/**
 * The public Map & Dashboard page (/projects/map) shows one of two views,
 * kept in the address bar as ?view= so links are shareable and Back works.
 * The map is the default, so every older /projects/map link still opens it.
 */
export type ExploreView = 'map' | 'dashboard';

export const EXPLORE_PATH = '/projects/map';

/** ?view=dashboard opens the dashboard; anything else (missing, unknown, repeated) is the map. */
export function parseExploreView(value: string | string[] | null | undefined): ExploreView {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'dashboard' ? 'dashboard' : 'map';
}

/** The link for a view. The map keeps the short /projects/map address. */
export function exploreViewHref(view: ExploreView, params?: Record<string, string | null | undefined>): string {
  const usp = new URLSearchParams();
  if (view === 'dashboard') usp.set('view', 'dashboard');
  for (const [k, v] of Object.entries(params ?? {})) if (v) usp.set(k, v);
  const qs = usp.toString();
  return qs ? `${EXPLORE_PATH}?${qs}` : EXPLORE_PATH;
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Whether the signed-in sidebar is drawn on a /projects page. The map view
 * keeps the whole width; the dashboard view and every other page keep the sidebar.
 */
export function showsProjectsSidebar(pathname: string, view: string | null | undefined): boolean {
  return !(under(pathname, EXPLORE_PATH) && parseExploreView(view) === 'map');
}

/**
 * The SubayBAYAN map rewrites the address bar as its filters change. This builds
 * that address from the filter query, keeping ?view= when the current URL has it.
 */
export function subaybayanAddress(filterQuery: string, currentSearch: string): string {
  const params = new URLSearchParams(filterQuery);
  params.set('layer', 'subaybayan');
  const view = new URLSearchParams(currentSearch).get('view');
  if (view) params.set('view', view);
  return `${EXPLORE_PATH}?${params.toString()}`;
}
