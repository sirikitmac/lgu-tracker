import type { DbProjectCategory, DbProjectStatus } from '@/lib/supabase/projectMapper';

/**
 * Types for the DPWH import proof of concept (dry run only).
 *
 * Source: BetterGov.ph's CC0 snapshot of the DPWH Transparency API on Hugging
 * Face (bettergovph/dpwh-transparency-data). Imported records are kept apart
 * from locally managed LGU Tracker projects: they are never LGUProject values
 * and are never written to public.projects.
 */

/** A pinned, immutable revision of the source dataset. */
export interface DpwhSourceRevision {
  /** Full Hugging Face commit SHA. */
  sha: string;
  /** When that commit was made (from the Hugging Face commit log). */
  committedAt: string;
  /** Resolved file URL for exactly this revision. */
  fileUrl: string;
}

/** One row of dpwh_transparency_data.parquet, exactly as stored. */
export interface DpwhSourceRow {
  contractId: string | null;
  description: string | null;
  category: string | null;
  componentCategories: string | null;
  status: string | null;
  budget: number | null;
  amountPaid: number | null;
  progress: number | null;
  /** `province` actually holds the DPWH District Engineering Office name. */
  location: { province: string | null; region: string | null } | null;
  contractor: string | null;
  startDate: string | null;
  completionDate: string | null;
  infraYear: string | null;
  programName: string | null;
  sourceOfFunds: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * A normalized candidate record. `source*` fields are DPWH values carried
 * over unchanged; `mapped*` fields are this app's interpretation and are null
 * whenever the source value has no unambiguous equivalent.
 */
export interface DpwhImportCandidate {
  /** Stable DPWH contract ID; the deduplication key. */
  contractId: string;
  title: string;
  sourceStatus: string | null;
  mappedStatus: DbProjectStatus | null;
  sourceCategory: string | null;
  sourceComponentCategories: string | null;
  mappedCategory: DbProjectCategory | null;
  /** DPWH District Engineering Office, NOT a municipality or province. */
  districtEngineeringOffice: string | null;
  region: string | null;
  contractor: string | null;
  budget: number | null;
  amountPaid: number | null;
  progressPercentage: number | null;
  startDate: string | null;
  completionDate: string | null;
  infraYear: string | null;
  programName: string | null;
  sourceOfFunds: string | null;
  latitude: number | null;
  longitude: number | null;
  provenance: {
    dataset: string;
    revision: string;
    revisionCommittedAt: string;
    fileUrl: string;
    /** BetterGov's per-contract mirror (undocumented API, for reference). */
    betterGovRecordUrl: string;
    originalPublisher: string;
    license: string;
  };
  /** SHA-256 of the source row; changes when DPWH data changes. */
  contentHash: string;
  /** Non-fatal data quality notes. */
  warnings: string[];
}

export type DpwhPreviewAction = 'insert' | 'update' | 'skip' | 'reject';

export interface DpwhPreviewEntry {
  action: DpwhPreviewAction;
  /** Null only for rejected rows that lack a contract ID. */
  contractId: string | null;
  reason: string;
  candidate?: DpwhImportCandidate;
  /** Source field names that differ from the baseline (updates only). */
  changedFields?: string[];
}

export interface DpwhDryRunReport {
  dryRun: true;
  generatedAt: string;
  filter: { districtEngineeringOffice: string; limit: number };
  source: DpwhSourceRevision & { dataset: string; rowsInFile: number; rowsMatchingFilter: number };
  baseline: { description: string; revision: string | null; records: number };
  summary: Record<DpwhPreviewAction, number>;
  entries: DpwhPreviewEntry[];
  notes: string[];
}

// -----------------------------------------------------------------------------
// Iligan City candidate collection
// -----------------------------------------------------------------------------

export type IliganClassification =
  | 'confirmed_iligan'
  | 'potential_iligan'
  | 'needs_verification'
  | 'excluded';

/** Why a record was collected at all. */
export type IliganCollectionReason = 'iligan_city_deo' | 'description_mentions_iligan_city';

/** Where a coordinate falls relative to the reference Iligan City boundary. */
export type BoundaryPosition = 'inside' | 'edge' | 'outside';

export interface CoordinateEvidence {
  /** "primary" is the contract-level point; components come from the details file. */
  origin: 'primary' | `component:${string}`;
  latitude: number;
  longitude: number;
  position: BoundaryPosition;
  /** Distance to the boundary line in metres. */
  distanceToBoundaryM: number;
  /** Source label from DPWH, e.g. "infra_track"; null for the primary point. */
  source: string | null;
  locationVerified: boolean | null;
}

export interface IliganEvidence {
  implementingOffice: string | null;
  isIliganCityDeo: boolean;
  /** "Iligan City" names the project location, not just a road. */
  descriptionLocatesInIliganCity: boolean;
  /** "Iligan City" appears only inside road/route names. */
  iliganOnlyInRoadNames: boolean;
  /** PSGC Iligan barangays written as a location (e.g. "BRGY. TIBANGA"). */
  barangays: { psgcCode: string; name: string; matchedText: string }[];
  /** Other municipalities/provinces written as a location. */
  otherPlaces: string[];
  coordinates: {
    status: 'inside' | 'edge' | 'outside' | 'missing' | 'conflicting';
    points: CoordinateEvidence[];
    /** Largest distance between any two points, in metres. */
    spreadM: number | null;
  };
  /** Province values on the contract's components (details file). */
  componentProvinces: string[];
}

export interface IliganCandidate {
  contractId: string;
  classification: IliganClassification;
  /** Short, human-readable reasons for the classification. */
  reasons: string[];
  collectedBecause: IliganCollectionReason[];
  evidence: IliganEvidence;
  /** Normalized record with source values, provenance, and data warnings. */
  record: DpwhImportCandidate;
  /** Document links from the details file, when present (not fetched). */
  documentLinks: { contractAgreement: string | null; noticeOfAward: string | null };
}

export interface IliganRejectedRecord {
  contractId: string | null;
  reason: string;
  collectedBecause: IliganCollectionReason[];
}

export interface IliganCollectionReport {
  dryRun: true;
  generatedAt: string;
  source: {
    dataset: string;
    baseFile: DpwhSourceRevision & { rowsInFile: number };
    detailsFile: DpwhSourceRevision & { rowsInFile: number };
  };
  reference: Record<string, string>;
  criteria: Record<IliganClassification, string>;
  summary: {
    uniqueCandidates: number;
    byClassification: Record<IliganClassification, number>;
    collectedBy: { iliganCityDeoOnly: number; descriptionOnly: number; both: number };
    duplicateSourceRows: number;
    rejected: number;
    missingCoordinates: number;
    conflictingCoordinates: number;
    edgeCoordinates: number;
    missingDetails: number;
    requiringManualVerification: number;
  };
  limitations: string[];
  candidates: IliganCandidate[];
  rejected: IliganRejectedRecord[];
}
