/**
 * Datasets listed in the project directory, for labels and attribution:
 * BetterGov.ph's DPWH datasets and the DILG SubayBAYAN snapshot.
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
  subaybayan_lgsf: {
    label: 'DILG Locally Funded',
    description: 'DILG SubayBAYAN Locally Funded Projects (LGSF), one-time export',
    dataset: 'DILG SubayBAYAN (RBME) · Locally Funded Projects',
    datasetUrl: 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=lgsf',
    license: 'Public government records (DILG); retrieved Oct 31, 2026',
  },
  subaybayan_rlip: {
    label: 'DILG LIME 20% DF',
    description: 'DILG SubayBAYAN Local Infrastructure Monitoring and Evaluation, 20% Development Fund (RLIP), one-time export',
    dataset: 'DILG SubayBAYAN (RBME) · LIME 20% DF',
    datasetUrl: 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip',
    license: 'Public government records (DILG); retrieved Oct 31, 2026',
  },
} as const;

export type ProjectSource = keyof typeof PROJECT_SOURCES;
export const PROJECT_SOURCE_IDS = Object.keys(PROJECT_SOURCES) as ProjectSource[];

export function isProjectSource(value: string | null | undefined): value is ProjectSource {
  return typeof value === 'string' && value in PROJECT_SOURCES;
}

/** The `agency` column of public.project_directory. */
export const PROJECT_AGENCIES = ['DPWH', 'DILG'] as const;
export type ProjectAgency = (typeof PROJECT_AGENCIES)[number];

export const AGENCY_SOURCES: Record<ProjectAgency, readonly ProjectSource[]> = {
  DPWH: ['dpwh_contracts', 'dpwh_nep_2027'],
  DILG: ['subaybayan_lgsf', 'subaybayan_rlip'],
};

/** What each agency filter covers, for the directory's scope line. */
export const AGENCY_SCOPE: Record<ProjectAgency, string> = {
  DPWH: 'DPWH contracts and DPWH NEP 2027 proposals',
  DILG: 'DILG SubayBAYAN (Locally Funded and LIME 20% DF)',
};

export function isProjectAgency(value: string | null | undefined): value is ProjectAgency {
  return value === 'DPWH' || value === 'DILG';
}

export function agencyOf(source: string): ProjectAgency | null {
  if (!isProjectSource(source)) return null;
  return AGENCY_SOURCES.DILG.includes(source) ? 'DILG' : 'DPWH';
}

/** DILG SubayBAYAN record (subaybayan_lgsf / subaybayan_rlip). */
export const isDilgSource = (source: string) => source === 'subaybayan_lgsf' || source === 'subaybayan_rlip';

/** SubayBAYAN dataset id ('lgsf' | 'rlip') of a directory source, or null. */
export function subaybayanDataset(source: string): 'lgsf' | 'rlip' | null {
  return source === 'subaybayan_lgsf' ? 'lgsf' : source === 'subaybayan_rlip' ? 'rlip' : null;
}

/** Public map link that opens one SubayBAYAN project. */
export const subaybayanMapHref = (id: string) => `/projects/map?layer=subaybayan&focus=${encodeURIComponent(id)}`;

export function sourceLabel(source: string): string {
  return isProjectSource(source) ? PROJECT_SOURCES[source].label : source;
}

/** Public detail page of one record. */
export function projectHref(source: string, recordId: string): string {
  return source === 'dpwh_contracts'
    ? `/projects/${encodeURIComponent(recordId)}`
    : `/projects/source/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`;
}
