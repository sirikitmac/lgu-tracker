/**
 * Nationwide DPWH contract directory types. Mirrors public.dpwh_contracts
 * and related tables (supabase/migrations/20261026000100_dpwh_nationwide.sql).
 */

export const DPWH_CATEGORIES = [
  'roads_highways',
  'bridges',
  'flood_control_drainage',
  'buildings_facilities',
  'water_infrastructure',
  'other_infrastructure',
  'uncategorized',
] as const;
export type DpwhCategory = (typeof DPWH_CATEGORIES)[number];

export const DPWH_CATEGORY_LABELS: Record<DpwhCategory, string> = {
  roads_highways: 'Roads and highways',
  bridges: 'Bridges',
  flood_control_drainage: 'Flood control and drainage',
  buildings_facilities: 'Buildings and public facilities',
  water_infrastructure: 'Water infrastructure',
  other_infrastructure: 'Other infrastructure',
  uncategorized: 'Uncategorized',
};

export const DPWH_STATUSES = [
  'completed',
  'ongoing',
  'for_procurement',
  'not_yet_started',
  'terminated',
  'unknown',
  'proposed',
] as const;
export type DpwhStatus = (typeof DPWH_STATUSES)[number];

export const DPWH_STATUS_LABELS: Record<DpwhStatus, string> = {
  completed: 'Completed',
  ongoing: 'On-going',
  for_procurement: 'For procurement',
  not_yet_started: 'Not yet started',
  terminated: 'Terminated',
  unknown: 'Unknown',
  proposed: 'Proposed (budget)',
};

export type DpwhCategoryMethod =
  | 'source_category'
  | 'infra_type'
  | 'type_of_work'
  | 'description_keywords'
  | 'none';

/** Short codes stored in data_warnings; labels for display. */
export const DPWH_WARNING_LABELS: Record<string, string> = {
  no_component_location: 'Source reports no component location; region/province unknown.',
  multiple_regions: 'Components span more than one region.',
  multiple_provinces: 'Components span more than one province.',
  no_coordinates: 'No coordinates in source.',
  invalid_coordinates: 'Source coordinates were invalid and were dropped.',
  coordinates_unverified: 'Coordinates are DPWH-reported and unverified.',
  invalid_progress: 'Reported progress was outside 0–100 and was dropped.',
  completed_progress_below_100: 'Status is Completed but progress is below 100%.',
  ongoing_progress_100: 'Status is On-going but progress is 100%.',
  completion_before_start: 'Completion date is before start date.',
  funding_label_as_category: 'Source category is a funding label, not a work type.',
  unknown_status: 'Source status is not recognized.',
  amount_paid_exceeds_contract: 'Reported amount paid exceeds the contract amount.',
  nationwide_program: 'Source lists this as a nationwide program; no single region.',
  amount_mismatch: 'Source amount in pesos does not match its amount in thousands.',
};

/** Prefix for per-field parse failures, e.g. "invalid_number:abc". */
export const INVALID_NUMBER = 'invalid_number:';
export const INVALID_DATE = 'invalid_date:';

export interface DpwhComponent {
  component_id: string | null;
  type_of_work: string | null;
  infra_type: string | null;
  region: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinate_source: string | null;
  location_verified: boolean | null;
}

/** Row written by the sync (all source-derived columns of dpwh_contracts). */
export interface DpwhContractRecord {
  contract_id: string;
  title: string;
  contract_name: string | null;
  source_category: string | null;
  infra_type: string | null;
  category: DpwhCategory;
  category_method: DpwhCategoryMethod;
  category_reason: string;
  source_status: string | null;
  status: DpwhStatus;
  procurement_status_code: string | null;
  implementing_office: string | null;
  implementing_region: string | null;
  region: string | null;
  province: string | null;
  provinces: string[];
  municipality: string | null;
  barangay: string | null;
  latitude: number | null;
  longitude: number | null;
  contractor: string | null;
  winner_names: string | null;
  budget: number | null;
  approved_budget: number | null;
  contract_amount: number | null;
  amount_paid: number | null;
  progress: number | null;
  start_date: string | null;
  completion_date: string | null;
  contract_effectivity_date: string | null;
  expiry_date: string | null;
  infra_year: number | null;
  program_name: string | null;
  source_of_funds: string | null;
  funding_instrument: string | null;
  advertisement_date: string | null;
  bid_submission_deadline: string | null;
  award_date: string | null;
  link_advertisement: string | null;
  link_contract_agreement: string | null;
  link_notice_of_award: string | null;
  link_notice_to_proceed: string | null;
  is_live: boolean | null;
  livestream_url: string | null;
  total_images: number | null;
  latest_image_date: string | null;
  source_verified_by_dpwh: boolean | null;
  source_verified_by_public: boolean | null;
  components: DpwhComponent[];
  data_warnings: string[];
  source_hash: string;
}

