import type { DpwhCategory, DpwhCategoryMethod } from '@/types/dpwh';

/**
 * Deterministic project categorization. The first rule that matches wins:
 *
 *   1. source_category        DPWH `category`, when it is a work type
 *   2. infra_type             DPWH `infraType` (details file)
 *   3. type_of_work           first component `typeOfWork`
 *   4. description_keywords   keywords in the contract description
 *   5. none                   -> uncategorized
 *
 * Source categories are sometimes funding labels ("GAA 2025 SSP"); those
 * are skipped, never mapped. Every result says which method and which value
 * decided it, so the category can be audited.
 */

export interface CategoryResult {
  category: DpwhCategory;
  method: DpwhCategoryMethod;
  reason: string;
}

/** Funding/appropriation labels that DPWH sometimes puts in `category`. */
const FUNDING_LABEL = /^(GAA\b|UNPROGRAMMED|TRUST FUNDS?\b|SAA\b|NEP\b|RLIP\b|BEFF\b|CONTINUING APPROPRIATIONS?)/;

/**
 * DPWH work-type values (category / infraType) lead with the work type, e.g.
 * "Roads: Construction - Slope Protection (... Revetment ...)", so the rules
 * are anchored to the start; later words describe the method, not the type.
 */
const WORK_TYPE_RULES: [RegExp, DpwhCategory][] = [
  [/^(FLOOD|DRAINAGE)/, 'flood_control_drainage'],
  [/^BRIDGES?\b/, 'bridges'],
  [/^(ROADS?\b|HIGHWAYS?\b)/, 'roads_highways'],
  [/^(WATER|SEPTAGE|SEWERAGE)/, 'water_infrastructure'],
  [/^(BUILDINGS?\b|MULTI[- ]?PURPOSE|SCHOOL|CLASSROOM)/, 'buildings_facilities'],
];

/**
 * Keyword rules for free-text descriptions, most specific first. Flood
 * control precedes roads because "DRAINAGE ALONG NATIONAL ROADS" is drainage
 * work; bridges precede roads because bridges are usually "along" a road.
 */
const KEYWORD_RULES: [RegExp, DpwhCategory][] = [
  [/\b(FLOOD|DRAINAGE|DIKE|REVETMENT|SEAWALL|SEA WALL|RIVER CONTROL|SLOPE PROTECTION|RIPRAP|CANAL LINING)\b/, 'flood_control_drainage'],
  [/\b(BRIDGES?|FLYOVER|VIADUCT|BOX CULVERT)\b/, 'bridges'],
  [/\b(WATER SUPPLY|WATER SYSTEM|RAIN ?WATER|SEPTAGE|SEWERAGE|POTABLE|CISTERN|IRRIGATION|WATER TANK)\b/, 'water_infrastructure'],
  [/\b(BUILDINGS?|CLASSROOMS?|SCHOOL|HALL|GYMNASIUM|HOSPITAL|HEALTH CENTER|BARRACKS|COVERED COURT|MULTI-?PURPOSE|EVACUATION CENTER|PUBLIC MARKET|LIBRARY|DORMITORY)\b/, 'buildings_facilities'],
  [/\b(ROADS?|RD|HIGHWAY|PAVEMENT|PAVING|ASPHALT|OVERLAY|CONCRETING|FARM-?TO-?MARKET|FMR|BY-?PASS|DIVERSION|ROAD WIDENING|ACCESS ROAD|MISSING LINKS?)\b/, 'roads_highways'],
  [/\b(PORT|WHARF|PIER|AIRPORT|STREET ?LIGHTS?|LIGHTING|SIDEWALK|PARK|TERMINAL)\b/, 'other_infrastructure'],
];

function normalize(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  const value = text.trim().toUpperCase();
  return value === '' ? null : value;
}

/** The first comma-separated work type of a DPWH category value. */
function matchWorkType(value: string): DpwhCategory | null {
  const first = value.split(',')[0].trim();
  for (const [pattern, category] of WORK_TYPE_RULES) {
    if (pattern.test(first)) return category;
  }
  return null;
}

export function isFundingLabel(category: string | null | undefined): boolean {
  const value = normalize(category);
  return value !== null && FUNDING_LABEL.test(value);
}

export function categorize(input: {
  sourceCategory: string | null;
  infraType: string | null;
  typesOfWork: (string | null)[];
  description: string | null;
}): CategoryResult {
  const source = normalize(input.sourceCategory);
  if (source && !FUNDING_LABEL.test(source)) {
    const category = matchWorkType(source);
    if (category) {
      return { category, method: 'source_category', reason: `DPWH category "${input.sourceCategory!.trim()}"` };
    }
  }

  const infraType = normalize(input.infraType);
  if (infraType) {
    const category = matchWorkType(infraType);
    if (category) return { category, method: 'infra_type', reason: `DPWH infra type "${input.infraType!.trim()}"` };
  }

  for (const raw of input.typesOfWork) {
    const typeOfWork = normalize(raw);
    if (!typeOfWork) continue;
    for (const [pattern, category] of KEYWORD_RULES) {
      const match = typeOfWork.match(pattern);
      if (match) return { category, method: 'type_of_work', reason: `component type of work "${raw!.trim()}" (keyword "${match[1]}")` };
    }
  }

  const description = normalize(input.description);
  if (description) {
    for (const [pattern, category] of KEYWORD_RULES) {
      const match = description.match(pattern);
      if (match) return { category, method: 'description_keywords', reason: `description keyword "${match[1]}"` };
    }
  }

  // A recognizable non-funding source category that matched no rule is still
  // infrastructure, just not one of the named groups.
  if (source && !FUNDING_LABEL.test(source)) {
    return { category: 'other_infrastructure', method: 'source_category', reason: `DPWH category "${input.sourceCategory!.trim()}" (no specific group)` };
  }
  return { category: 'uncategorized', method: 'none', reason: 'No usable category, infra type, type of work, or description keyword.' };
}
