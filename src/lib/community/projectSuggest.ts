/**
 * Project suggestions for the "About a project?" field of a new discussion.
 * The search itself is the project directory's (/api/dpwh/contracts); this
 * module decides when to ask, what to ask for, and how to order the answer.
 */
import type { ReportTarget } from '@/types/report';

/** Fewer characters than this never sends a request. */
export const SUGGEST_MIN_CHARS = 2;
/** How many suggestions are shown. */
export const SUGGEST_LIMIT = 8;
/** How many rows are fetched to rank from (the directory sorts by amount, not by match). */
export const SUGGEST_FETCH = 24;
export const SUGGEST_DEBOUNCE_MS = 250;

export interface SuggestFilters {
  /** '' for every agency. */
  agency: '' | 'DPWH' | 'DILG';
  /** A directory status id, or '' for every status. */
  status: string;
}

/** The directory row fields a suggestion needs. */
export interface SuggestRow {
  source: string;
  record_id: string;
  title: string | null;
  contract_name?: string | null;
  project_code?: string | null;
  region?: string | null;
  province?: string | null;
  municipality?: string | null;
  barangay?: string | null;
}

export function shouldSearch(q: string): boolean {
  return q.trim().length >= SUGGEST_MIN_CHARS;
}

/** Query string for the directory endpoint, or null when the text is too short. */
export function suggestParams(q: string, filters: SuggestFilters): URLSearchParams | null {
  const text = q.trim();
  if (text.length < SUGGEST_MIN_CHARS) return null;
  const p = new URLSearchParams();
  p.set('q', text.slice(0, 200));
  if (filters.agency) p.set('agency', filters.agency);
  if (filters.status) p.set('status', filters.status);
  p.set('page', '1');
  p.set('pageSize', String(SUGGEST_FETCH));
  return p;
}

/** What a suggestion shows as its code: the same rule as the code lookup. */
export const suggestionCode = (row: SuggestRow) => row.project_code || row.record_id;

/** Exactly what the code lookup returns, so the linked project is stored the same way. */
export function toReportTarget(row: SuggestRow): ReportTarget {
  return { source: row.source, recordId: row.record_id, title: row.title ?? row.record_id, code: suggestionCode(row) };
}

/** Place line for a suggestion, smallest place first. */
export function suggestionPlace(row: SuggestRow): string {
  return [row.municipality, row.province, row.region].filter(Boolean).join(', ');
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
const words = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Lower is better. Prefix matches come first: the code, then the title, then
 * the place. Then a word inside the title or place starting with the text,
 * then the text anywhere. Rows that do not match here (the directory also
 * searches other fields) are kept, last.
 */
export function matchScore(row: SuggestRow, q: string): number {
  const needle = norm(q);
  if (!needle) return 9;
  const code = norm(suggestionCode(row));
  const titles = [norm(row.title), norm(row.contract_name)].filter(Boolean);
  const places = [row.municipality, row.province, row.region, row.barangay].map(norm).filter(Boolean);

  if (code === needle) return 0;
  if (code.startsWith(needle)) return 1;
  if (titles.some((t) => t.startsWith(needle))) return 2;
  if (places.some((p) => p.startsWith(needle))) return 3;
  const first = words(needle)[0] ?? needle;
  const allWords = words(needle);
  const wordPrefix = (s: string) => {
    const ws = words(s);
    return allWords.every((w) => ws.some((x) => x.startsWith(w)));
  };
  if (titles.some(wordPrefix)) return 4;
  if (places.some(wordPrefix)) return 5;
  if (code.includes(needle) || titles.some((t) => t.includes(needle)) || places.some((p) => p.includes(needle))) return 6;
  if ([...titles, ...places].some((s) => words(s).some((x) => x.startsWith(first)))) return 7;
  return 8;
}

/** Best matches first (stable for ties), at most `limit`, one per record. */
export function rankSuggestions<T extends SuggestRow>(rows: readonly T[], q: string, limit = SUGGEST_LIMIT): T[] {
  const seen = new Set<string>();
  return rows
    .map((row, index) => ({ row, index, score: matchScore(row, q) }))
    .filter(({ row }) => {
      const key = `${row.source}|${row.record_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(({ row }) => row);
}
