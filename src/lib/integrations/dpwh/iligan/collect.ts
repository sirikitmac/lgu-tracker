import 'server-only';
import type {
  CoordinateEvidence,
  DpwhSourceRow,
  IliganCandidate,
  IliganClassification,
  IliganCollectionReason,
  IliganCollectionReport,
  IliganRejectedRecord,
} from '@/types/dpwhImport';
import { DPWH_DATASET, groupByContractId, hashSourceRow, normalizeDpwhRow } from '../normalize';
import { DPWH_REVISIONS, readDpwhDetails, readDpwhRows } from '../source';
import {
  CLASSIFICATION_CRITERIA,
  DPWH_ILIGAN_DEO,
  ILIGAN_CITY_PATTERN,
  analyzeDescription,
  classifyIligan,
  isUsableCoordinate,
  locatePoint,
  summarizeCoordinates,
} from './evidence';
import { REFERENCE_PROVENANCE } from './reference';

/**
 * Collects every Iligan City-related DPWH record from the pinned BetterGov
 * snapshot, deduplicates by contract ID, gathers location evidence, and
 * classifies each record. Read-only: nothing is written anywhere.
 */

const CLASSIFICATION_ORDER: IliganClassification[] = [
  'confirmed_iligan',
  'potential_iligan',
  'needs_verification',
  'excluded',
];

/** Contract points spread wider than this get a warning (long roads can be legitimate). */
const SPREAD_WARNING_M = 2_000;

function collectionReasons(row: DpwhSourceRow): IliganCollectionReason[] {
  const reasons: IliganCollectionReason[] = [];
  if (row.location?.province === DPWH_ILIGAN_DEO) reasons.push('iligan_city_deo');
  if (ILIGAN_CITY_PATTERN.test(row.description ?? '')) reasons.push('description_mentions_iligan_city');
  return reasons;
}

