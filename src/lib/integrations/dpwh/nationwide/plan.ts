import type { DpwhSnapshot, OpenSnapshot } from './source';
import { indexContractIds, prepareRows } from './sync';

/**
 * Dry run over an entire snapshot: normalizes every row exactly as the sync
 * would and reports what applying it would do. Writes nothing.
 */

export interface SyncPlan {
  snapshot: { revision: string; committedAt: string; fileUrl: string };
  sourceRows: number;
  uniqueContractIds: number;
  missingContractIds: number;
  duplicateRows: number;
  valid: number;
  rejected: number;
  rejectedReasons: Record<string, number>;
  rejectedSample: { row: number; contract_id: string | null; reason: string }[];
  /** Null when no existing hashes were supplied (database not consulted). */
  expected: { insert: number; update: number; unchanged: number } | null;
  byCategory: Record<string, number>;
  byCategoryMethod: Record<string, number>;
  byStatus: Record<string, number>;
  byRegion: Record<string, number>;
  warnings: Record<string, number>;
  coverage: {
    withRegion: number;
    withProvince: number;
    multiProvince: number;
    withCoordinates: number;
    withContractAmount: number;
    withMunicipality: number;
    withBarangay: number;
  };
  /** Payload size estimate, to judge database storage needs. */
  payloadMegabytes: number;
}

const bump = (map: Record<string, number>, key: string | null) => {
  const k = key ?? '(none)';
  map[k] = (map[k] ?? 0) + 1;
};

export async function planDpwhSync(
  opened: OpenSnapshot,
  snapshot: DpwhSnapshot,
  options: { existingHashes?: Map<string, string>; sliceSize?: number; onProgress?: (done: number) => void } = {}
): Promise<SyncPlan> {
  const sliceSize = options.sliceSize ?? 10_000;
  const ids = await opened.readContractIds();
  const { first, missing, duplicates } = indexContractIds(ids);

  const plan: SyncPlan = {
    snapshot: { revision: snapshot.revision, committedAt: snapshot.committedAt, fileUrl: snapshot.fileUrl },
    sourceRows: opened.rows,
    uniqueContractIds: first.size,
    missingContractIds: missing,
    duplicateRows: duplicates,
    valid: 0,
    rejected: 0,
    rejectedReasons: {},
    rejectedSample: [],
    expected: options.existingHashes ? { insert: 0, update: 0, unchanged: 0 } : null,
    byCategory: {}, byCategoryMethod: {}, byStatus: {}, byRegion: {}, warnings: {},
    coverage: { withRegion: 0, withProvince: 0, multiProvince: 0, withCoordinates: 0, withContractAmount: 0, withMunicipality: 0, withBarangay: 0 },
    payloadMegabytes: 0,
  };
  let bytes = 0;

  for (let start = 0; start < opened.rows; start += sliceSize) {
    const end = Math.min(start + sliceSize, opened.rows);
    const raw = await opened.readSlice(start, end);
    if (raw.length !== end - start) throw new Error(`Slice [${start}, ${end}) returned ${raw.length} rows.`);
    const { contracts, rejected } = prepareRows(raw, start, first, snapshot);

    for (const r of rejected) {
      plan.rejected += 1;
      bump(plan.rejectedReasons, r.reason);
      if (plan.rejectedSample.length < 50) plan.rejectedSample.push(r);
    }
    for (const c of contracts) {
      plan.valid += 1;
      bytes += JSON.stringify(c).length;
      bump(plan.byCategory, c.category);
      bump(plan.byCategoryMethod, c.category_method);
      bump(plan.byStatus, c.status);
      bump(plan.byRegion, c.region);
      for (const w of c.data_warnings) bump(plan.warnings, w);
      if (c.region) plan.coverage.withRegion += 1;
      if (c.province) plan.coverage.withProvince += 1;
      if (c.provinces.length > 1) plan.coverage.multiProvince += 1;
      if (c.latitude !== null) plan.coverage.withCoordinates += 1;
      if (c.contract_amount !== null) plan.coverage.withContractAmount += 1;
      if (c.municipality) plan.coverage.withMunicipality += 1;
      if (c.barangay) plan.coverage.withBarangay += 1;
      if (plan.expected) {
        const stored = options.existingHashes!.get(c.contract_id);
        if (stored === undefined) plan.expected.insert += 1;
        else if (stored === c.source_hash) plan.expected.unchanged += 1;
        else plan.expected.update += 1;
      }
    }
    options.onProgress?.(end);
  }
  plan.payloadMegabytes = Math.round(bytes / 1e6);
  return plan;
}
