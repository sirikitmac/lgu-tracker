import type { DpwhCategory, DpwhStatus } from '@/types/dpwh';
import type { BpRecord, DirectoryOverview, SearchArgs, SearchResult } from './data';

/**
 * Preview mode: used in development when GEMINI_API_KEY is not set, so the
 * chat UI and the real database queries can be tested without AI. A fixed
 * keyword planner picks one of the same read-only queries Gemini would use,
 * and the answer is a template filled with the query result. Every preview
 * answer is labelled as not AI-generated.
 */

export type PreviewPlan = { tool: 'overview'; focus: 'count' | 'amount' | 'region' | 'category' | 'status' | 'general' } | { tool: 'search'; args: SearchArgs };

const CATEGORY_WORDS: [RegExp, DpwhCategory][] = [
  [/\b(roads?|highways?|bypass)\b/i, 'roads_highways'],
  [/\bbridges?\b/i, 'bridges'],
  [/\b(flood|drainage)\b/i, 'flood_control_drainage'],
  [/\b(buildings?|schools?|facilit(y|ies)|classrooms?)\b/i, 'buildings_facilities'],
  [/\bwater\b/i, 'water_infrastructure'],
];
const STATUS_WORDS: [RegExp, DpwhStatus][] = [
  [/\bon-?going\b/i, 'ongoing'],
  [/\bcompleted?\b/i, 'completed'],
  [/\bterminated\b/i, 'terminated'],
  [/\bnot yet started\b/i, 'not_yet_started'],
  [/\bfor procurement\b/i, 'for_procurement'],
  [/\b(proposed|proposals?|nep)\b/i, 'proposed'],
];
const STOP_WORDS = new Set(
  (
    'a about an and any are available city contract contracts da de del directory find for from give how in infrastructure is ' +
    'list listed located many marked me municipality of on please project projects province record records show tell that the ' +
    'there these this to what where which with'
  ).split(' ')
);

export function planPreview(question: string, overview: DirectoryOverview | null): PreviewPlan {
  const q = question.toLowerCase();
  const category = CATEGORY_WORDS.find(([re]) => re.test(q))?.[1];
  const status = STATUS_WORDS.find(([re]) => re.test(q))?.[1];
  const provinces = overview?.dpwh_contracts?.provinces.map((p) => p.province) ?? [];
  const regions = overview?.dpwh_contracts?.by_region.map((r) => r.region) ?? [];
  const province = provinces.find((p) => q.includes(p.toLowerCase()));
  const region = regions.find((r) => new RegExp(`\\b${r.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q));
  // "in Iligan City", "near Dipolog": a place name that is not a province or region becomes search text.
  const place = !province && !region ? /\b(?:in|at|near|around)\s+([a-z][a-z .'-]{2,40})/i.exec(question)?.[1] : undefined;
  const placeWords = place
    ?.split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .join(' ');

  const aggregate = /\b(how many|number of|count|total|sum|most|highest|top|rank|largest share|breakdown)\b/i.test(q);
  if (aggregate && !placeWords && !province) {
    if (/\b(amount|peso|cost|budget|worth|value)\b/i.test(q)) return { tool: 'overview', focus: 'amount' };
    if (/\bregions?\b/i.test(q)) return { tool: 'overview', focus: 'region' };
    if (category || /\bcategor/i.test(q)) return { tool: 'overview', focus: 'category' };
    if (status || /\bstatus/i.test(q)) return { tool: 'overview', focus: 'status' };
    return { tool: 'overview', focus: 'count' };
  }

  const args: SearchArgs = { limit: 5 };
  if (category) args.category = category;
  if (status) args.status = status;
  if (province) args.province = province;
  else if (region) args.region = region;
  if (placeWords) args.query = placeWords;
  if (!category && !status && !province && !region && !placeWords) {
    const words = (q.match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !STOP_WORDS.has(w) && w.length > 2).slice(0, 3);
    if (!words.length) return { tool: 'overview', focus: 'general' };
    args.query = words.join(' ');
  }
  return { tool: 'search', args };
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const count = (n: number) => n.toLocaleString('en-PH');

export function previewOverviewAnswer(overview: DirectoryOverview, focus: Extract<PreviewPlan, { tool: 'overview' }>['focus']): string {
  const c = overview.dpwh_contracts;
  if (!c) return 'No DPWH contract statistics are available yet; an administrator needs to run the initial sync.';
  const others = overview.other_sources
    .map((s) => `- ${s.label}: ${s.records === null ? 'count unavailable' : `${count(s.records)} records`} (budget proposals, not contracts)`)
    .join('\n');
  const top = <T,>(rows: T[], line: (r: T, i: number) => string) => rows.slice(0, 10).map(line).join('\n');

  switch (focus) {
    case 'amount':
      return `The sum of **reported contract amounts** is **${peso(c.reported_contract_amount_sum_php)}** across ${count(c.contracts_with_reported_amount)} of ${count(c.total_contracts)} DPWH contracts that report an amount.\n\nThese are award amounts as published, not disbursements or audited spending.`;
    case 'region':
      return `DPWH contracts by project-location region:\n${top(c.by_region, (r, i) => `${i + 1}. ${r.region}: ${count(r.contracts)}`)}\n\nCoverage is limited to Visayas and Mindanao project locations.`;
    case 'category':
      return `DPWH contracts by category:\n${top(c.by_category, (r) => `- ${r.category}: ${count(r.contracts)}`)}`;
    case 'status':
      return `DPWH contracts by reported status:\n${top(c.by_status, (r) => `- ${r.status}: ${count(r.contracts)}`)}`;
    default:
      return `The directory lists **${count(c.total_contracts)} DPWH contracts** (Visayas and Mindanao project locations).\n\nIt also lists:\n${others}`;
  }
}

export function previewSearchAnswer(result: SearchResult): string {
  const filters = Object.entries(result.filters).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';
  if (result.records.length === 0) return `No records match (filters: ${filters}).`;
  const total = result.total_matches === null ? 'An exact count is unavailable;' : `**${count(result.total_matches)}** records match;`;
  const lines = result.records.map((r: BpRecord) =>
    `- **${r.title}** (${r.record_id}): ${[r.province ?? r.region, r.status, r.amount_php === null ? null : `${r.amount_label.toLowerCase()} ${peso(r.amount_php)}`].filter(Boolean).join(' · ')}`
  );
  const notes = [
    !result.filters.source && 'The count includes both DPWH contracts and DPWH NEP 2027 budget proposals.',
    result.filters.query && 'Text search matches words in titles, IDs, contractors, and offices, so some results may only mention the place.',
  ].filter(Boolean);
  const searchNote = notes.length ? `\n\n${notes.join(' ')}` : '';
  return `${total} showing the top ${result.records.length} by ${result.sorted_by.replace('-', ' ').replace('_', ' ')} (filters: ${filters}).\n\n${lines.join('\n')}${searchNote}`;
}