export async function collectIliganCandidates(): Promise<IliganCollectionReport> {
  const base = await readDpwhRows(DPWH_REVISIONS.current, {
    withDescription: true,
    match: (row) => row.office === DPWH_ILIGAN_DEO || ILIGAN_CITY_PATTERN.test(row.description ?? ''),
  });

  // Deduplicate by contract ID; rows without one are rejected by normalization.
  const rejected: IliganRejectedRecord[] = [];
  const groups = groupByContractId(base.rows);
  let duplicateSourceRows = 0;
  const uniqueRows: DpwhSourceRow[] = base.rows.filter((row) => !row.contractId);
  for (const [contractId, group] of groups) {
    duplicateSourceRows += group.length - 1;
    if (new Set(group.map(hashSourceRow)).size > 1) {
      rejected.push({
        contractId,
        reason: `${group.length} conflicting source rows share this contractId.`,
        collectedBecause: collectionReasons(group[0]),
      });
      continue;
    }
    uniqueRows.push(group[0]);
  }

  const normalized = uniqueRows.flatMap((row) => {
    const result = normalizeDpwhRow(row, DPWH_REVISIONS.current);
    if (!result.ok) {
      rejected.push({ contractId: result.contractId, reason: result.reason, collectedBecause: collectionReasons(row) });
      return [];
    }
    return [{ row, record: result.candidate }];
  });

  const { details, rowsInFile: detailsRowsInFile } = await readDpwhDetails(
    DPWH_REVISIONS.details,
    new Set(normalized.map(({ record }) => record.contractId))
  );

  let missingDetails = 0;
  const candidates: IliganCandidate[] = normalized.map(({ row, record }) => {
    const detail = details.get(record.contractId);
    if (!detail) {
      missingDetails += 1;
      record.warnings.push('No matching row in the details file; component coordinates and provinces unavailable.');
    }

    const points: CoordinateEvidence[] = [];
    const seenPoints = new Set<string>();
    const addPoint = (origin: CoordinateEvidence['origin'], lat: number, lon: number, source: string | null, verified: boolean | null) => {
      const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
      if (seenPoints.has(key)) return;
      seenPoints.add(key);
      points.push(locatePoint(origin, lat, lon, source, verified));
    };
    if (record.latitude !== null && record.longitude !== null) {
      addPoint('primary', record.latitude, record.longitude, null, null);
    }
    for (const component of detail?.components ?? []) {
      if (isUsableCoordinate(component.latitude, component.longitude)) {
        addPoint(
          `component:${component.componentId ?? 'unknown'}`,
          component.latitude,
          component.longitude as number,
          component.coordinateSource,
          component.locationVerified
        );
      }
    }
    const coordinates = summarizeCoordinates(points);
    if (coordinates.status === 'conflicting') {
      record.warnings.push('Coordinates conflict: some points are inside and some outside the Iligan City boundary.');
    } else if (coordinates.status === 'edge') {
      record.warnings.push('Coordinates are close to the Iligan City boundary; location is ambiguous.');
    }
    if (coordinates.spreadM !== null && coordinates.spreadM > SPREAD_WARNING_M) {
      record.warnings.push(`Reported points are spread over ${(coordinates.spreadM / 1000).toFixed(1)} km.`);
    }

    const text = analyzeDescription(record.title);
    if (text.barangays.length === 0) record.warnings.push('No Iligan barangay identified in the description.');
    if (text.barangays.length > 1) record.warnings.push('Description names more than one Iligan barangay.');

    const evidence = {
      implementingOffice: record.districtEngineeringOffice,
      isIliganCityDeo: record.districtEngineeringOffice === DPWH_ILIGAN_DEO,
      ...text,
      coordinates,
      componentProvinces: [
        ...new Set((detail?.components ?? []).flatMap((c) => (c.province ? [c.province.toUpperCase()] : []))),
      ],
    };
    const { classification, reasons } = classifyIligan(evidence);

    return {
      contractId: record.contractId,
      classification,
      reasons,
      collectedBecause: collectionReasons(row),
      evidence,
      record,
      documentLinks: {
        contractAgreement: detail?.contractAgreement ?? null,
        noticeOfAward: detail?.noticeOfAward ?? null,
      },
    };
  });

  candidates.sort(
    (a, b) =>
      CLASSIFICATION_ORDER.indexOf(a.classification) - CLASSIFICATION_ORDER.indexOf(b.classification) ||
      a.contractId.localeCompare(b.contractId)
  );

  const byClassification = Object.fromEntries(CLASSIFICATION_ORDER.map((c) => [c, 0])) as Record<IliganClassification, number>;
  const collectedBy = { iliganCityDeoOnly: 0, descriptionOnly: 0, both: 0 };
  for (const candidate of candidates) {
    byClassification[candidate.classification] += 1;
    const reasons = candidate.collectedBecause;
    if (reasons.length === 2) collectedBy.both += 1;
    else if (reasons[0] === 'iligan_city_deo') collectedBy.iliganCityDeoOnly += 1;
    else collectedBy.descriptionOnly += 1;
  }
  const countCoords = (status: string) => candidates.filter((c) => c.evidence.coordinates.status === status).length;

  return {
    dryRun: true,
    generatedAt: new Date().toISOString(),
    source: {
      dataset: DPWH_DATASET,
      baseFile: { ...DPWH_REVISIONS.current, rowsInFile: base.rowsInFile },
      detailsFile: { ...DPWH_REVISIONS.details, rowsInFile: detailsRowsInFile },
    },
    reference: REFERENCE_PROVENANCE,
    criteria: CLASSIFICATION_CRITERIA,
    summary: {
      uniqueCandidates: candidates.length,
      byClassification,
      collectedBy,
      duplicateSourceRows,
      rejected: rejected.length,
      missingCoordinates: countCoords('missing'),
      conflictingCoordinates: countCoords('conflicting'),
      edgeCoordinates: countCoords('edge'),
      missingDetails,
      requiringManualVerification: byClassification.potential_iligan + byClassification.needs_verification,
    },
    limitations: [
      `Snapshot, not live data: base file committed ${DPWH_REVISIONS.current.committedAt}, details file ${DPWH_REVISIONS.details.committedAt}. Progress and amounts may have changed since.`,
      'Original publisher is the DPWH Transparency Portal; BetterGov.ph compiled the snapshot (CC0-1.0). Values are not independently verified.',
      'DPWH marks no coordinate in this dataset as verified (all component coordinates are "infra_track" with locationVerified=false). "confirmed_iligan" means the source data agrees with itself and with the reference boundary, not that a site was inspected.',
      'The dataset has no barangay or municipality fields. Barangays are only recognized when the description writes them as a location ("BRGY. X", or "X, ILIGAN CITY"); none are inferred from coordinates.',
      'The office field is the DPWH District Engineering Office. Its jurisdiction differs from the city boundary, so it is never treated as location evidence.',
      'Collection matches the explicit phrase "Iligan City" / "City of Iligan". Records that say only "Iligan" (e.g. "CDOC-ILIGAN HINTERLAND ROAD") are not collected unless they belong to Iligan City DEO.',
      'The boundary is OpenStreetMap relation 3818838, not the official NAMRIA/PSA line; points within the edge tolerance are treated as ambiguous.',
      'amountPaid is 0 for nearly all completed contracts and should not be used as disbursement data.',
      'BetterGov\'s live per-contract API sometimes reports different coordinates and progress; it was not queried for this export.',
    ],
    candidates,
    rejected,
  };
}
