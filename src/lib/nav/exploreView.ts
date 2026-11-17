/**
 * The public Map & Dashboard page (/projects/map) shows the map and the
 * dashboard together. ?view=dashboard (an older link, and the "Dashboard" link
 * in the menus) opens the page scrolled to the dashboard; the map is the default.
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

/**
 * Whether the signed-in sidebar is drawn on a /projects page. Always: it starts
 * collapsed to a narrow strip, so even the wide Map & Dashboard page keeps it.
 */
export function showsProjectsSidebar(_pathname: string, _view: string | null | undefined): boolean {
  return true;
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
