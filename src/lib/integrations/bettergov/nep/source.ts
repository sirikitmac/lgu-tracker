import { parseCsv } from '../csv';
import { downloadHubText, HubError, resolveHubSnapshot, type HubSnapshot } from '../hub';
import type { SourceAdapter } from '../sync';
import { NEP_COLUMNS, NEP_DATASET, NEP_FILE, NEP_SOURCE, normalizeNepRow } from './normalize';

/** Reads the CSV and refuses it if a required column is missing. */
export async function readNepRows(snapshot: HubSnapshot, fetchImpl: typeof fetch = fetch): Promise<Record<string, string>[]> {
  const { header, rows } = parseCsv(await downloadHubText(snapshot, fetchImpl));
  const missing = NEP_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new HubError(`${NEP_FILE} is missing columns: ${missing.join(', ')}.`);
  return rows;
}

export const nepAdapter: SourceAdapter = {
  source: NEP_SOURCE,
  resolveSnapshot: () => resolveHubSnapshot(NEP_DATASET, NEP_FILE),
  readRows: (snapshot) => readNepRows(snapshot),
  normalize: normalizeNepRow,
};
