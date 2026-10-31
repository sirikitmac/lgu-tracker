/**
 * SubayBAYAN project codes ("LIME-25-13-02-00-000-41"): normalizing pasted
 * input, telling a code from a title search, exact lookup with close-match
 * suggestions, and which map filters would hide a looked-up project.
 * Pure functions, shared by the lookup route, the map and the directory.
 *
 * Code shape in the Oct 31, 2026 snapshot: PREFIX-YY(YY)-RR-PP-MM-BBB-N[A-E],
 * prefixes LIME, RLIP, FALGU, SBDP, GEF, SAFPB, GGG. Codes are stored upper
 * case without spaces. 15 codes are shared by two rows each; those rows have
 * synthetic ids (e.g. "rlip-b01-r122"), every other row's id is its code.
 */
import type { SubaybayanDataset } from './categories';
import { CATEGORY_DETAIL_FILTERS, DETAIL_FIELD, DETAIL_LABELS, EMPTY_FILTERS, matches, type DetailKey, type IndexRow, type SubaybayanFilters } from './query';

/** Longest input treated as a code (the longest stored code is 26 characters). */
export const MAX_CODE_LENGTH = 40;

// Hyphen look-alikes that arrive when codes are pasted from documents and chat apps:
// hyphen, non-breaking hyphen, figure dash, en dash, em dash, horizontal bar, minus, small/full-width hyphen-minus.
const DASHES = /[‐‑‒–—―−﹣－]/g;

/** Trim, upper-case, collapse spaces, dashes → "-" (and no spaces around them). */
export function normalizeCode(input: string): string {
  return input
    .normalize('NFKC')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*-\s*/g, '-')
    .toUpperCase();
}

/**
 * True when normalized text has the shape of a project code: a 2–6 letter
 * prefix, then at least four more dash-separated parts made of digits (a
 * trailing letter or two allowed), no spaces. Loose on purpose so that a
 * mistyped code still counts as a code (and gets suggestions) instead of
 * turning into a title search. Titles never look like this.
 */
export function looksLikeCode(normalized: string): boolean {
  return normalized.length <= MAX_CODE_LENGTH && /^[A-Z]{2,6}(-\d{1,6}[A-Z]{0,2}){4,8}$/.test(normalized);
}

/** The text as a code, or null when it is not one. */
export function asCode(input: string): string | null {
  const code = normalizeCode(input);
  return looksLikeCode(code) ? code : null;
}

export const codePrefix = (code: string) => code.slice(0, code.indexOf('-'));

/**
 * Full-text query (Postgres 'simple' config) for code-shaped text such as
 * "LIME-25-13-02-00-000-4", "LIME-25-13" or "COVID-19", else null.
 *
 * Postgres's parser reads "LIME-25-13" as the word "lime" followed by the
 * signed integers "-25" and "-13", so the prefix query built from words
 * ("lime:* & 25:* & 13:*") never matches a code. This builds the same lexemes
 * as a phrase, in order, with a prefix match on the last part only:
 *   "LIME-25-13-02-00-000-4" → lime <-> -25 <-> -13 <-> -02 <-> -00 <-> -000 <-> -4:*
 * (finds -4, -41, -42 …), and a trailing letter ("…-4A") is its own word.
 * Only letters, digits and "-" reach the query, so nothing can inject operators.
 */
export function codeTsQuery(text: string): string | null {
  const s = normalizeCode(text);
  if (s.length > MAX_CODE_LENGTH || !/^[A-Z]{2,12}(-\d{1,6}[A-Z]{0,2})+$/.test(s)) return null;
  const parts = s.split('-');
  const lexemes = [parts[0].toLowerCase()];
  for (const part of parts.slice(1)) {
    const [, digits, letters] = /^(\d+)([A-Z]*)$/.exec(part)!;
    lexemes.push(`-${digits}`);
    if (letters) lexemes.push(letters.toLowerCase());
  }
  return lexemes.map((l, i) => (i === lexemes.length - 1 ? `${l}:*` : l)).join(' <-> ');
}

/** Levenshtein distance, or `max + 1` as soon as it is certainly above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** A row the lookup returns: everything the map needs to reveal, fly to and list it. */
export type CodeMatch = Pick<
  IndexRow,
  | 'id' | 'project_code' | 'title' | 'region' | 'province' | 'citymun' | 'funding_year' | 'latitude' | 'longitude' | 'location_precision'
  | 'source_dataset' | 'sector_category' | 'sector_subcategory' | 'status' | 'project_type' | 'program' | 'sector' | 'mode_of_implementation'
>;

export interface CodeSuggestion {
  code: string;
  title: string;
  /** Edit distance from the code that was asked for (1 or 2). */
  distance: number;
}

export type CodeLookup =
  | { code: string; status: 'found'; matches: CodeMatch[] }
  | {
      code: string;
      status: 'not_found';
      /** Codes with the same prefix within edit distance 2, closest first. */
      suggestions: CodeSuggestion[];
      /** The dataset that uses this prefix (for the portal link), or null for an unknown prefix. */
      dataset: SubaybayanDataset | null;
    };

export const MAX_SUGGESTIONS = 5;
export const SUGGESTION_DISTANCE = 2;

