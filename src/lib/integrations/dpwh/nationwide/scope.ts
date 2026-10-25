/**
 * Which DPWH contracts the sync stores, and how much database it may use.
 *
 * The full snapshot (248,421 contracts) needs about 490 MB, which exceeds a
 * Supabase Free plan database (500 MB, read-only when exceeded). By default
 * the sync stores contracts whose project location is in the Visayas or
 * Mindanao (Iligan City is in Region X), about 108,500 contracts or ~230 MB.
 * Contracts outside the scope are counted per run, never stored, and never
 * deleted if an earlier, wider run stored them.
 *
 *   DPWH_SYNC_REGIONS=all                      nationwide (needs ~500 MB free)
 *   DPWH_SYNC_REGIONS="Region X,Region IX"     these project regions only
 *   SYNC_STORAGE_BUDGET_MB=400                 stop before the database reaches this size
 */

/** Project region names as the normalizer produces them (component regions). */
export const MINDANAO_REGIONS = [
  'Region IX',
  'Region X',
  'Region XI',
  'Region XII',
  'Region XIII',
  'Bangsamoro Autonomous Region in Muslim Mindanao',
] as const;

export const VISAYAS_REGIONS = ['Region VI', 'Region VII', 'Region VIII', 'Negros Island Region'] as const;

export const DEFAULT_SCOPE_REGIONS: readonly string[] = [...VISAYAS_REGIONS, ...MINDANAO_REGIONS];

/** Default guard: leaves ~100 MB of a 500 MB Free plan database for everything else. */
export const DEFAULT_STORAGE_BUDGET_MB = 400;

/** Null means nationwide. Throws on an empty or malformed list. */
export function scopeFromEnv(value: string | undefined): readonly string[] | null {
  const raw = value?.trim();
  if (!raw) return DEFAULT_SCOPE_REGIONS;
  if (raw.toLowerCase() === 'all') return null;
  const regions = raw.split(',').map((r) => r.trim()).filter(Boolean);
  if (regions.length === 0 || regions.length > 30 || regions.some((r) => r.length > 100)) {
    throw new Error('DPWH_SYNC_REGIONS must be "all" or a comma-separated list of up to 30 region names.');
  }
  return regions;
}

/** Bytes; "off" disables the guard. */
export function storageBudgetFromEnv(value: string | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return DEFAULT_STORAGE_BUDGET_MB * 1e6;
  if (raw.toLowerCase() === 'off') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 50) throw new Error('SYNC_STORAGE_BUDGET_MB must be a number of megabytes (at least 50) or "off".');
  return n * 1e6;
}
