import { CATEGORY_PHOTO_POOLS, type CategoryPhoto } from '@/components/dpwh/categoryPhotoCatalog';
import { BOUNDARY_SOURCE, SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';
import { PROJECT_SOURCES } from '@/lib/integrations/bettergov/sources';
import { PHOTOS } from './content';
import { pageCredits, type WallPhoto } from './wall';

/**
 * Everything /credits lists: the data sources and every photograph the app
 * shows (the landing set, then the project-card catalogue). Client-safe.
 */

export interface DataCredit {
  name: string;
  what: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
}

export const DATA_CREDITS: DataCredit[] = [
  {
    name: 'DPWH Transparency Portal, via BetterGov.ph',
    what: 'DPWH contracts in the Visayas and Mindanao.',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: PROJECT_SOURCES.dpwh_contracts.datasetUrl,
  },
  {
    name: 'FY 2027 National Expenditure Program, via BetterGov.ph',
    what: 'DPWH budget proposals, nationwide.',
    license: PROJECT_SOURCES.dpwh_nep_2027.license,
    licenseUrl: null,
    sourceUrl: PROJECT_SOURCES.dpwh_nep_2027.datasetUrl,
  },
  {
    name: 'DILG SubayBAYAN',
    what: `${SUBAYBAYAN_DATASET_INFO.lgsf.label} and ${SUBAYBAYAN_DATASET_INFO.rlip.short}, nationwide. One-time export, retrieved ${SUBAYBAYAN_RETRIEVED_LABEL}.`,
    license: 'Public government records (DILG)',
    licenseUrl: null,
    sourceUrl: 'https://subaybayan.dilg.gov.ph/',
  },
  {
    name: 'Administrative boundaries: NAMRIA / PSA via OCHA (COD-AB)',
    what: `Region, province and town shapes (${BOUNDARY_SOURCE.psgc}), used to place LGU projects.`,
    license: 'CC BY-IGO 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/igo/',
    sourceUrl: 'https://data.humdata.org/dataset/cod-ab-phl',
  },
  {
    name: `Boundary files: ${BOUNDARY_SOURCE.name} ${BOUNDARY_SOURCE.release}`,
    what: 'The packaged GeoJSON of the boundaries above.',
    license: BOUNDARY_SOURCE.license,
    licenseUrl: 'https://opensource.org/license/mit',
    sourceUrl: `https://github.com/${BOUNDARY_SOURCE.name}`,
  },
  {
    name: 'OpenStreetMap contributors',
    what: 'Map tiles.',
    license: 'ODbL',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
    sourceUrl: 'https://www.openstreetmap.org/',
  },
];

/** Every photograph on the landing page, once. */
export function landingPhotoCredits(): WallPhoto[] {
  return pageCredits(Object.values(PHOTOS));
}

/** The project-card catalogue by category, without the photos already credited for the landing page. */
export function cardPhotoCredits(): { category: string; photos: CategoryPhoto[] }[] {
  const listed = new Set(landingPhotoCredits().map((p) => p.src));
  return Object.entries(CATEGORY_PHOTO_POOLS)
    .map(([category, pool]) => ({ category, photos: (pool ?? []).filter((p) => !listed.has(p.src)) }))
    .filter((g) => g.photos.length > 0);
}
