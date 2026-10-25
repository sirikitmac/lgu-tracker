import type { DpwhCategory, DpwhCategoryMethod, DpwhStatus } from './dpwh';

/**
 * Records from BetterGov.ph datasets other than the DPWH contract snapshot.
 * Mirrors public.infrastructure_projects
 * (supabase/migrations/20261028000100_bettergov_sources.sql).
 */

/** Row written by a source sync (all source-derived columns). */
export interface InfrastructureProjectRecord {
  source: string;
  source_id: string;
  title: string;
  category: DpwhCategory;
  category_method: DpwhCategoryMethod;
  category_reason: string;
  status: DpwhStatus;
  region: string | null;
  province: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  implementing_office: string | null;
  program_name: string | null;
  sub_program: string | null;
  project_type: string | null;
  amount: number | null;
  amount_label: string;
  fiscal_year: number | null;
  source_record: Record<string, unknown>;
  data_warnings: string[];
  source_hash: string;
}

/** A stored record as read back. */
export interface InfrastructureProject extends InfrastructureProjectRecord {
  id: string;
  source_dataset: string;
  source_file: string;
  source_revision: string;
  source_snapshot_at: string;
  first_seen_run_id: string;
  last_changed_run_id: string;
  created_at: string;
  updated_at: string;
}
