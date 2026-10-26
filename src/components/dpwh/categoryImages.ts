import { PHOTOS, type LandingPhoto } from '@/components/landing/content';
import type { DpwhCategory } from '@/types/dpwh';

/**
 * Representative photographs per project category. The source data holds no
 * project photographs (DPWH reports only a photo count), so these show the
 * kind of work, never a specific contract: every use is labelled
 * "Representative photo" and the credits are listed on the page.
 * Categories without a fitting picture get a plain tile instead.
 */

export type CategoryPhoto = Pick<LandingPhoto, 'src' | 'width' | 'height' | 'caption' | 'title' | 'creator' | 'license' | 'licenseUrl' | 'sourceUrl'> & {
  /** Which category the picture stands for, in words. */
  depicts: string;
};

const DRAINAGE: CategoryPhoto = {
  src: '/categories/drainage-canal-quezon-city.jpg',
  width: 1280,
  height: 853,
  caption: 'A drainage canal in Quezon City',
  depicts: 'a drainage canal',
  title: 'An drainage canal in Quezon City (2026-01-14)',
  creator: 'Wide Awake!',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:An_drainage_canal_in_Quezon_City_(2026-01-14).jpg',
};

const PUMPING: CategoryPhoto = {
  src: '/categories/pumping-station-tuktukan.jpg',
  width: 1280,
  height: 960,
  caption: 'Pumping station pipework, Tuktukan, Taguig',
  depicts: 'water pumping pipework',
  title: 'Pumping stations in the Philippines Tuktukan 02',
  creator: 'RamaGaspar',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pumping_stations_in_the_Philippines_Tuktukan_02.jpg',
};

const fromLanding = (p: LandingPhoto, depicts: string): CategoryPhoto => ({ ...p, depicts });

export const CATEGORY_PHOTOS: Partial<Record<DpwhCategory, CategoryPhoto>> = {
  roads_highways: fromLanding(PHOTOS.route9, 'a national road'),
  bridges: fromLanding(PHOTOS.sanJuanico, 'a bridge'),
  buildings_facilities: fromLanding(PHOTOS.wmsu, 'a public building'),
  flood_control_drainage: DRAINAGE,
  water_infrastructure: PUMPING,
};

export function categoryPhoto(category: string | null): CategoryPhoto | null {
  return category && category in CATEGORY_PHOTOS ? CATEGORY_PHOTOS[category as DpwhCategory] ?? null : null;
}

/** Unique photos in display order, for the credits list. */
export const CATEGORY_PHOTO_CREDITS: { category: DpwhCategory; photo: CategoryPhoto }[] = (
  Object.entries(CATEGORY_PHOTOS) as [DpwhCategory, CategoryPhoto][]
).map(([category, photo]) => ({ category, photo }));