export function toCodeMatch(r: IndexRow): CodeMatch {
  return {
    id: r.id, project_code: r.project_code, title: r.title, region: r.region, province: r.province, citymun: r.citymun,
    funding_year: r.funding_year, latitude: r.latitude, longitude: r.longitude, location_precision: r.location_precision,
    source_dataset: r.source_dataset, sector_category: r.sector_category, sector_subcategory: r.sector_subcategory, status: r.status,
    project_type: r.project_type, program: r.program, sector: r.sector, mode_of_implementation: r.mode_of_implementation,
  };
}

/** Exact lookup of a normalized code; on a miss, close codes with the same prefix. */
export function lookupCode(index: readonly IndexRow[], code: string): CodeLookup {
  const found = index.filter((r) => r.project_code === code);
  if (found.length) {
    // File order, so a shared code always lists its rows the same way.
    return { code, status: 'found', matches: found.map(toCodeMatch).sort((a, b) => a.id.localeCompare(b.id)) };
  }
  const prefix = codePrefix(code);
  const best = new Map<string, CodeSuggestion>();
  const datasets = new Map<SubaybayanDataset, number>();
  for (const r of index) {
    if (!r.project_code || codePrefix(r.project_code) !== prefix) continue;
    datasets.set(r.source_dataset, (datasets.get(r.source_dataset) ?? 0) + 1);
    if (best.has(r.project_code)) continue;
    const d = editDistance(code, r.project_code, SUGGESTION_DISTANCE);
    if (d <= SUGGESTION_DISTANCE) best.set(r.project_code, { code: r.project_code, title: r.title, distance: d });
  }
  const suggestions = [...best.values()].sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code)).slice(0, MAX_SUGGESTIONS);
  const dataset = [...datasets].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { code, status: 'not_found', suggestions, dataset };
}

// ---------------------------------------------------------------------------
// Revealing a looked-up project on the map

type ClearableKey = Exclude<keyof SubaybayanFilters, 'q'>;

const FILTER_LABELS: Record<Exclude<ClearableKey, DetailKey>, string> = {
  category: 'category',
  source: 'source',
  region: 'region',
  province: 'province',
  city: 'city / municipality',
  year: 'funding year',
  status: 'status',
  approx: 'approximate-locations',
};

const isApproximate = (r: CodeMatch) => r.location_precision === 'municipality_centroid' || r.location_precision === 'province_centroid';

/**
 * Filters with the search set to `code`, minus every filter that would hide
 * `row` (cascading: clearing the region clears province and city, clearing
 * the category clears its own filters). `cleared` names them for the toast.
 */
export function revealFilters(row: CodeMatch, filters: SubaybayanFilters, code: string): { filters: SubaybayanFilters; cleared: string[] } {
  const next: SubaybayanFilters = { ...filters, q: code };
  const cleared: string[] = [];
  const asRow = row as IndexRow;
  const only = (key: keyof SubaybayanFilters): SubaybayanFilters => ({ ...EMPTY_FILTERS, [key]: next[key] });
  const clear = (key: ClearableKey) => {
    const empty: Partial<SubaybayanFilters> = key === 'year' ? { year: null } : key === 'approx' ? { approx: true } : { [key]: '' };
    Object.assign(next, empty);
  };

  if (next.category && !matches(asRow, only('category'))) {
    cleared.push(FILTER_LABELS.category);
    Object.assign(next, { category: '', sub: '', type: '', mode: '', program: '', sector: '' });
  }
  for (const key of next.category ? CATEGORY_DETAIL_FILTERS[next.category] : []) {
    if (next[key] && asRow[DETAIL_FIELD[key]] !== next[key]) {
      cleared.push(DETAIL_LABELS[key].toLowerCase());
      clear(key);
    }
  }
  if (next.region && !matches(asRow, only('region'))) {
    cleared.push(FILTER_LABELS.region);
    Object.assign(next, { region: '', province: '', city: '' });
  } else if (next.province && !matches(asRow, only('province'))) {
    cleared.push(FILTER_LABELS.province);
    Object.assign(next, { province: '', city: '' });
  } else if (next.city && !matches(asRow, only('city'))) {
    cleared.push(FILTER_LABELS.city);
    clear('city');
  }
  for (const key of ['source', 'year', 'status'] as const) {
    if ((key === 'year' ? next.year !== null : next[key]) && !matches(asRow, only(key))) {
      cleared.push(FILTER_LABELS[key]);
      clear(key);
    }
  }
  if (!next.approx && isApproximate(row)) {
    cleared.push(FILTER_LABELS.approx);
    clear('approx');
  }
  // Defensive: whatever is left must show the row.
  if (!matches(asRow, { ...next, q: '' })) return { filters: { ...EMPTY_FILTERS, q: code }, cleared: [...cleared, 'other filters'] };
  return { filters: next, cleared };
}

/** "category and funding year" / "category, region and status". */
export function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Shareable map link for one project: by code when the code is unique to it, else by id. */
export function projectMapLink(p: { id: string; project_code: string | null }): string {
  return p.project_code && p.project_code === p.id
    ? `/projects/map?layer=subaybayan&code=${encodeURIComponent(p.project_code)}`
    : `/projects/map?layer=subaybayan&focus=${encodeURIComponent(p.id)}`;
}
