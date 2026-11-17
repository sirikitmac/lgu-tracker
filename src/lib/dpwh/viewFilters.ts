import { DPWH_CATEGORIES, DPWH_STATUSES } from '@/types/dpwh';

/**
 * The filters the public map and the public dashboard share: click a region,
 * status or category on one and the other follows. They live in the address
 * bar as ?region=&status=&category= so a view can be shared.
 */
export interface ViewFilters {
  region: string;
  status: string;
  category: string;
}

export const EMPTY_VIEW_FILTERS: ViewFilters = { region: '', status: '', category: '' };

/** Where a change came from: the dashboard also asks the map to zoom to the result. */
export type FilterOrigin = 'map' | 'dashboard';

/** A bounding box over the Philippines (west, south, east, north), used to count and frame a whole filter. */
export const PH_BBOX = '116,4,127,21.5';

const REGION_SHAPE = /^[A-Za-z0-9 .,'()\-–·/]{1,60}$/;

const first = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Reads the shared filters from query values; anything unknown is dropped rather than trusted. */
export function parseViewFilters(get: (key: string) => string | string[] | null | undefined): ViewFilters {
  const region = first(get('region')).trim();
  const status = first(get('status')).trim();
  const category = first(get('category')).trim();
  return {
    region: REGION_SHAPE.test(region) ? region : '',
    status: (DPWH_STATUSES as readonly string[]).includes(status) ? status : '',
    category: (DPWH_CATEGORIES as readonly string[]).includes(category) ? category : '',
  };
}

export const hasViewFilters = (f: ViewFilters) => !!(f.region || f.status || f.category);

export const sameViewFilters = (a: ViewFilters, b: ViewFilters) => a.region === b.region && a.status === b.status && a.category === b.category;

/** Selecting the value that is already selected clears it. */
export function toggleViewFilter(f: ViewFilters, key: keyof ViewFilters, value: string | null): ViewFilters {
  const next = value && f[key] !== value ? value : '';
  return { ...f, [key]: next };
}

/** The query string with the shared filters set (or removed), keeping every other parameter. */
export function searchWithViewFilters(currentSearch: string, f: ViewFilters): string {
  const params = new URLSearchParams(currentSearch);
  for (const key of ['region', 'status', 'category'] as const) {
    if (f[key]) params.set(key, f[key]);
    else params.delete(key);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
