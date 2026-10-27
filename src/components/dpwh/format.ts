import {
  DPWH_CATEGORY_LABELS,
  DPWH_STATUSES,
  DPWH_STATUS_LABELS,
  DPWH_WARNING_LABELS,
  INVALID_DATE,
  INVALID_NUMBER,
  type DpwhCategory,
  type DpwhStatus,
} from '@/types/dpwh';
import { STATUS_TONES, type StatusTone } from '@/lib/statusPalette';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-US');

export function formatPeso(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Not reported';
  const n = Number(value);
  return Number.isFinite(n) ? peso.format(n) : 'Not reported';
}

export function formatPesoCompact(value: number): string {
  if (value >= 1e12) return `₱${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `₱${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `₱${(value / 1e6).toFixed(1)}M`;
  return peso.format(value);
}

export function formatCount(value: number): string {
  return count.format(value);
}

/** Share of a whole as a percentage with one decimal; tiny non-zero shares print as "<0.1%". */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return '—';
  const pct = (part / whole) * 100;
  if (pct > 0 && pct < 0.05) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

/** Reported location line for a directory row: province, or a count when the record spans several. */
export function locationLabel(item: { province: string | null; provinces: string[] }): string {
  return item.province ?? (item.provinces.length > 1 ? `${item.provinces.length} provinces` : 'Not reported');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not reported';
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

export function formatProgress(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'Not reported';
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(n % 1 === 0 ? 0 : 1)}%` : 'Not reported';
}

// Joining words lowercased inside a title; place-name particles ("Zamboanga del Norte", "Cagayan de Oro") included.
const TITLE_PARTICLES = new Set([
  'A', 'ALONG', 'AN', 'AND', 'AS', 'AT', 'BY', 'DE', 'DEL', 'FOR', 'FROM', 'IN', 'INTO', 'OF', 'ON', 'OR', 'THE', 'TO', 'UNDER', 'VIA', 'WITH',
]);
// Acronyms in DPWH titles that contain a vowel, so the no-vowel rule below does not catch them.
const TITLE_ACRONYMS = new Set(['ADB', 'BARMM', 'IGCMRSP', 'JICA', 'KOICA', 'LGU', 'NEP', 'NIR', 'ODA', 'PHI', 'ROW', 'RROW']);

function titleWord(word: string, first: boolean): string {
  const core = word.replace(/\./g, '');
  if (
    /\d/.test(word) || // codes and chainages: PR-08, K1769+648.00, 3631-PHI
    TITLE_ACRONYMS.has(core) ||
    /^[IVX]{1,4}$/.test(core) || // roman numerals: Region VII, Phase II
    /^([A-Z]\.)+[A-Z]?$/.test(word) || // initials: R.T.
    (!/[AEIOUY]/.test(core) && core.length > 1 && !word.endsWith('.')) // DPWH, PR, RCDG (but Jct., Brgy.)
  ) {
    return word;
  }
  if (!first && TITLE_PARTICLES.has(core)) return word.toLowerCase();
  return word.charAt(0) + word.slice(1).toLowerCase();
}

/**
 * Display casing for a project title the source publishes in capitals, so a
 * long title reads as words instead of a block. Words keep capitals where
 * lowercasing could misstate them: place names stay capitalized (which is
 * why this is title case, not sentence case), and acronyms, codes,
 * chainages, initials and roman numerals are left as published. Titles that
 * already use mixed case are returned unchanged. Display only: the stored
 * name is never altered, and screens that show it should keep it available
 * (for example as the element's title).
 */
export function readableTitle(value: string): string {
  const letters = value.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '').length;
  if (letters.length < 4 || upper / letters.length < 0.9) return value;
  let first = true;
  return value.replace(/[A-Za-z0-9.+']+/g, (word) => {
    if (!/[A-Za-z]/.test(word)) return word;
    const out = titleWord(word.toUpperCase(), first);
    first = false;
    return out;
  });
}

/** Days between two ISO dates, or null. */
export function durationDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 86_400_000) : null;
}

export function categoryLabel(value: string | null): string {
  return value && value in DPWH_CATEGORY_LABELS ? DPWH_CATEGORY_LABELS[value as DpwhCategory] : 'Uncategorized';
}

export function statusLabel(value: string | null): string {
  return value && value in DPWH_STATUS_LABELS ? DPWH_STATUS_LABELS[value as DpwhStatus] : 'Unknown';
}

export function warningLabel(code: string): string {
  if (code.startsWith(INVALID_NUMBER)) return `Source value for "${code.slice(INVALID_NUMBER.length)}" was not a valid amount and was dropped.`;
  if (code.startsWith(INVALID_DATE)) return `Source value for "${code.slice(INVALID_DATE.length)}" was not a valid date and was dropped.`;
  return DPWH_WARNING_LABELS[code] ?? code;
}

/** Public map link centered on a contract, or null when the source has no coordinates. */
export function contractMapHref(c: { contract_id: string; latitude: number | null; longitude: number | null }): string | null {
  if (c.latitude === null || c.longitude === null) return null;
  return `/projects/map?focus=${encodeURIComponent(c.contract_id)}&lat=${c.latitude}&lng=${c.longitude}`;
}

/**
 * Color of each status, shared by markers, legends, badges, and lists.
 * 'proposed' is only ever set on budget proposals (NEP), never on contracts.
 */
export const STATUS_TONE: Record<DpwhStatus, StatusTone> = {
  completed: 'green',
  ongoing: 'blue',
  for_procurement: 'orange',
  not_yet_started: 'gray',
  terminated: 'red',
  unknown: 'lightGray',
  proposed: 'purple',
};

function byStatus(pick: (tone: (typeof STATUS_TONES)[StatusTone]) => string): Record<DpwhStatus, string> {
  return Object.fromEntries(DPWH_STATUSES.map((s) => [s, pick(STATUS_TONES[STATUS_TONE[s]])])) as Record<DpwhStatus, string>;
}

/** Marker and legend fill per status. */
export const STATUS_COLORS = byStatus((t) => t.fill);
/** Status text on white. */
export const STATUS_TEXT_COLORS = byStatus((t) => t.text);
/** Pill badge classes per status. */
export const STATUS_STYLES = byStatus((t) => t.badge);

function toneOf(value: string | null): StatusTone {
  return value && value in STATUS_TONE ? STATUS_TONE[value as DpwhStatus] : 'lightGray';
}
export const statusColor = (value: string | null) => STATUS_TONES[toneOf(value)].fill;
export const statusTextColor = (value: string | null) => STATUS_TONES[toneOf(value)].text;
export const statusBadgeClass = (value: string | null) => STATUS_TONES[toneOf(value)].badge;

/**
 * Statuses the contract map can show. The map reads DPWH contracts only;
 * NEP proposals have no coordinates in the source, so 'proposed' would only
 * ever be an empty legend entry and an always-empty filter.
 */
export const MAP_STATUSES = DPWH_STATUSES.filter((s) => s !== 'proposed');
