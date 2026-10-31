/**
 * LGU Tracker's own grouping of DILG SubayBAYAN projects. These categories
 * are NOT an official DILG classification: they come from deterministic
 * keyword rules over the project title (see scripts/subaybayan/lib/classify.ts)
 * and are labelled "LGU Tracker classification" wherever they are shown.
 *
 * Shared by the import pipeline, the API routes and the map UI.
 */

export const SUBAYBAYAN_CATEGORIES = ['infrastructure', 'community', 'health', 'environment', 'disaster', 'uncategorized'] as const;
export type SubaybayanCategory = (typeof SUBAYBAYAN_CATEGORIES)[number];

export const SUBAYBAYAN_CATEGORY_LABELS: Record<SubaybayanCategory, string> = {
  infrastructure: 'Infrastructure',
  community: 'Community development',
  health: 'Health and social services',
  environment: 'Environment',
  disaster: 'Disaster preparedness',
  uncategorized: 'Uncategorized',
};

/** Short labels for chips and the legend. */
export const SUBAYBAYAN_CATEGORY_SHORT: Record<SubaybayanCategory, string> = {
  infrastructure: 'Infrastructure',
  community: 'Community',
  health: 'Health & social',
  environment: 'Environment',
  disaster: 'Disaster',
  uncategorized: 'Uncategorized',
};

/**
 * Marker colours: distinct hues with enough contrast on the light and dark
 * map tiles, never the brand accent (which marks selection). Uncategorized is
 * a neutral grey so it reads as "no group" rather than another group.
 */
export const SUBAYBAYAN_CATEGORY_COLORS: Record<SubaybayanCategory, string> = {
  infrastructure: '#2563EB',
  community: '#9333EA',
  health: '#DB2777',
  environment: '#16A34A',
  disaster: '#D97706',
  uncategorized: '#6B7280',
};

export const SUBAYBAYAN_SUBCATEGORIES = {
  disaster: ['Evacuation centers', 'Disaster mitigation and preparedness'],
  health: ['Health facilities', 'Social services'],
  community: ['Community development programs', 'Livelihood initiatives', 'Community facilities'],
  environment: ['Waste and sanitation', 'Environmental protection'],
  infrastructure: ['Water supply systems', 'Other public infrastructure', 'Roads and bridges', 'Markets and multipurpose buildings', 'Public buildings'],
  uncategorized: ['Uncategorized'],
} as const satisfies Record<SubaybayanCategory, readonly string[]>;

export type SubaybayanSubcategory = (typeof SUBAYBAYAN_SUBCATEGORIES)[SubaybayanCategory][number];

export function isSubaybayanCategory(value: unknown): value is SubaybayanCategory {
  return typeof value === 'string' && (SUBAYBAYAN_CATEGORIES as readonly string[]).includes(value);
}

export const SUBAYBAYAN_STATUSES = ['completed', 'ongoing', 'not_yet_started', 'cancelled', 'unknown'] as const;
export type SubaybayanStatus = (typeof SUBAYBAYAN_STATUSES)[number];

export const SUBAYBAYAN_STATUS_LABELS: Record<SubaybayanStatus, string> = {
  completed: 'Completed',
  ongoing: 'On-going',
  not_yet_started: 'Not yet started',
  cancelled: 'Cancelled / terminated',
  unknown: 'Unknown',
};

export const LOCATION_PRECISIONS = ['barangay_centroid', 'municipality_centroid', 'province_centroid', 'unresolved'] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const LOCATION_PRECISION_LABELS: Record<LocationPrecision, string> = {
  barangay_centroid: 'Barangay area',
  municipality_centroid: 'City / municipality area',
  province_centroid: 'Province area',
  unresolved: 'Not mapped',
};

export const SUBAYBAYAN_DATASETS = ['lgsf', 'rlip'] as const;
export type SubaybayanDataset = (typeof SUBAYBAYAN_DATASETS)[number];
