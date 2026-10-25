/**
 * BetterGov.ph datasets this app imports, for labels and attribution.
 * Client-safe (no I/O). `id` is the `source` column of public.project_directory.
 */

export const PROJECT_SOURCES = {
  dpwh_contracts: {
    label: 'DPWH contracts',
    description: 'DPWH Transparency Portal contracts (BetterGov.ph snapshot)',
    dataset: 'bettergovph/dpwh-transparency-data',
    datasetUrl: 'https://huggingface.co/datasets/bettergovph/dpwh-transparency-data',
    license: 'CC0-1.0',
  },
  dpwh_nep_2027: {
    label: 'DPWH NEP 2027 proposals',
    description: 'DPWH projects proposed in the FY 2027 National Expenditure Program (BetterGov.ph)',
    dataset: 'bettergovph/dpwh-nep-2027',
    datasetUrl: 'https://huggingface.co/datasets/bettergovph/dpwh-nep-2027',
    license: 'Not stated by the dataset; NEP is a public government document',
  },
} as const;

export type ProjectSource = keyof typeof PROJECT_SOURCES;
export const PROJECT_SOURCE_IDS = Object.keys(PROJECT_SOURCES) as ProjectSource[];

export function isProjectSource(value: string | null | undefined): value is ProjectSource {
  return typeof value === 'string' && value in PROJECT_SOURCES;
}

export function sourceLabel(source: string): string {
  return isProjectSource(source) ? PROJECT_SOURCES[source].label : source;
}

/** Public detail page of one record. */
export function projectHref(source: string, recordId: string): string {
  return source === 'dpwh_contracts'
    ? `/projects/${encodeURIComponent(recordId)}`
    : `/projects/source/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`;
}
