import 'server-only';
import {
  asyncBufferFromUrl,
  cachedAsyncBuffer,
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
  type FileMetaData,
} from 'hyparquet';
import type { DpwhSourceRevision, DpwhSourceRow } from '@/types/dpwhImport';
import { DPWH_DATASET, toSourceRow } from './normalize';

/**
 * Reads DPWH records from BetterGov.ph's published Parquet snapshot on
 * Hugging Face using HTTP range requests, so only the needed column chunks
 * are downloaded instead of the whole 24 MB file.
 *
 * Revisions are pinned to commit SHAs: a given SHA always serves the same
 * bytes, so every preview is reproducible and traceable. Bump these
 * deliberately after reviewing a new upload.
 */

const FILE = 'dpwh_transparency_data.parquet';
const DETAILS_FILE = 'dpwh_transparency_data_all_details.parquet';

function revision(sha: string, committedAt: string, file = FILE): DpwhSourceRevision {
  return {
    sha,
    committedAt,
    fileUrl: `https://huggingface.co/datasets/${DPWH_DATASET}/resolve/${sha}/${file}`,
  };
}

export const DPWH_REVISIONS = {
  /** "Upload dpwh_transparency_data.parquet" — latest data upload. */
  current: revision('417fc8623366ce7b1ea1412c494b32fdd5460b74', '2026-01-14T12:59:45Z'),
  /** "Add dataset" — first published snapshot. */
  previous: revision('dfea2ca396deaf7991934ee98743c03c20642d06', '2025-11-28T16:23:04Z'),
  /** "Upload dpwh_transparency_data_all_details.parquet" — components, bidders, documents. */
  details: revision('9617fe6833de522e7151947b2ca7529a4e46273c', '2026-01-16T12:10:57Z', DETAILS_FILE),
} as const;

/** Columns documented in the dataset card that the import uses. */
const SOURCE_COLUMNS = [
  'contractId', 'description', 'category', 'componentCategories', 'status',
  'budget', 'amountPaid', 'progress', 'contractor', 'startDate',
  'completionDate', 'infraYear', 'programName', 'sourceOfFunds', 'latitude', 'longitude',
];

/**
 * The published revisions differ in layout: the first stores location as
 * flat `location_province` / `location_region` columns, later ones as a
 * nested `location` struct. Detect which one this file uses.
 */
function locationColumns(metadata: FileMetaData): string[] {
  const names = new Set(parquetSchema(metadata).children.map((child) => child.element.name));
  if (names.has('location')) return ['location'];
  if (names.has('location_province') && names.has('location_region')) {
    return ['location_province', 'location_region'];
  }
  throw new Error('DPWH dataset revision has no recognized location columns.');
}

function officeOf(row: Record<string, unknown>): string | null {
  const location = row.location as { province?: unknown } | null | undefined;
  const office = location ? location.province : row.location_province;
  return typeof office === 'string' ? office : null;
}

const REQUEST_TIMEOUT_MS = 180_000;

async function openParquet(source: DpwhSourceRevision) {
  const requestInit: RequestInit = {
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  const file = cachedAsyncBuffer(await asyncBufferFromUrl({ url: source.fileUrl, requestInit }));
  return { file, metadata: await parquetMetadataAsync(file) };
}

/** The fields available to a row filter before full rows are read. */
export interface DpwhIndexRow {
  contractId: string | null;
  /** DPWH District Engineering Office (the dataset's `location.province`). */
  office: string | null;
  /** Only populated when `withDescription` is set. */
  description: string | null;
}

export interface DpwhReadOptions {
  match: (row: DpwhIndexRow) => boolean;
  /** Also read descriptions in the filtering pass (costs a larger download). */
  withDescription?: boolean;
  /** Keep at most this many matches (in file order). */
  limit?: number;
}

export interface DpwhReadResult {
  rows: DpwhSourceRow[];
  rowsInFile: number;
  rowsMatchingFilter: number;
}

export async function readDpwhRows(
  source: DpwhSourceRevision,
  options: DpwhReadOptions
): Promise<DpwhReadResult> {
  const { file, metadata } = await openParquet(source);
  const location = locationColumns(metadata);

  // Pass 1: only the columns the filter needs, to find matching rows.
  const index = await parquetReadObjects({
    file,
    metadata,
    columns: ['contractId', ...location, ...(options.withDescription ? ['description'] : [])],
  });
  const matches: number[] = [];
  index.forEach((row, i) => {
    const indexRow: DpwhIndexRow = {
      contractId: typeof row.contractId === 'string' ? row.contractId : null,
      office: officeOf(row),
      description: typeof row.description === 'string' ? row.description : null,
    };
    if (options.match(indexRow)) matches.push(i);
  });
  const selected = options.limit === undefined ? matches : matches.slice(0, options.limit);
  if (selected.length === 0) {
    return { rows: [], rowsInFile: index.length, rowsMatchingFilter: matches.length };
  }

  // Pass 2: full rows, read once over the span that covers the selection.
  const rowStart = selected[0];
  const span = await parquetReadObjects({
    file,
    metadata,
    columns: [...SOURCE_COLUMNS, ...location],
    rowStart,
    rowEnd: selected[selected.length - 1] + 1,
  });
  const rows = selected.map((i) => toSourceRow(span[i - rowStart]));

  return { rows, rowsInFile: index.length, rowsMatchingFilter: matches.length };
}

export interface DpwhComponentDetail {
  componentId: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: string | null;
  locationVerified: boolean | null;
}

export interface DpwhContractDetail {
  components: DpwhComponentDetail[];
  contractAgreement: string | null;
  noticeOfAward: string | null;
}

/**
 * Reads per-contract components (with their own coordinates and province)
 * and document links from the details file for the given contract IDs.
 * Only the first row per contract ID is kept.
 */
export async function readDpwhDetails(
  source: DpwhSourceRevision,
  contractIds: ReadonlySet<string>
): Promise<{ details: Map<string, DpwhContractDetail>; rowsInFile: number }> {
  const { file, metadata } = await openParquet(source);
  const index = await parquetReadObjects({ file, metadata, columns: ['contractId'] });
  const selected: number[] = [];
  const seen = new Set<string>();
  index.forEach((row, i) => {
    const id = row.contractId as string;
    if (contractIds.has(id) && !seen.has(id)) {
      seen.add(id);
      selected.push(i);
    }
  });
  const details = new Map<string, DpwhContractDetail>();
  if (selected.length === 0) return { details, rowsInFile: index.length };

  const rowStart = selected[0];
  const span = await parquetReadObjects({
    file,
    metadata,
    columns: ['contractId', 'components', 'contractAgreement', 'noticeOfAward'],
    rowStart,
    rowEnd: selected[selected.length - 1] + 1,
  });
  const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  for (const i of selected) {
    const row = span[i - rowStart];
    const components = Array.isArray(row.components) ? row.components : [];
    details.set(row.contractId as string, {
      components: components.map((c: Record<string, unknown>) => {
        const coordinates = (c.coordinates ?? {}) as Record<string, unknown>;
        return {
          componentId: text(c.componentId),
          province: text(c.province),
          latitude: num(coordinates.latitude),
          longitude: num(coordinates.longitude),
          coordinateSource: text(coordinates.source),
          locationVerified: typeof coordinates.locationVerified === 'boolean' ? coordinates.locationVerified : null,
        };
      }),
      contractAgreement: text(row.contractAgreement),
      noticeOfAward: text(row.noticeOfAward),
    });
  }
  return { details, rowsInFile: index.length };
}
