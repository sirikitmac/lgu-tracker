import {
  DPWH_CATEGORY_LABELS,
  DPWH_STATUS_LABELS,
  DPWH_WARNING_LABELS,
  INVALID_DATE,
  INVALID_NUMBER,
  type DpwhCategory,
  type DpwhStatus,
} from '@/types/dpwh';

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

/** Marker colors per status (also used for the map legend). */
export const STATUS_COLORS: Record<string, string> = {
  completed: '#16A34A',
  ongoing: '#2563EB',
  for_procurement: '#F59E0B',
  not_yet_started: '#64748B',
  terminated: '#DC2626',
  unknown: '#94A3B8',
};

export const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ongoing: 'bg-blue-50 text-blue-800 border-blue-200',
  for_procurement: 'bg-amber-50 text-amber-800 border-amber-200',
  not_yet_started: 'bg-slate-50 text-slate-700 border-slate-200',
  terminated: 'bg-red-50 text-red-800 border-red-200',
  unknown: 'bg-slate-50 text-slate-600 border-slate-200',
};
