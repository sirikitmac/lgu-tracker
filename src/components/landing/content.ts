/**
 * Static content of the landing page: region names for the coverage section
 * and the credits of every photograph it shows. Client-safe (no I/O).
 */

/** Common names of the project regions the DPWH sync stores (see nationwide/scope.ts). */
export const REGION_NAMES: Record<string, string> = {
  'Region VI': 'Western Visayas',
  'Region VII': 'Central Visayas',
  'Region VIII': 'Eastern Visayas',
  'Negros Island Region': 'Negros Island',
  'Region IX': 'Zamboanga Peninsula',
  'Region X': 'Northern Mindanao',
  'Region XI': 'Davao Region',
  'Region XII': 'SOCCSKSARGEN',
  'Region XIII': 'Caraga',
  'Bangsamoro Autonomous Region in Muslim Mindanao': 'Bangsamoro (BARMM)',
};

/** Short code shown beside the common name; BARMM's code is already in its name. */
export function regionCode(region: string): string | null {
  if (region === 'Negros Island Region') return 'NIR';
  if (region.startsWith('Bangsamoro')) return null;
  return region;
}

export function regionName(region: string): string {
  return REGION_NAMES[region] ?? region;
}

export interface LandingPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** What and where, shown as the caption. */
  caption: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const CC_BY_SA_4 = { license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' };

/** Found pictures of the covered regions (Wikimedia Commons). None of them is an LGU Tracker project. */
export const PHOTOS = {
  sanJuanico: {
    src: '/landing/san-juanico-bridge-samar-curve-tacloban-leyte.jpg',
    width: 1920,
    height: 1440,
    alt: 'The curved San Juanico Bridge crossing the strait between Samar and Leyte, with a tricycle on the road',
    caption: 'San Juanico Bridge, Samar–Leyte, Eastern Visayas',
    title: 'San Juanico Bridge Samar curve (Tacloban, Leyte; 09-09-2022)',
    creator: 'Patrickroque01',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=123494832',
    ...CC_BY_SA_4,
  },
  route9: {
    src: '/landing/national-route-9-at-iligan-city.jpg',
    width: 1920,
    height: 1280,
    alt: 'National Route 9 running along the coast of Iligan City, with road works and a footbridge in the foreground',
    caption: 'National Route 9 along the coast of Iligan City, Northern Mindanao',
    title: 'National Route 9 at Iligan City',
    creator: 'Marwan Khan',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=78285518',
    ...CC_BY_SA_4,
  },
  iligan: {
    src: '/landing/iligan-city-proper-overlooking-mount-lelong-iligan.jpg',
    width: 1920,
    height: 1440,
    alt: 'Rooftops of Iligan City seen from Mount Lelong, with the bay behind',
    caption: 'Iligan City from Mount Lelong',
    title: 'Iligan City Proper overlooking Mount Lelong (Iligan, Lanao Del Norte; 10-15-2023)',
    creator: 'Patrickroque01',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=140088480',
    ...CC_BY_SA_4,
  },
  wmsu: {
    src: '/landing/western-mindanao-state-university-college-of-teacher.jpg',
    width: 1920,
    height: 1440,
    alt: 'Students walking past the white arched College of Teacher Education building of Western Mindanao State University',
    caption: 'Western Mindanao State University, Zamboanga City',
    title: 'Western Mindanao State University College of Teacher Education (Normal Road, Baliwasan, Zamboanga City; 10-06-2023)',
    creator: 'Patrickroque01',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=140070705',
    ...CC_BY_SA_4,
  },
  rizalMap: {
    src: '/landing/relief-map-of-mindanao-by-jose-rizal.jpg',
    width: 1920,
    height: 1080,
    alt: 'A large relief map of Mindanao laid out in a park, its coastline painted blue on the grass',
    caption: 'Relief map of Mindanao made by José Rizal, Dapitan City',
    title: 'Relief Map of Mindanao by Jose Rizal in Dapitan City',
    creator: 'Fung360',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=73037602',
    ...CC_BY_SA_4,
  },
  marceloFernan: {
    src: '/landing/marcelo-fernan-bridge-mandaue-cebu-01-19.jpg',
    width: 1920,
    height: 1440,
    alt: 'The cable-stayed Marcelo Fernan Bridge over the Mactan Channel under a blue sky',
    caption: 'Marcelo Fernan Bridge, Mandaue–Lapu-Lapu, Central Visayas',
    title: 'Marcelo Fernan Bridge (Mandaue, Cebu; 01-19-2024)',
    creator: 'Patrickroque01',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=146414180',
    ...CC_BY_SA_4,
  },
} satisfies Record<string, LandingPhoto>;
