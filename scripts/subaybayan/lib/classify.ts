/**
 * Deterministic categorization of SubayBAYAN projects into LGU Tracker's own
 * categories (NOT an official DILG classification).
 *
 * How it works, in order:
 *   1. The TITLE is tested against every rule, top to bottom; first match wins.
 *   2. Only if no rule matches the title are the COMPONENT DETAILS tested
 *      (components carry boilerplate such as "riprap" or "toilet" that would
 *      misclassify road projects if matched first).
 *   3. Then the fallbacks on project type and program.
 *
 * Every keyword is matched as a whole word (word boundary on both ends), with
 * an optional plural "s"/"es". Bare "rice" and "food" are deliberately absent:
 * they hit rice mills and food parks; only aid phrases are listed.
 */
import type { SubaybayanCategory, SubaybayanSubcategory } from '@/lib/subaybayan/categories';

export interface ClassifyRule {
  category: SubaybayanCategory;
  subcategory: SubaybayanSubcategory;
  /** Regex fragments (case-insensitive), one per keyword. */
  keywords: string[];
}

export const CLASSIFY_RULES: ClassifyRule[] = [
  { category: 'disaster', subcategory: 'Evacuation centers', keywords: ['evacuation'] },
  {
    category: 'disaster',
    subcategory: 'Disaster mitigation and preparedness',
    keywords: [
      'flood\\s*control', 'flood\\s*(?:wall|gate)', 'dike', 'sea\\s*wall', 'revetment', 'slope\\s*protection',
      'shore\\s*line\\s*protection', 'tide\\s*embankment', 'dredging', 'interceptor', 'rip[\\s-]?rap', 'gabion',
      'river\\s*(?:bank|control)', 'disaster', 'drrm\\w*', 'rescue', 'early\\s*warning', 'fire\\s*(?:station|truck|hydrant)',
      'retaining\\s*wall', 'check\\s*dam',
    ],
  },
  {
    category: 'health',
    subcategory: 'Health facilities',
    keywords: [
      'health\\s*(?:center|centre|station|unit|office)', 'bhs', 'rhu', 'mho', 'birthing', 'lying[\\s-]?in', 'hospital',
      'infirmary', 'clinic', 'super\\s*health\\s*center', 'medical', 'isolation\\s*facilit(?:y|ies)', 'dialysis',
      'laborator(?:y|ies)',
    ],
  },
  {
    category: 'health',
    subcategory: 'Social services',
    keywords: [
      'nutrition', 'feeding', 'day\\s*care', 'child\\s*development', 'cdc', 'senior\\s*citizen', 'elderly', 'pwd', 'women',
      'youth\\s*cent(?:er|re)', 'social\\s*welfare', 'drug\\s*rehab\\w*', 'crisis',
      'rice\\s*(?:distribution|assistance|subsidy)', 'distribution\\s*of\\s*(?:milled\\s*)?rice',
      'food\\s*(?:assistance|packs?|distribution|security|subsidy)', 'indigent', 'vulnerable', 'funeral', 'burial',
      'cash\\s*assistance', 'supplementation', 'micronutrient',
    ],
  },
  { category: 'health', subcategory: 'Health facilities', keywords: ['ambulance'] },
  {
    category: 'community',
    subcategory: 'Community development programs',
    keywords: ['scholarship', 'educational\\s*assistance', 'education\\s*promotion'],
  },
  {
    category: 'environment',
    subcategory: 'Waste and sanitation',
    keywords: [
      'materials?\\s*recovery', 'mrf', 'waste', 'garbage', 'landfill', 'septage', 'sewer', 'sewage', 'toilet',
      'comfort\\s*room', 'wash\\s*room', 'sanitation', 'lavator(?:y|ies)',
    ],
  },
  {
    category: 'environment',
    subcategory: 'Environmental protection',
    keywords: ['tree', 'reforestation', 'mangrove', 'nursery', 'watershed', 'green\\s*space', 'urban\\s*garden', 'eco[\\s-]?park', 'environmental'],
  },
  {
    category: 'infrastructure',
    subcategory: 'Water supply systems',
    keywords: [
      'water\\s*(?:system|supply|works|tank|reservoir|line|pipeline)', 'level\\s*(?:iii|ii|i|[123])', 'potable',
      'spring\\s*development', 'deep\\s*well', 'artesian', 'pump', 'rainwater', 'tap\\s*stand', 'pipeline',
    ],
  },
  { category: 'community', subcategory: 'Community development programs', keywords: ['housing', 'resettlement', 'relocation', 'houses'] },
  {
    category: 'community',
    subcategory: 'Livelihood initiatives',
    keywords: [
      'livelihood', 'training\\s*cent(?:er|re)', 'skills', 'cooperative', 'agri\\w*', 'fish\\s*port', 'post[\\s-]?harvest',
      'solar\\s*dryer', 'trading\\s*post', 'processing\\s*(?:center|centre|plant)', 'tourism', 'livestock', 'poultry',
      'coconut', 'distillery', 'abaca',
    ],
  },
  {
    category: 'infrastructure',
    subcategory: 'Other public infrastructure',
    keywords: [
      'drainage', 'canal', 'street\\s*lights?', 'solar\\s*(?:street\\s*)?lights?', 'lighting', 'illumination',
      'electrification', 'transformer', 'power\\s*house', 'irrigation', 'cis', 'wharf', 'port', 'pier', 'cctv', 'signage',
      'waiting\\s*shed', 'railings?', 'electrical\\s*distribution', 'heavy\\s*equipment', 'dump\\s*truck', 'bulldozer',
      'payloader', 'grader',
    ],
  },
  {
    category: 'infrastructure',
    subcategory: 'Roads and bridges',
    keywords: [
      'road', 'bridge', 'concreting', 'asphalt\\w*', 'pavement', 'pathway', 'foot\\s*(?:path|trail)', 'footbridge',
      'farm[\\s-]*to[\\s-]*market', 'fmr', 'street', 'alley', 'access', 'culvert', 'sidewalk', 'overlay', 'gravel\\w*',
      'causeway', 'circumferential', 'by[\\s-]?pass', 'pccp',
    ],
  },
  {
    category: 'infrastructure',
    subcategory: 'Markets and multipurpose buildings',
    keywords: ['market', 'multi[\\s-]?purpose', 'mph', 'mpb', 'mpc', 'public\\s*terminal', 'slaughter\\s*house', 'abattoir'],
  },
  {
    category: 'community',
    subcategory: 'Community facilities',
    keywords: [
      'covered\\s*court', 'basketball', 'court', 'gym\\w*', 'sports?', 'plaza', 'park', 'playground', 'stage',
      'community\\s*cent(?:er|re)', 'social\\s*hall', 'chapel', 'cemetery', 'niches?', 'tomb', 'librar(?:y|ies)',
      'grandstand', 'oval', 'quadrangle', 'football', 'swimming\\s*pool', 'amphitheat(?:er|re)', 'pergola',
      'historical\\s*marker', 'monument',
    ],
  },
  {
    category: 'infrastructure',
    subcategory: 'Public buildings',
    keywords: [
      'hall', 'building', 'school', 'classroom', 'office', 'police', 'outpost', 'tanod', 'cent(?:er|re)', 'facilit(?:y|ies)',
      'fenc(?:e|ing)', 'warehouse', 'terminal', 'motorpool', 'motor\\s*pool', 'barracks', 'firing\\s*range', 'avr', 'garage',
      'grounds',
    ],
  },
];

