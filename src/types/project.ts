export type ProjectCategory =
  | 'Infrastructure and Public Works'
  | 'Education and Youth Development'
  | 'Disaster Risk Reduction and Management'
  | 'Health and Sanitation';

export type ProjectStatus =
  | 'In Progress'
  | 'Completed'
  | 'Procurement'
  | 'Planned'
  | 'Delayed';

export type LifecycleStageId =
  | 'planning'
  | 'procurement'
  | 'implementation'
  | 'completion';

export type DashboardSectionId =
  | 'overview'
  | 'projects'
  | 'budget'
  | 'transparency'
  | 'map'
  | 'dpwh';

export interface ProjectMilestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  verifiedBy?: string;
}

export interface LGUProject {
  id: string;
  referenceCode: string;
  title: string;
  category: ProjectCategory;
  status: ProjectStatus;
  barangay: string;
  municipality: string;
  /**
   * Geographic coordinates (WGS84) for plotting on the Iligan City Project Map.
   * Nullable for projects where field survey coordinates are not yet recorded.
   */
  latitude?: number | null;
  longitude?: number | null;
  implementingOffice: string;
  contractorOrPartner: string;
  procurementMode: string;
  allocatedBudget: number;
  disbursedBudget: number;
  progressPercentage: number;
  startDate: string;
  targetCompletionDate: string;
  lastUpdated: string;
  lifecycleStage: LifecycleStageId;
  description: string;
  beneficiaries: string;
  imageUrl?: string;
  imageCaption?: string;
  milestones: ProjectMilestone[];
}

export interface SummaryMetrics {
  totalProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  totalAllocatedBudget: number;
  totalDisbursedBudget: number;
}

export interface ProjectFilterState {
  searchQuery: string;
  category: ProjectCategory | 'All';
  status: ProjectStatus | 'All';
  barangay: string | 'All';
}

export interface LifecycleStageInfo {
  id: LifecycleStageId;
  stepNumber: string;
  title: string;
  subtitle: string;
  description: string;
  keyOutputs: string[];
  responsibleUnit: string;
}

export interface FeatureCardItem {
  id: string;
  title: string;
  description: string;
  iconName:
    | 'file-text'
    | 'dollar-sign'
    | 'zap'
    | 'trending-up'
    | 'map-pin'
    | 'users';
  iconBgClass: string;
}

export function hasValidCoordinates(
  project: LGUProject
): project is LGUProject & { latitude: number; longitude: number } {
  return (
    typeof project.latitude === 'number' &&
    !Number.isNaN(project.latitude) &&
    typeof project.longitude === 'number' &&
    !Number.isNaN(project.longitude)
  );
}
