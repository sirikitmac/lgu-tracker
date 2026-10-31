/**
 * Where the SubayBAYAN data comes from, shown per record and in the UI.
 * The files are a one-time export (snapshot) from the DILG portal, which
 * needs a login; the app never contacts the portal itself.
 */
import type { SubaybayanDataset } from './categories';

export const SUBAYBAYAN_PROVIDER = 'DILG SubayBAYAN (RBME)';

export const SUBAYBAYAN_DATASET_INFO: Record<SubaybayanDataset, { label: string; short: string; url: string }> = {
  lgsf: {
    label: 'Locally Funded Projects (LGSF)',
    short: 'Locally Funded',
    url: 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=lgsf',
  },
  rlip: {
    label: 'Local Infrastructure Monitoring and Evaluation, 20% DF (RLIP)',
    short: 'LIME 20% DF',
    url: 'https://subaybayan.dilg.gov.ph/rbme/projects/index?type=rlip',
  },
};

/** ISO date of the export; every record carries it as retrieved_at. */
export const SUBAYBAYAN_RETRIEVED_AT = '2026-10-31';
export const SUBAYBAYAN_RETRIEVED_LABEL = 'Oct 31, 2026';

export const BOUNDARY_SOURCE = {
  name: 'faeldon/philippines-json-maps',
  release: 'v1.1.0',
  asset: 'geojson-lowres.zip',
  sha256: 'c83c54faa44d8857b6d3993b42b2d73ec57531ee7ff68ca325887c024b0018db',
  url: 'https://github.com/faeldon/philippines-json-maps/releases/download/v1.1.0/geojson-lowres.zip',
  license: 'MIT',
  psgc: 'PSGC 3Q 2026',
  underlying: 'NAMRIA / PSA via OCHA COD-AB (CC BY-IGO)',
} as const;

/** Leaflet attribution for the SubayBAYAN layer (HTML). */
export const SUBAYBAYAN_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · ' +
  '<a href="https://subaybayan.dilg.gov.ph/" target="_blank" rel="noopener noreferrer">DILG SubayBAYAN</a> · ' +
  'Boundaries: NAMRIA/PSA via <a href="https://data.humdata.org/dataset/cod-ab-phl" target="_blank" rel="noopener noreferrer">OCHA</a> (CC BY-IGO)';