/** A stored contract as read back (adds provenance set by the database). */
export interface DpwhContract extends DpwhContractRecord {
  /** Derived by the API from source_revision (not stored). */
  source_file_url: string;
  /** Derived by the API from contract_id (not stored). */
  bettergov_record_url: string;
  source_revision: string;
  source_snapshot_at: string;
  first_seen_run_id: string;
  last_changed_run_id: string;
  created_at: string;
  updated_at: string;
}

/** Columns returned by the directory list endpoint. */
export const DPWH_LIST_COLUMNS = [
  'contract_id', 'title', 'contract_name', 'category', 'status', 'region', 'province', 'provinces',
  'implementing_office', 'contractor', 'budget', 'contract_amount', 'progress', 'start_date',
  'completion_date', 'infra_year', 'latitude', 'longitude', 'contract_effectivity_date',
] as const;
export type DpwhContractListItem = Pick<DpwhContract, (typeof DPWH_LIST_COLUMNS)[number]>;

/** Columns of public.project_directory returned by the directory list endpoint (every source). */
export const PROJECT_LIST_COLUMNS = ['source', 'record_id', 'amount_label', ...DPWH_LIST_COLUMNS.filter((c) => c !== 'contract_id')] as const;
export type ProjectListItem = Omit<DpwhContractListItem, 'contract_id'> & {
  source: string;
  record_id: string;
  amount_label: string;
};

/** Columns returned by the map endpoint (contracts with coordinates). */
export const DPWH_MAP_COLUMNS = [
  'contract_id', 'title', 'contract_name', 'category', 'status', 'region', 'province',
  'implementing_office', 'contractor', 'contract_amount', 'progress', 'latitude', 'longitude',
] as const;
export type DpwhMapPoint = Pick<DpwhContract, (typeof DPWH_MAP_COLUMNS)[number]> & {
  latitude: number;
  longitude: number;
};

export interface DpwhReview {
  is_field_verified: boolean;
  verified_at: string | null;
  verification_notes: string | null;
  linked_project_id: string | null;
  updated_at: string;
}

export interface DpwhCount<T = string | null> {
  value: T;
  count: number;
}

export interface DpwhDirectoryStats {
  total_contracts: number;
  contract_amount: { sum: number; contracts_with_value: number };
  by_region: DpwhCount[];
  by_category: DpwhCount<DpwhCategory>[];
  by_status: DpwhCount<DpwhStatus>[];
  provinces: { region: string | null; province: string; count: number }[];
  municipalities: { province: string | null; municipality: string; count: number }[];
  offices: { implementing_region: string | null; office: string; count: number }[];
  infra_years: DpwhCount<number | null>[];
  /**
   * Per-region totals and breakdowns, added by migration
   * 20261031000100_dpwh_stats_by_region.sql. Absent until that migration is
   * applied and the stats are refreshed; screens fall back to all-region
   * figures and say so.
   */
  by_region_detail?: DpwhRegionDetail[];
}

export interface DpwhRegionDetail {
  region: string | null;
  count: number;
  amount_sum: number;
  contracts_with_value: number;
  by_status: DpwhCount<DpwhStatus>[];
  by_category: DpwhCount<DpwhCategory>[];
}

export interface DpwhSummary {
  computed_at: string;
  last_successful_sync_at: string | null;
  source_revision: string | null;
  source_snapshot_at: string | null;
  stats: DpwhDirectoryStats;
}
