/**
 * Display helpers for the SubayBAYAN layer (client and server safe).
 */
import { STATUS_TONES, type StatusTone } from '@/lib/statusPalette';
import { LOCATION_PRECISION_LABELS, type LocationPrecision, type SubaybayanStatus } from './categories';

/** Same meaning, same colour as the rest of the app (see statusPalette.ts). */
export const SUBAYBAYAN_STATUS_TONE: Record<SubaybayanStatus, StatusTone> = {
  completed: 'green',
  ongoing: 'blue',
  not_yet_started: 'gray',
  cancelled: 'red',
  unknown: 'lightGray',
};

export const subaybayanStatusBadge = (s: SubaybayanStatus) => STATUS_TONES[SUBAYBAYAN_STATUS_TONE[s]].badge;
export const subaybayanStatusFill = (s: SubaybayanStatus) => STATUS_TONES[SUBAYBAYAN_STATUS_TONE[s]].fill;

export const isApproximate = (p: LocationPrecision) => p === 'municipality_centroid' || p === 'province_centroid';

/** One sentence on what the marker position means, for the detail panel. */
export function precisionNote(p: LocationPrecision): string {
  switch (p) {
    case 'barangay_centroid':
      return 'Shown at the centre of the barangay area, not at the project site.';
    case 'municipality_centroid':
      return 'Shown at the centre of the city or municipality: the barangay was missing, listed several places, or could not be matched.';
    case 'province_centroid':
      return 'Shown at the centre of the province: the project is province-level or its city/municipality could not be matched.';
    default:
      return 'Not on the map: the location in the source could not be matched to a place.';
  }
}

export const precisionLabel = (p: LocationPrecision) => LOCATION_PRECISION_LABELS[p];

/** "Brgy, City, Province" from the source labels, title-cased where the source is all caps. */
export function placeLine(p: { barangay?: string | null; citymun?: string | null; province?: string | null }): string {
  const tidy = (s: string | null | undefined) => {
    if (!s) return null;
    return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : s;
  };
  const parts = [tidy(p.barangay), tidy(p.citymun), tidy(p.province)].filter((v): v is string => !!v);
  // NCR and HUC rows repeat the city in the province column.
  const unique = parts.filter((v, i) => parts.indexOf(v) === i);
  return unique.join(', ') || 'Location not reported';
}

/** Region labels like "REGION X - NORTHERN MINDANAO" → "Region X · Northern Mindanao". */
export function regionLabel(raw: string): string {
  const m = /^REGION\s+([IVX]+(?:-A)?)\s*-\s*(.+)$/i.exec(raw);
  const title = (s: string) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  if (m) return `Region ${m[1].toUpperCase()} · ${title(m[2]).replace('Soccsksargen', 'SOCCSKSARGEN').replace('Calabarzon', 'CALABARZON')}`;
  if (raw === 'MIMAROPA') return 'MIMAROPA';
  return title(raw);
}

export const placeOptionLabel = (raw: string) => (raw === raw.toUpperCase() ? placeLine({ citymun: raw }) : raw);

// ---------------------------------------------------------------------------
// Project directory (public.project_directory) helpers for DILG rows.

/**
 * Same as private.subaybayan_region_label() in migration 20261105000100:
 * "REGION X - NORTHERN MINDANAO" → "Region X", the label DPWH rows use, so one
 * region filter matches both agencies.
 */
export function directoryRegionLabel(raw: string | null): string | null {
  if (raw === null) return null;
  const up = raw.toUpperCase();
  if (up === 'NATIONAL CAPITAL REGION') return 'National Capital Region';
  if (up === 'CORDILLERA ADMINISTRATIVE REGION') return 'Cordillera Administrative Region';
  if (up === 'NEGROS ISLAND REGION') return 'Negros Island Region';
  if (up === 'MIMAROPA') return 'Region IV-B';
  if (up.startsWith('BANGSAMORO')) return 'Bangsamoro Autonomous Region in Muslim Mindanao';
  const m = /^REGION ([IVX]+(?:-A)?) /.exec(up);
  return m ? `Region ${m[1]}` : raw;
}

/** Same as private.subaybayan_province_label(): Postgres initcap, then Philippine particles lowercased. */
export function directoryProvinceLabel(raw: string | null): string | null {
  if (raw === null) return null;
  // initcap: first letter of each alphanumeric run upper, the rest lower.
  const initcap = raw.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  return initcap.replaceAll(' Del ', ' del ').replaceAll(' De ', ' de ').replaceAll(' Of ', ' of ');
}

/** Title case for a place the source writes in capitals ("CITY OF ILIGAN" → "City of Iligan"). */
export function tidyPlace(s: string | null): string | null {
  if (!s) return null;
  return placeLine({ citymun: s }).replace(/ (Of|De|Del) /g, (m) => m.toLowerCase());
}

/**
 * The LGU that owns a project. SubayBAYAN's "project owner" is a level
 * (Province, Citymun, Barangay); it is named here from the row's location,
 * with the level in brackets.
 */
export function implementingLgu(p: { project_owner: string | null; province: string | null; municipality: string | null; barangay: string | null }): string | null {
  const city = tidyPlace(p.municipality);
  switch (p.project_owner) {
    case 'Province':
      return p.province ? `${p.province} (province)` : 'Provincial government';
    case 'Citymun':
      return city ? `${city} (city / municipality)` : 'City or municipal government';
    case 'Barangay':
      return p.barangay ? `Brgy. ${tidyPlace(p.barangay)}${city ? `, ${city}` : ''} (barangay)` : 'Barangay government';
    default:
      return p.project_owner;
  }
}

// Titles that show flood-control or slope work, the only disaster-mitigation projects a flood-control photo fits.
const FLOOD_WORK = /\b(flood|dikes?|revetments?|slope|sea\s*walls?|rip[\s-]?rap|gabions?|river|creek|drainage|canals?|retaining\s*walls?|check\s*dams?|embankments?|dredging|shore\s*line)\b/i;
const BRIDGE_WORK = /\b(bridges?|foot\s*bridges?|hanging\s*bridges?)\b/i;

/**
 * Which representative photo set (a DPWH category pool) fits a DILG project,
 * or null for an illustrated header. Photos are used only where the picture
 * shows the same kind of work: roads, bridges, water systems, public
 * buildings and markets, and flood-control works. Health, social services,
 * community programs, environment, equipment, lighting and uncategorized
 * projects never get an infrastructure photo.
 */
export function dilgPhotoCategory(subcategory: string | null, title: string): 'roads_highways' | 'bridges' | 'water_infrastructure' | 'buildings_facilities' | 'flood_control_drainage' | null {
  switch (subcategory) {
    case 'Roads and bridges':
      return BRIDGE_WORK.test(title) ? 'bridges' : 'roads_highways';
    case 'Water supply systems':
      return 'water_infrastructure';
    case 'Public buildings':
    case 'Markets and multipurpose buildings':
      return 'buildings_facilities';
    case 'Disaster mitigation and preparedness':
      return FLOOD_WORK.test(title) ? 'flood_control_drainage' : null;
    default:
      return null;
  }
}
