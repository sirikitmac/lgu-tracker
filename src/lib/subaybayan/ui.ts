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
