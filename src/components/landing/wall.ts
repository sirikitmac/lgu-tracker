import { CATEGORY_PHOTO_POOLS } from '@/components/dpwh/categoryPhotoCatalog';
import { PHOTOS, type LandingPhoto } from './content';

/**
 * The hero's photo wall: public works in the covered regions, from the
 * landing set and the category catalogue (Wikimedia Commons, credited on
 * /credits). Each tile keeps a short place caption and the word
 * "Illustrative"; none of them is a project record.
 */
export interface WallPhoto {
  src: string;
  width: number;
  height: number;
  caption: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const catalog = new Map(
  Object.values(CATEGORY_PHOTO_POOLS)
    .flat()
    .map((p) => [p.src, p])
);

function fromCatalog(src: string, caption: string): WallPhoto | null {
  const p = catalog.get(src);
  return p ? { src: p.src, width: p.width, height: p.height, caption, title: p.title, creator: p.creator, license: p.license, licenseUrl: p.licenseUrl, sourceUrl: p.sourceUrl } : null;
}

function fromLanding(p: LandingPhoto, caption: string): WallPhoto {
  return { src: p.src, width: p.width, height: p.height, caption, title: p.title, creator: p.creator, license: p.license, licenseUrl: p.licenseUrl, sourceUrl: p.sourceUrl };
}

const cat = '/categories';

/** Three columns; on phones only the first two are drawn. */
export const WALL_COLUMNS: WallPhoto[][] = [
  [
    fromLanding(PHOTOS.sanJuanico, 'San Juanico Bridge, Leyte'),
    fromCatalog(`${cat}/bridges/cclex-bridge-cebu-city-01-10-2024.jpg`, 'CCLEX Bridge, Cebu City'),
    fromCatalog(`${cat}/roads_highways/davao-cotabato-road-amas-kidapawan-north-cotabato.jpg`, 'Davao–Cotabato Road, Kidapawan'),
    fromCatalog(`${cat}/bridges/view-of-the-panguil-bay-bridge-in.jpg`, 'Panguil Bay Bridge, Lanao del Norte'),
    fromCatalog(`${cat}/buildings_facilities/baclayon-municipal-hall.jpg`, 'Municipal hall, Baclayon, Bohol'),
  ],
  [
    fromLanding(PHOTOS.route9, 'National Route 9, Iligan City'),
    fromCatalog(`${cat}/bridges/macapagal-bridge-butuan-agusan-del-norte-08.jpg`, 'Macapagal Bridge, Butuan'),
    fromCatalog(`${cat}/bridges/carpenter-bridge-iloilo-river-tabucan-mandurriao-drone.jpg`, 'Carpenter Bridge, Iloilo City'),
    fromCatalog(`${cat}/roads_highways/zamboanga-west-coastal-road-sinunoc-zamboanga-city.jpg`, 'West Coastal Road, Zamboanga City'),
    fromCatalog(`${cat}/buildings_facilities/aloran-rural-health-unit.jpg`, 'Rural health unit, Aloran'),
  ],
  [
    fromLanding(PHOTOS.marceloFernan, 'Marcelo Fernan Bridge, Cebu'),
    fromCatalog(`${cat}/roads_highways/tagbilaran-east-road-tiguis-lila-bohol-01.jpg`, 'Tagbilaran East Road, Lila, Bohol'),
    fromLanding(PHOTOS.iligan, 'Iligan City from Mount Lelong'),
    fromCatalog(`${cat}/bridges/magsaysay-bridge-butuan-agusan-river-butuan-agusan.jpg`, 'Magsaysay Bridge, Butuan'),
    fromCatalog(`${cat}/flood_control_drainage/drainage-canal-at-60-don-gil-garcia.jpg`, 'Drainage canal, Cebu City'),
  ],
].map((column) => column.filter((p): p is WallPhoto => p !== null));

/** One photograph per card of "Six ways in", in card order. */
export const WAY_PHOTOS: Record<'search' | 'map' | 'code' | 'agency' | 'dashboard' | 'bp', WallPhoto | null> = {
  search: fromCatalog(`${cat}/bridges/davao-river-bucana-bridge-bolton-bridge-drone.jpg`, 'Davao River bridges, Davao City'),
  map: fromLanding(PHOTOS.rizalMap, 'Rizal’s relief map of Mindanao, Dapitan'),
  code: fromCatalog(`${cat}/buildings_facilities/gli-gli-barangay-hall-sga.jpg`, 'Barangay hall, Gli-Gli'),
  agency: fromCatalog(`${cat}/bridges/mactan-mandaue-bridge-welcome-marker-cebu-09.jpg`, 'Mactan–Mandaue Bridge, Cebu'),
  dashboard: fromCatalog(`${cat}/roads_highways/coastal-road-davao-city-01.jpg`, 'Coastal Road, Davao City'),
  bp: fromCatalog(`${cat}/buildings_facilities/rizal-elementary-school-building-bacolod-city.jpg`, 'Rizal Elementary School, Bacolod'),
};

/** The closing section's cursor trail, shown in this order (and as its still collage, the first five). */
export const TRAIL_PHOTOS: WallPhoto[] = [
  fromCatalog(`${cat}/bridges/cclex-bridge-cebu-city-01-10-2024.jpg`, 'CCLEX Bridge, Cebu City'),
  fromCatalog(`${cat}/buildings_facilities/sumpong-barangay-hall.jpg`, 'Barangay hall, Sumpong, Malaybalay'),
  fromCatalog(`${cat}/roads_highways/zamboanga-west-coastal-road-sinunoc-zamboanga-city.jpg`, 'West Coastal Road, Zamboanga City'),
  fromCatalog(`${cat}/water_infrastructure/sagbayan-dam-2.jpg`, 'Sagbayan Dam, Bohol'),
  fromLanding(PHOTOS.wmsu, 'Western Mindanao State University, Zamboanga City'),
  fromCatalog(`${cat}/bridges/san-juanico-bridge-main-span-close-up.jpg`, 'San Juanico Bridge, Leyte'),
  fromCatalog(`${cat}/buildings_facilities/la-paz-market-iloilo-city.jpg`, 'La Paz Market, Iloilo City'),
  fromCatalog(`${cat}/bridges/tagbilaran-east-road-ob-clarin-bridge-inside.jpg`, 'OB Clarin Bridge, Loay, Bohol'),
  fromCatalog(`${cat}/water_infrastructure/barotac-viejo-dam-cimg0351.jpg`, 'Barotac Viejo Dam, Iloilo'),
  fromCatalog(`${cat}/buildings_facilities/provincial-capitol-cebu-philippines.jpg`, 'Provincial Capitol, Cebu City'),
  fromCatalog(`${cat}/bridges/view-of-the-panguil-bay-bridge-in.jpg`, 'Panguil Bay Bridge, Lanao del Norte'),
  fromCatalog(`${cat}/buildings_facilities/barangay-hall-of-baybay-alubijid.jpg`, 'Barangay hall, Baybay, Alubijid'),
].filter((p): p is WallPhoto => p !== null);

/** Every picture the page shows, once, for the credits list. */
export function pageCredits(extra: LandingPhoto[]): WallPhoto[] {
  const seen = new Map<string, WallPhoto>();
  const shown = [...WALL_COLUMNS.flat(), ...Object.values(WAY_PHOTOS), ...TRAIL_PHOTOS];
  for (const p of shown) if (p && !seen.has(p.src)) seen.set(p.src, p);
  for (const p of extra) if (!seen.has(p.src)) seen.set(p.src, fromLanding(p, p.caption));
  return [...seen.values()];
}
