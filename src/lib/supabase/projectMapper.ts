import type {
  LGUProject,
  LifecycleStageId,
  ProjectCategory,
  ProjectStatus,
} from '@/types/project';

/**
 * Database row shapes for public.projects and public.project_milestones
 * (see supabase/migrations/20261025000200_core_tables.sql). Once the local
 * stack is running, these can be replaced by generated types:
 *   npx supabase gen types typescript --local > src/types/database.ts
 */
export type DbProjectCategory =
  | 'infrastructure_public_works'
  | 'education_youth_development'
  | 'disaster_risk_reduction'
  | 'health_sanitation';

export type DbProjectStatus = 'planned' | 'procurement' | 'in_progress' | 'delayed' | 'completed';

export interface ProjectMilestoneRow {
  id: string;
  project_id: string;
  title: string;
  target_date: string | null;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  verified_by_name: string | null;
}

export interface ProjectRow {
  id: string;
  reference_code: string;
  title: string;
  description: string;
  category: DbProjectCategory;
  status: DbProjectStatus;
  lifecycle_stage: LifecycleStageId;
  barangay: string;
  municipality: string;
  latitude: number | null;
  longitude: number | null;
  implementing_office: string;
  contractor_or_partner: string;
  procurement_mode: string;
  allocated_budget: number | string;
  disbursed_budget: number | string;
  progress_percentage: number;
  start_date: string | null;
  target_completion_date: string | null;
  beneficiaries: string;
  image_url: string | null;
  image_caption: string | null;
  updated_at: string;
  project_milestones?: ProjectMilestoneRow[] | null;
}

const CATEGORY_FROM_DB: Record<DbProjectCategory, ProjectCategory> = {
  infrastructure_public_works: 'Infrastructure and Public Works',
  education_youth_development: 'Education and Youth Development',
  disaster_risk_reduction: 'Disaster Risk Reduction and Management',
  health_sanitation: 'Health and Sanitation',
};

const STATUS_FROM_DB: Record<DbProjectStatus, ProjectStatus> = {
  planned: 'Planned',
  procurement: 'Procurement',
  in_progress: 'In Progress',
  delayed: 'Delayed',
  completed: 'Completed',
};

const STATUS_TO_DB = Object.fromEntries(
  Object.entries(STATUS_FROM_DB).map(([db, label]) => [label, db])
) as Record<ProjectStatus, DbProjectStatus>;

const CATEGORY_TO_DB = Object.fromEntries(
  Object.entries(CATEGORY_FROM_DB).map(([db, label]) => [label, db])
) as Record<ProjectCategory, DbProjectCategory>;

export function toDbProjectStatus(status: ProjectStatus): DbProjectStatus | undefined {
  return STATUS_TO_DB[status];
}

export function toDbProjectCategory(category: ProjectCategory): DbProjectCategory | undefined {
  return CATEGORY_TO_DB[category];
}

/** Columns requested by fetchLGUProjects, including nested milestones. */
export const PROJECT_SELECT = `
  id, reference_code, title, description, category, status, lifecycle_stage,
  barangay, municipality, latitude, longitude, implementing_office,
  contractor_or_partner, procurement_mode, allocated_budget, disbursed_budget,
  progress_percentage, start_date, target_completion_date, beneficiaries,
  image_url, image_caption, updated_at,
  project_milestones ( id, project_id, title, target_date, sort_order,
                       is_completed, completed_at, verified_by_name )
`;

export function mapProjectRow(row: ProjectRow): LGUProject {
  const milestones = [...(row.project_milestones ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return {
    id: row.id,
    referenceCode: row.reference_code,
    title: row.title,
    category: CATEGORY_FROM_DB[row.category],
    status: STATUS_FROM_DB[row.status],
    barangay: row.barangay,
    municipality: row.municipality,
    latitude: row.latitude,
    longitude: row.longitude,
    implementingOffice: row.implementing_office,
    contractorOrPartner: row.contractor_or_partner,
    procurementMode: row.procurement_mode,
    allocatedBudget: Number(row.allocated_budget),
    disbursedBudget: Number(row.disbursed_budget),
    progressPercentage: row.progress_percentage,
    startDate: row.start_date ?? '',
    targetCompletionDate: row.target_completion_date ?? '',
    lastUpdated: row.updated_at.slice(0, 10),
    lifecycleStage: row.lifecycle_stage,
    description: row.description,
    beneficiaries: row.beneficiaries,
    imageUrl: row.image_url ?? undefined,
    imageCaption: row.image_caption ?? undefined,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      targetDate: m.target_date ?? '',
      completed: m.is_completed,
      verifiedBy: m.verified_by_name ?? undefined,
    })),
  };
}
