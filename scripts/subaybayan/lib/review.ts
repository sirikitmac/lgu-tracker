/**
 * "Needs review" flag for total project costs that are extreme for their kind
 * of project. Values are never changed: the flag only marks them, so the UI
 * can say "Amount not verified" and rank them after verified amounts.
 *
 * Rule: a total is flagged when it is at least REVIEW_MIN_COST (P100 million)
 * AND at least REVIEW_MEDIAN_FACTOR (100) times the median total of its
 * sector_subcategory (positive totals only; median as Postgres
 * percentile_cont(0.5), i.e. the mean of the two middle values for an even
 * count).
 *
 * Why this rule: subcategory medians sit between P1.2M and P5M, so the bar is
 * P120M-P500M depending on the kind of project. A decimal-entry slip (an
 * extra two or three digits) lands far above it, while a per-subcategory
 * percentile would flag a fixed share of every group, even groups with no
 * error. Both limits are needed: 100x alone would flag P20M items in
 * groups with tiny medians.
 *
 * The same rule backfilled public.subaybayan_projects.total_cost_review in
 * supabase/migrations/20261105000100_subaybayan_directory.sql; keep them equal.
 */

export const REVIEW_MIN_COST = 100_000_000;
export const REVIEW_MEDIAN_FACTOR = 100;

export interface ReviewInput {
  id: string;
  sector_subcategory: string | null;
  total_cost: number | null;
}

/** Median like Postgres percentile_cont(0.5): mean of the two middle values for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return Number.isInteger(mid) ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];
}

/** Median positive total per subcategory (key '' for rows without one). */
export function subcategoryMedians(rows: readonly ReviewInput[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (r.total_cost === null || !(r.total_cost > 0)) continue;
    const key = r.sector_subcategory ?? '';
    const list = groups.get(key) ?? [];
    list.push(r.total_cost);
    groups.set(key, list);
  }
  const out = new Map<string, number>();
  for (const [key, list] of groups) out.set(key, median(list)!);
  return out;
}

/** Threshold a total must reach to be flagged, or null when the subcategory has no positive totals. */
export function reviewThreshold(med: number | undefined): number | null {
  return med === undefined ? null : Math.max(REVIEW_MIN_COST, REVIEW_MEDIAN_FACTOR * med);
}

/** Ids of rows whose total project cost needs review. */
export function flagCostOutliers(rows: readonly ReviewInput[]): Set<string> {
  const medians = subcategoryMedians(rows);
  const flagged = new Set<string>();
  for (const r of rows) {
    if (r.total_cost === null) continue;
    const threshold = reviewThreshold(medians.get(r.sector_subcategory ?? ''));
    if (threshold !== null && r.total_cost >= threshold) flagged.add(r.id);
  }
  return flagged;
}
