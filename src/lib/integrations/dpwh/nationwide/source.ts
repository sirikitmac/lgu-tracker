import {
  asyncBufferFromUrl,
  cachedAsyncBuffer,
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
  type FileMetaData,
} from 'hyparquet';

/**
 * Nationwide DPWH source: BetterGov.ph's published Parquet snapshot on
 * Hugging Face (CC0-1.0), read with HTTP range requests through the
 * documented Hub API. No scraping, no access-control workarounds.
 *
 * The details file is used because it is a superset of the base file
 * (248,421 vs 248,220 contract IDs at revision 9617fe68) and carries the
 * component locations, procurement data, and document links.
 */

export const DPWH_DATASET = 'bettergovph/dpwh-transparency-data';
export const DPWH_DETAILS_FILE = 'dpwh_transparency_data_all_details.parquet';
const HUB = 'https://huggingface.co';

export interface DpwhSnapshot {
  dataset: string;
  file: string;
  /** Commit that last changed the file; the snapshot's identity. */
  revision: string;
  /** When that commit was made (the snapshot date). */
  committedAt: string;
  fileUrl: string;
  sizeBytes: number | null;
}

export type DpwhSourceErrorCode = 'unavailable' | 'schema' | 'incomplete';

export class DpwhSourceError extends Error {
  constructor(public readonly code: DpwhSourceErrorCode, message: string) {
    super(message);
    this.name = 'DpwhSourceError';
  }
}

/** URL of the details file at an exact revision. */
export function snapshotFileUrl(revision: string): string {
  return `${HUB}/datasets/${DPWH_DATASET}/resolve/${revision}/${DPWH_DETAILS_FILE}`;
}

/** BetterGov.ph's per-contract record (an undocumented public API, linked for reference). */
export function betterGovRecordUrl(contractId: string): string {
  return `https://api.dpwh.bettergov.ph/projects/${encodeURIComponent(contractId)}`;
}

export function snapshotFor(revision: string, committedAt: string, sizeBytes: number | null = null): DpwhSnapshot {
  return {
    dataset: DPWH_DATASET,
    file: DPWH_DETAILS_FILE,
    revision,
    committedAt,
    fileUrl: snapshotFileUrl(revision),
    sizeBytes,
  };
}

/** The snapshot reviewed when this integration was built. */
export const DPWH_REVIEWED_SNAPSHOT = snapshotFor(
  '9617fe6833de522e7151947b2ca7529a4e46273c',
  '2026-01-16T12:10:57.000Z',
  114_819_143
);

/** Asks the Hub which commit last changed the details file on main. */
export async function resolveLatestSnapshot(fetchImpl: typeof fetch = fetch): Promise<DpwhSnapshot> {
  let response: Response;
  try {
    response = await fetchImpl(`${HUB}/api/datasets/${DPWH_DATASET}/paths-info/main`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [DPWH_DETAILS_FILE], expand: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new DpwhSourceError('unavailable', `Hugging Face Hub unreachable: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new DpwhSourceError('unavailable', `Hugging Face Hub returned HTTP ${response.status}.`);
  }
  const body = (await response.json().catch(() => null)) as
    | { path?: string; size?: number; lastCommit?: { id?: string; date?: string } }[]
    | null;
  const entry = Array.isArray(body) ? body.find((e) => e?.path === DPWH_DETAILS_FILE) : undefined;
  const revision = entry?.lastCommit?.id;
  const date = entry?.lastCommit?.date;
  if (!entry || typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision) || typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
    throw new DpwhSourceError('schema', 'Hub response did not describe the DPWH details file.');
  }
  return snapshotFor(revision, new Date(date).toISOString(), typeof entry.size === 'number' ? entry.size : null);
}

/** Top-level columns the normalizer reads (bidders is skipped: too heavy to decode). */
export const SOURCE_COLUMNS = [
  'contractId', 'description', 'category', 'status', 'budget', 'amountPaid', 'progress', 'region',
  'province', 'infraType', 'latitude', 'longitude', 'contractor', 'startDate', 'completionDate',
  'infraYear', 'contractEffectivityDate', 'expiryDate', 'programName', 'sourceOfFunds',
  'isVerifiedByDpwh', 'isVerifiedByPublic', 'isLive', 'livestreamUrl', 'components', 'winnerNames',
  'contractName', 'abc', 'status_1', 'fundingInstrument', 'advertisementDate', 'bidSubmissionDeadline',
  'dateOfAward', 'awardAmount', 'advertisement', 'contractAgreement', 'noticeOfAward', 'noticeToProceed',
  'totalImages', 'latestImageDate',
] as const;

/** Columns without which the snapshot is unusable. */
const REQUIRED_COLUMNS = ['contractId', 'description', 'status', 'region', 'province', 'components'];
const REQUIRED_COMPONENT_FIELDS = ['region', 'province', 'typeOfWork'];

export function validateSchema(metadata: FileMetaData): void {
  const schema = parquetSchema(metadata);
  const names = new Set(schema.children.map((c) => c.element.name));
  const missing = REQUIRED_COLUMNS.filter((name) => !names.has(name));
  if (missing.length) throw new DpwhSourceError('schema', `Snapshot is missing required columns: ${missing.join(', ')}.`);

  // components: list<struct<...>>; check the struct's fields.
  const components = schema.children.find((c) => c.element.name === 'components');
  const element = components?.children[0]?.children[0];
  const fields = new Set(element?.children.map((c) => c.element.name) ?? []);
  const missingFields = REQUIRED_COMPONENT_FIELDS.filter((f) => !fields.has(f));
  if (missingFields.length) {
    throw new DpwhSourceError('schema', `Snapshot components are missing fields: ${missingFields.join(', ')}.`);
  }
}

export interface OpenSnapshot {
  rows: number;
  /** Contract IDs in file order (cheap: one column). */
  readContractIds(): Promise<(string | null)[]>;
  /** Rows [start, end) with SOURCE_COLUMNS. Memory peaks around 1.3 GB per row group. */
  readSlice(start: number, end: number): Promise<Record<string, unknown>[]>;
}

export async function openSnapshot(snapshot: DpwhSnapshot): Promise<OpenSnapshot> {
  let file;
  let metadata: FileMetaData;
  try {
    const requestInit: RequestInit = { cache: 'no-store' };
    file = cachedAsyncBuffer(await asyncBufferFromUrl({ url: snapshot.fileUrl, requestInit }));
    metadata = await parquetMetadataAsync(file);
  } catch (error) {
    throw new DpwhSourceError('unavailable', `Could not read snapshot ${snapshot.revision}: ${(error as Error).message}`);
  }
  validateSchema(metadata);
  const available = new Set(parquetSchema(metadata).children.map((c) => c.element.name));
  const columns = SOURCE_COLUMNS.filter((c) => available.has(c));

  return {
    rows: Number(metadata.num_rows),
    async readContractIds() {
      const rows = await parquetReadObjects({ file, metadata, columns: ['contractId'] });
      return rows.map((r) => (typeof r.contractId === 'string' ? r.contractId : null));
    },
    async readSlice(start, end) {
      return parquetReadObjects({ file, metadata, columns: [...columns], rowStart: start, rowEnd: end });
    },
  };
}