const compiled = CLASSIFY_RULES.map((rule) => ({
  rule,
  // Unicode-aware boundaries: \b in JS treats "ñ" as a non-word character.
  re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${rule.keywords.map((k) => `(?:${k})`).join('|')})(?:e?s)?(?![\\p{L}\\p{N}])`, 'iu'),
}));

export const TYPE_FALLBACKS: Record<string, { category: SubaybayanCategory; subcategory: SubaybayanSubcategory }> = {
  'local roads and bridges': { category: 'infrastructure', subcategory: 'Roads and bridges' },
  'water supply and sanitation': { category: 'infrastructure', subcategory: 'Water supply systems' },
  'evacuation center / multi-purpose hall': { category: 'infrastructure', subcategory: 'Markets and multipurpose buildings' },
};

export const PROGRAM_FALLBACKS: Record<string, { category: SubaybayanCategory; subcategory: SubaybayanSubcategory }> = {
  'green green green': { category: 'environment', subcategory: 'Environmental protection' },
  'support and assistance fund to participatory budgeting (safpb)': { category: 'community', subcategory: 'Community development programs' },
};

export interface Classification {
  category: SubaybayanCategory;
  subcategory: SubaybayanSubcategory;
  reason: string;
}

function matchRules(text: string): { rule: ClassifyRule; keyword: string } | null {
  for (const { rule, re } of compiled) {
    const m = re.exec(text);
    if (m) return { rule, keyword: m[0].toLowerCase().replace(/\s+/g, ' ') };
  }
  return null;
}

const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function classifyProject(input: {
  title: string | null;
  componentDetails?: string | null;
  projectType?: string | null;
  program?: string | null;
}): Classification {
  const title = squash(input.title);
  const byTitle = matchRules(title);
  if (byTitle) return { category: byTitle.rule.category, subcategory: byTitle.rule.subcategory, reason: `title keyword "${byTitle.keyword}"` };

  const components = squash(input.componentDetails);
  const byComponents = components ? matchRules(components) : null;
  if (byComponents) {
    return { category: byComponents.rule.category, subcategory: byComponents.rule.subcategory, reason: `component keyword "${byComponents.keyword}"` };
  }

  const type = squash(input.projectType);
  const byType = TYPE_FALLBACKS[type.toLowerCase()];
  if (byType) return { ...byType, reason: `project type "${type}"` };

  const program = squash(input.program);
  const byProgram = PROGRAM_FALLBACKS[program.toLowerCase()];
  if (byProgram) return { ...byProgram, reason: `program "${program}"` };

  if (/please\s+insert/i.test(title)) return { category: 'uncategorized', subcategory: 'Uncategorized', reason: 'placeholder title ("please insert")' };
  return { category: 'uncategorized', subcategory: 'Uncategorized', reason: 'no keyword matched' };
}
