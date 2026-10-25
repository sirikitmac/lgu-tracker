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
