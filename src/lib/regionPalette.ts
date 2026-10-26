/**
 * The one region-to-colour mapping for the app: dashboard bars and legends,
 * region chips and selected states, and the map's "colour by region" mode all
 * read it, so a region keeps its colour everywhere and across renders.
 *
 * Colours are keyed by the region name exactly as the data reports it (with
 * a few spelling aliases), never by rank or position, so filtering or
 * re-sorting never repaints a region.
 *
 * The ten colours cover the regions in the DPWH contracts dataset (Visayas
 * and Mindanao). They were checked with the dataviz palette validator against
 * both theme surfaces (white and #161618): every slot sits in the lightness
 * band, clears the chroma floor and 3:1 contrast, and neighbours in this
 * geographic order are at least ΔE 10.8 apart under colour-vision
 * deficiency and 16.6 apart for normal vision. No palette of ten can keep
 * every pair apart, so a region's colour never stands alone: its name is
 * always printed beside it, and region swatches are squares where status
 * dots are round.
 *
 * Regions outside that set (Luzon regions appear only in nationwide NEP
 * proposals) and missing regions get the neutral swatch rather than a
 * borrowed colour.
 */

export interface RegionInfo {
  /** Region name as the data reports it. */
  name: string;
  /** Official regional name, shown after the designation. */
  area: string | null;
  islandGroup: 'Luzon' | 'Visayas' | 'Mindanao' | null;
  color: string;
}

export const REGION_NEUTRAL = '#8E8E93';

const REGIONS: readonly (Omit<RegionInfo, 'name'> & { key: string; aliases?: string[] })[] = [
  { key: 'Region VI', area: 'Western Visayas', islandGroup: 'Visayas', color: '#3F842E' },
  { key: 'Negros Island Region', area: null, islandGroup: 'Visayas', color: '#CE6489', aliases: ['NIR'] },
  { key: 'Region VII', area: 'Central Visayas', islandGroup: 'Visayas', color: '#3E6FC2' },
  { key: 'Region VIII', area: 'Eastern Visayas', islandGroup: 'Visayas', color: '#A08D00' },
  { key: 'Region IX', area: 'Zamboanga Peninsula', islandGroup: 'Mindanao', color: '#00A4AD' },
  { key: 'Region X', area: 'Northern Mindanao', islandGroup: 'Mindanao', color: '#C8741D' },
  { key: 'Region XI', area: 'Davao Region', islandGroup: 'Mindanao', color: '#B16EC0' },
  { key: 'Region XII', area: 'SOCCSKSARGEN', islandGroup: 'Mindanao', color: '#16A56E' },
  { key: 'Region XIII', area: 'Caraga', islandGroup: 'Mindanao', color: '#7D80DF', aliases: ['Caraga', 'CARAGA'] },
  {
    key: 'Bangsamoro Autonomous Region in Muslim Mindanao',
    area: null,
    islandGroup: 'Mindanao',
    color: '#A54C8B',
    aliases: ['BARMM', 'ARMM'],
  },
];

const LUZON = new Map<string, string | null>([
  ['National Capital Region', 'Metro Manila'],
  ['NCR', 'Metro Manila'],
  ['Cordillera Administrative Region', null],
  ['CAR', null],
  ['Region I', 'Ilocos Region'],
  ['Region II', 'Cagayan Valley'],
  ['Region III', 'Central Luzon'],
  ['Region IV-A', 'CALABARZON'],
  ['Region IV-B', 'MIMAROPA'],
  ['MIMAROPA', null],
  ['Region V', 'Bicol Region'],
]);

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const BY_KEY = new Map<string, (typeof REGIONS)[number]>();
for (const region of REGIONS) {
  BY_KEY.set(normalize(region.key), region);
  for (const alias of region.aliases ?? []) BY_KEY.set(normalize(alias), region);
}
const LUZON_BY_KEY = new Map([...LUZON].map(([k, v]) => [normalize(k), v]));

/** Colour, official name and island group of a region; null or unknown regions are neutral. */
export function regionInfo(region: string | null | undefined): RegionInfo {
  if (!region || !region.trim()) return { name: 'Region not reported', area: null, islandGroup: null, color: REGION_NEUTRAL };
  const known = BY_KEY.get(normalize(region));
  if (known) return { name: region, area: known.area, islandGroup: known.islandGroup, color: known.color };
  const luzonArea = LUZON_BY_KEY.get(normalize(region));
  if (luzonArea !== undefined) return { name: region, area: luzonArea, islandGroup: 'Luzon', color: REGION_NEUTRAL };
  return { name: region, area: null, islandGroup: null, color: REGION_NEUTRAL };
}

export const regionColor = (region: string | null | undefined) => regionInfo(region).color;

/** Short display name: the designation as reported, plus the official name when there is one. */
export function regionDisplayName(region: string | null | undefined): string {
  const info = regionInfo(region);
  if (info.name === 'Bangsamoro Autonomous Region in Muslim Mindanao') return 'BARMM';
  return info.area ? `${info.name} · ${info.area}` : info.name;
}

/** Every region with a dedicated colour, in geographic order (legends, tests). */
export const COLORED_REGIONS = REGIONS.map((r) => r.key);
