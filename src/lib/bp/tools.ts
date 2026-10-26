import { DPWH_CATEGORIES, DPWH_STATUSES } from '@/types/dpwh';
import { DPWH_SORTS } from '@/lib/integrations/dpwh/nationwide/query';
import { PROJECT_SOURCE_IDS } from '@/lib/integrations/bettergov/sources';
import { BP_MAX_RESULTS, getDirectoryOverview, searchProjects, type BpRecord, type BpSupabase, type DirectoryOverview } from './data';

/**
 * The only operations BP can ask for. Both are read-only; the dispatcher
 * ignores any other name. Region and province names are offered as enums
 * (from the cached summary) so the model picks values that actually exist.
 */

export const TOOL_OVERVIEW = 'get_directory_overview';
export const TOOL_SEARCH = 'search_projects';

export function toolDeclarations(overview: DirectoryOverview | null) {
  const regions = overview?.dpwh_contracts?.by_region.map((r) => r.region).filter((r) => r !== 'Not reported') ?? [];
  const provinces = overview?.dpwh_contracts?.provinces.map((p) => p.province) ?? [];
  const enumOrString = (values: string[], description: string) =>
    values.length ? { type: 'string', enum: values, description } : { type: 'string', description };

  return [
    {
      name: TOOL_OVERVIEW,
      description:
        'Exact, precomputed statistics of the DPWH contracts in the directory: total contracts, sum of reported contract amounts, ' +
        'and contract counts by region, category, status, infrastructure year, and province; plus record counts of the other sources ' +
        '(DPWH FY 2027 NEP budget proposals). Use for any count, total, or ranking question that has no search text or contractor filter.',
      parametersJsonSchema: { type: 'object', properties: {} },
    },
    {
      name: TOOL_SEARCH,
      description:
        `Search the project directory (DPWH contracts and NEP 2027 proposals). Returns the exact number of matches and up to ${BP_MAX_RESULTS} records. ` +
        'Without `source`, total_matches counts contracts AND budget proposals together; set source to "dpwh_contracts" when the user asks about contracts. ' +
        'Cities and municipalities are NOT a filter (the DPWH source does not report them): to find projects in a city, town, or barangay, ' +
        'put its distinctive name in `query` (for example "iligan"), which matches words in project titles, IDs, contractors, and implementing offices.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words that must appear (prefix match) in the title, ID, contractor, or implementing office. Keep it to 1-3 distinctive words.' },
          region: enumOrString(regions, 'Project-location region, exact name.'),
          province: enumOrString(provinces, 'Project-location province, exact name.'),
          category: { type: 'string', enum: [...DPWH_CATEGORIES], description: 'Work category assigned by LGU Tracker.' },
          status: { type: 'string', enum: [...DPWH_STATUSES], description: '"proposed" is used only by NEP budget proposals.' },
          source: { type: 'string', enum: [...PROJECT_SOURCE_IDS], description: 'dpwh_contracts = awarded DPWH contracts; dpwh_nep_2027 = FY 2027 NEP budget proposals.' },
          contractor: { type: 'string', description: 'Contractor name prefix (DPWH contracts only).' },
          sort: { type: 'string', enum: Object.keys(DPWH_SORTS), description: 'Default contract_amount-desc.' },
          limit: { type: 'integer', minimum: 1, maximum: BP_MAX_RESULTS, description: `Records to return (default 5, max ${BP_MAX_RESULTS}).` },
        },
      },
    },
  ];
}

export interface ToolRun {
  /** JSON-serializable payload sent back to the model. */
  response: Record<string, unknown>;
  records: BpRecord[];
  failed: boolean;
}

export async function runTool(supabase: BpSupabase, name: string, args: Record<string, unknown> | undefined): Promise<ToolRun> {
  if (name === TOOL_OVERVIEW) {
    const res = await getDirectoryOverview(supabase);
    return res.ok
      ? { response: { result: res.data }, records: [], failed: false }
      : { response: { error: 'The database could not be reached.' }, records: [], failed: true };
  }
  if (name === TOOL_SEARCH) {
    const res = await searchProjects(supabase, args ?? {});
    if (res.ok) return { response: { result: res.data }, records: res.data.records, failed: false };
    // Invalid arguments are the model's to fix; database errors are reported as unavailable.
    return res.error.startsWith('invalid_arguments')
      ? { response: { error: res.error }, records: [], failed: false }
      : { response: { error: 'The database could not be reached.' }, records: [], failed: true };
  }
  return { response: { error: `Unknown tool ${name}.` }, records: [], failed: false };
}
